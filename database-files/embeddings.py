import os
import torch
import clip
import requests
from io import BytesIO
from PIL import Image
from supabase import create_client, Client
from dotenv import load_dotenv

# -------------------------
# Load environment variables
# -------------------------
print("Script Started")
load_dotenv()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")  # must use service key

if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env")

# -------------------------
# Create Supabase Admin Client
# -------------------------
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

# -------------------------
# Load CLIP model
# -------------------------
device = "cuda" if torch.cuda.is_available() else "cpu"
model, preprocess = clip.load("ViT-B/32", device=device)


def encode_image(url: str):
    """Download image and return normalized 512-d CLIP embedding."""
    response = requests.get(url, timeout=10)
    img = Image.open(BytesIO(response.content)).convert("RGB")
    
    img_tensor = preprocess(img).unsqueeze(0).to(device)
    with torch.no_grad():
        embedding = model.encode_image(img_tensor)
    
    # Normalize L2
    embedding = embedding / embedding.norm(dim=-1, keepdim=True)
    return embedding.cpu().numpy()[0].tolist()


def ensure_embedding_column():
    """Create embedding column if it doesn't exist."""
    sql = "ALTER TABLE clothing_items ADD COLUMN IF NOT EXISTS embedding vector(512);"
    supabase.postgrest.rpc("exec", {"sql": sql})
    print("'embedding' column ensured.")


def main():
    print("Starting embedding script...")

    # 0. Ensure embedding column exists
    ensure_embedding_column()

    # 1. Fetch rows from Supabase
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

        # Skip already processed rows
        if existing_emb is not None:
            print(f"[SKIP] clothing_id={item_id}: embedding already exists.")
            continue

        print(f"[PROCESS] clothing_id={item_id} — {image_url}")

        # 2. Encode image
        try:
            embedding = encode_image(image_url)
        except Exception as e:
            print(f"[ERROR] Could not encode clothing_id={item_id}: {e}")
            continue

        # 3. Update row with embedding
        try:
            supabase.table("clothing_items") \
                .update({"embedding": embedding}) \
                .eq("clothing_id", item_id) \
                .execute()
            print(f"[OK] Stored embedding for clothing_id={item_id}\n")
        except Exception as e:
            print(f"[ERROR] Supabase update failed for clothing_id={item_id}: {e}")

    print("Done generating embeddings!")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("Script error:", e)
