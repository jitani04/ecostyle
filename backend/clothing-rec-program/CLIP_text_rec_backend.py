import os
from io import BytesIO
from typing import Optional

import torch
import clip
import numpy as np
from PIL import Image
from supabase import create_client, Client
from dotenv import load_dotenv

from fastapi import FastAPI, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware

'''
HOW TO RUN:
* create a python virtual enviroment
* install these dependencies
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
    pip install Pillow requests python-dotenv supabase ftfy regex timm
    pip install git+https://github.com/openai/CLIP.git
    pip install fastapi uvicorn
    pip install python-multipart

    i chaged my numpy version to be 1.x to avoid compatibility issues
        pip install numpy==1.26.4

* use this command to run the backend:
    uvicorn CLIP_text_rec_backend:app --reload

* go to the link to access the backend and test it out, click on the /search endpoint:
    http://localhost:8000/docs
'''

print("Backend script started")
load_dotenv()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

# ---------- CLIP setup ----------
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")
model, preprocess = clip.load("ViT-B/16", device=device)  # UPGRADED MODEL
model.eval()

CLOTHING_COLORS = [
    "black", "white", "gray", "red", "blue", "green",
    "yellow", "pink", "purple", "brown", "beige", "orange"
]

CLOTHING_TYPES = [
    "t-shirt", "long sleeve shirt", "sweater", "hoodie",
    "jacket", "coat", "dress", "skirt", "jeans",
    "pants", "shorts", "blouse", "cardigan"
]

def build_label_embeddings(labels, template="a photo of a {}"):
    texts = [template.format(label) for label in labels]
    with torch.no_grad():
        tokens = clip.tokenize(texts).to(device)
        text_emb = model.encode_text(tokens)
        text_emb = text_emb / text_emb.norm(dim=-1, keepdim=True)
    return text_emb

COLOR_TEXT_EMB = build_label_embeddings(
    CLOTHING_COLORS,
    template="a photo of a {} clothing item"
)
TYPE_TEXT_EMB = build_label_embeddings(
    CLOTHING_TYPES,
    template="a photo of a {}"
)

def compute_image_embedding(image: Image.Image):
    img_tensor = preprocess(image).unsqueeze(0).to(device)
    with torch.no_grad():
        emb = model.encode_image(img_tensor)
        emb = emb / emb.norm(dim=-1, keepdim=True)
    return emb

def classify_attributes_from_embedding(emb: torch.Tensor):
    """
    emb: 1 x 512 normalized image embedding
    Returns predicted (color, garment_type, color_conf, type_conf).
    """
    with torch.no_grad():
        # type
        sim_types = (emb @ TYPE_TEXT_EMB.T)[0]
        type_probs = sim_types.softmax(dim=0)
        type_idx = int(type_probs.argmax().item())
        garment_type = CLOTHING_TYPES[type_idx]
        type_conf = float(type_probs[type_idx].item())

        # color
        sim_colors = (emb @ COLOR_TEXT_EMB.T)[0]
        color_probs = sim_colors.softmax(dim=0)
        color_idx = int(color_probs.argmax().item())
        color = CLOTHING_COLORS[color_idx]
        color_conf = float(color_probs[color_idx].item())

    return color, garment_type, color_conf, type_conf

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "ok"}

@app.post("/search")
async def search(
    file: UploadFile = File(...),
    k: int = Query(10, description="Number of results to return"),
    user_color: Optional[str] = Query(None, description="Override predicted color"),
    user_type: Optional[str] = Query(None, description="Override predicted garment type"),
):
    """
    Hybrid search:
    - Extract CLIP embedding from uploaded image
    - Predict color + garment_type using CLIP zero-shot
    - Allow user to override those predictions
    - Query Supabase RPC `match_embeddings_hybrid` with filters + embedding
    """
    # Read image
    img_bytes = await file.read()
    image = Image.open(BytesIO(img_bytes)).convert("RGB")

    # Compute embedding
    emb = compute_image_embedding(image)
    emb_list = emb.cpu().numpy()[0].tolist()

    # Predict attributes
    pred_color, pred_type, color_conf, type_conf = classify_attributes_from_embedding(emb)

    # Normalize user overrides (simple lowercasing)
    used_color = user_color.lower() if user_color else pred_color
    used_type = user_type.lower() if user_type else pred_type

    # snap user overrides to our vocab (if the user types in something that does not make sense, it wont mess up the results)
    def snap_to_vocab(value: str, vocab):
        if value is None:
            return None
        v = value.lower().strip()
        for item in vocab:
            if v == item:
                return item
        return v  # let DB handle mismatch or keep as-is

    used_color = snap_to_vocab(used_color, CLOTHING_COLORS) if used_color else None
    used_type = snap_to_vocab(used_type, CLOTHING_TYPES) if used_type else None

    # Call hybrid RPC (Remote Procedure Call) (PosgresSQL function that you can call from your backend as if it were an API endpoint)
    rpc_payload = {
        "query_embedding": emb_list,
        "match_count": k,
        "filter_color": used_color,
        "filter_garment_type": used_type,
    }

    response = supabase.rpc("match_embeddings_hybrid", rpc_payload).execute()

    return {
        "auto_detected": {
            "color": pred_color,
            "garment_type": pred_type,
            "color_confidence": color_conf,
            "garment_type_confidence": type_conf,
        },
        "used_filters": {
            "color": used_color,
            "garment_type": used_type,
        },
        "results": response.data,
    }
