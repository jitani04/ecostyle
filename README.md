# Sustainable Fashion Assistant

# Step 1: Clone the repository
* git clone https://github.com/jitani04/ecostyle.git

# Step 2: Navigate to the project directory
* cd ecostyle

# Step 3: Install the necessary dependencies
* npm install

# Step 4: Ensure you have the proper .env file 
To connect to the Supabase, it should have the following:
* VITE_SUPABASE_PROJECT_ID
* VITE_SUPABASE_PUBLISHABLE_KEY
* VITE_SUPABASE_URL
* SUPABASE_SECRET_KEY
* VITE_RECOMMEND_API_URL="http://localhost:8000/search"

Note: to access our database, please reach out and we can provide the keys

# Step 4: Start the development server 
The following commands use auto-reloading and provide an instant preview:
* cd frontend
* npm run build

After the build completes, the output will be in `frontend/dist/` 
In Chrome/Edge/Brave open Extensions -> Load unpacked and select the `frontend/dist/` folder.

# Step 4: Run the backend server
* cd backend
* create a python venv
    * python -m venv eco-venv
    * source eco-venv/bin/activate
* install dependencies from requirements.txt
    * pip install -r requirements.txt
* if you cant run the requirements.txt file, run these commands manually:
```
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install Pillow requests python-dotenv supabase ftfy regex timm
pip install git+https://github.com/openai/CLIP.git
pip install fastapi uvicorn
pip install python-multipart
pip install numpy==1.26.4
```

use these commands to run the backend:
* cd clothing-rec-program
* uvicorn CLIP_text_rec_backend:app --reload

go to the link to access the backend and test it out, click on the /search endpoint and upload an image of a product image:
* http://localhost:8000/docs

you can now go to your favorite online clothing website and test the extension out!

# This project is built with:

- Vite
- TypeScript
- React
- FastAPI
- Python
- shadcn-ui
- Tailwind CSS

# Final Presentation:
[Ecostyle Final Poster.pdf](https://github.com/user-attachments/files/24030850/Ecostyle.Final.Poster.pdf)

<img width="206" height="274" alt="EcoStyle" src="https://github.com/user-attachments/assets/b6373701-b128-4c29-b475-3b820248ea7d" />
