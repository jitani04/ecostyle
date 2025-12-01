# Sustainable Fashion Assistant

# Step 1: Clone the repository using the project's Git URL.
git clone https://github.com/jitani04/eco-wardrobe.git

# Step 2: Navigate to the project directory.
cd ecostyle

# Step 3: Install the necessary dependencies.
npm install

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run build

After the build completes, the output will be in `frontend/dist/` In Chrome/Edge/Brave open Extensions -> Load unpacked and select the `frontend/dist/` folder.


# Step 4: Run the backend server
install dependencies from requirements.txt
pip install -r requirements.txt

use this command to run the backend:
uvicorn CLIP_text_rec_backend:app --reload

go to the link to access the backend and test it out, click on the /search endpoint and upload an image of a product image:
    http://localhost:8000/docs

# This project is built with:

- Vite
- TypeScript
- React
- FastAPI
- Python
- shadcn-ui
- Tailwind CSS
