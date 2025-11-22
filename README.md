# Sustainable Fashion Assistant

# Step 1: Clone the repository using the project's Git URL.
git clone https://github.com/jitani04/eco-wardrobe.git

# Step 2: Navigate to the project directory.
cd eco-wardrobe

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Browser extension build / load instructions

This repo includes a basic Chromium/Firefox extension manifest at `public/manifest.json` and minimal placeholders for a popup and content script. Use the following to build and load the extension locally:

1. Install deps and build the app:

```
npm install
npm run build
```

2. After the build completes, the output will be in `dist/` (Vite default). In Chrome/Edge/Brave open Extensions -> Load unpacked and select the `dist/` folder.