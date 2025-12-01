import os
import torch
import clip
import requests
from io import BytesIO
from PIL import Image
from supabase import create_client, Client
from dotenv import load_dotenv

FORCE_REGEN = True  # set to False after first successful run

# ---------------------------------------------------
# ENV + SUPABASE SETUP
# ---------------------------------------------------
print("Script Started")
load_dotenv()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

# ---------------------------------------------------
# CLIP SETUP (UPGRADED MODEL)
# ---------------------------------------------------
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")

model, preprocess = clip.load("ViT-B/16", device=device)
model.eval()

# ---------------------------------------------------
# LABEL VOCABULARIES
# ---------------------------------------------------
CLOTHING_COLORS = [
    "black", "white", "gray", "red", "blue", "green",
    "yellow", "pink", "purple", "brown", "beige", "orange"
]

CLOTHING_TYPES = [
    "t-shirt", "long sleeve shirt", "sweater", "hoodie",
    "jacket", "coat", "dress", "skirt", "jeans",
    "pants", "shorts", "blouse", "cardigan"
]

# ---------------------------------------------------
# BUILD TEXT EMBEDDINGS (ONCE)
# ---------------------------------------------------
def build_label_embeddings(labels, template):
    texts = [template.format(label) for label in labels]
    with torch.no_grad():
        tokens = clip.tokenize(texts).to(device)
        text_emb = model.encode_text(tokens)
        text_emb = text_emb / text_emb.norm(dim=-1, keepdim=True)
    return text_emb

COLOR_TEXT_EMB = build_label_embeddings(
    CLOTHING_COLORS,
    "a photo of a {} clothing item"
)

TYPE_TEXT_EMB = build_label_embeddings(
    CLOTHING_TYPES,
    "a photo of a {}"
)

# ---------------------------------------------------
# IMAGE ENCODE + ATTRIBUTE CLASSIFICATION
# ---------------------------------------------------
def encode_and_classify_image(url: str):
    """Returns (embedding_list, color, garment_type)."""
    response = requests.get(url, timeout=10)
    response.raise_for_status()

    img = Image.open(BytesIO(response.content)).convert("RGB")
    img_tensor = preprocess(img).unsqueeze(0).to(device)

    with torch.no_grad():
        image_emb = model.encode_image(img_tensor)
        image_emb = image_emb / image_emb.norm(dim=-1, keepdim=True)

        # ---- GARMENT TYPE ----
        sim_types = (image_emb @ TYPE_TEXT_EMB.T)[0]
        type_probs = sim_types.softmax(dim=0)
        type_idx = int(type_probs.argmax().item())
        garment_type = CLOTHING_TYPES[type_idx]

        # ---- COLOR ----
        sim_colors = (image_emb @ COLOR_TEXT_EMB.T)[0]
        color_probs = sim_colors.softmax(dim=0)
        color_idx = int(color_probs.argmax().item())
        color = CLOTHING_COLORS[color_idx]

    embedding_list = image_emb.cpu().numpy()[0].tolist()
    return embedding_list, color, garment_type


# ---------------------------------------------------
# MAIN SCRIPT
# ---------------------------------------------------
def main():
    print("Starting embedding + attribute script")

    print("Fetching clothing_items rows...")
    result = supabase.table("clothing_items") \
        .select("clothing_id, image_url, embedding") \
        .execute()

    rows = result.data
    print(f"Found {len(rows)} rows.\n")

    for row in rows:
        item_id = row["clothing_id"]
        image_url = row["image_url"]
        existing_emb = row.get("embedding")

        if existing_emb is not None and not FORCE_REGEN:
            print(f"[SKIP] clothing_id={item_id}: embedding already exists.")
            continue

        print(f"[PROCESS] clothing_id={item_id}")
        print(f"          {image_url}")

        try:
            embedding, color, garment_type = encode_and_classify_image(image_url)
        except Exception as e:
            print(f"[ERROR] Failed to process clothing_id={item_id}: {e}")
            continue

        try:
            supabase.table("clothing_items") \
                .update({
                    "embedding": embedding,
                    "color": color,
                    "garment_type": garment_type
                }) \
                .eq("clothing_id", item_id) \
                .execute()

            print(
                f"[OK] Stored for clothing_id={item_id} "
                f"| color={color} | type={garment_type}\n"
            )

        except Exception as e:
            print(f"[ERROR] Supabase update failed for clothing_id={item_id}: {e}")

    print("✅ Done generating embeddings + attributes!")


# ---------------------------------------------------
# RUN
# ---------------------------------------------------
if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("Script error:", e)