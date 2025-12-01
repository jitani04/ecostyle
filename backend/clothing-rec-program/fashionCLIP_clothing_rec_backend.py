import os
import torch
# import clip
import requests
from io import BytesIO
from PIL import Image
from supabase import create_client, Client
from dotenv import load_dotenv
import numpy as np

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from fashion_clip.fashion_clip import FashionCLIP # https://github.com/patrickjohncyh/fashion-clip

'''
HOW TO RUN:
* create a python virtual enviroment
* install these dependencies
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
    pip install Pillow requests python-dotenv supabase ftfy regex timm
dont need this anymore -> # pip install git+https://github.com/openai/CLIP.git
    pip install fastapi uvicorn
    pip install python-multipart

    # because of the results of clip (clothing items seemed to not match color), 
    # i decided to try out the fashionCLIP model instead
    pip install fashion-clip 

* use this command to run the backend:
    uvicorn fashionCLIP_clothing_rec_backend:app --reload

* go to the link to access the backend and test it out, click on the /search endpoint:
    http://localhost:8000/docs
'''

# load environment variables - getting secret key and url
print("Script Started") #test print to check if the script runs
load_dotenv()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")  # must use service key

if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env")

# create supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

# --- Load FashionCLIP ---
device = "cuda" if torch.cuda.is_available() else "cpu"
fclip = FashionCLIP("fashion-clip")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "ok"}

# note: fclip.encode_images() return a NumPy array, 
# not a torch tensor, and NumPy arrays dont have the .norm() function
# so we can normalize with NumPy instead
def compute_embedding(image: Image.Image):
    # with torch.no_grad():
    #     embedding = fclip.encode_images([image], batch_size=1)
    #     embedding = embedding / embedding.norm(dim=-1, keepdim=True)
    # return embedding.cpu().numpy().tolist()[0]

    embedding = fclip.encode_images([image], batch_size=1)

    # normalize using NumPy
    embedding = embedding / np.linalg.norm(embedding, ord=2, axis=-1, keepdims=True)

    return embedding[0].tolist()

@app.post("/search")
async def search(file: UploadFile = File(...), k: int = 3):
    img_bytes = await file.read()
    image = Image.open(BytesIO(img_bytes)).convert("RGB")

    query_embedding = compute_embedding(image)

    response = supabase.rpc(
        "match_embeddings",  # stored function name
        {"query_embedding": query_embedding, "match_count": k}
    ).execute()

    return response.data

# # --- Run it ---
# results = find_top_matches("pink-sweater.png")

# for item in results:
#     print(item["clothing_name"], item["image_url"], item["distance"])