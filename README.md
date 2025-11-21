# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/acc23f20-fb6f-46e1-8c6d-571298da26cd

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/acc23f20-fb6f-46e1-8c6d-571298da26cd) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

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

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/acc23f20-fb6f-46e1-8c6d-571298da26cd) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Browser extension build / load instructions

This repo includes a basic Chromium/Firefox extension manifest at `public/manifest.json` and minimal placeholders for a popup and content script. Use the following to build and load the extension locally:

1. Install deps and build the app:

```
npm install
npm run build
```

2. After the build completes, the output will be in `dist/` (Vite default). In Chrome/Edge/Brave open Extensions -> Load unpacked and select the `dist/` folder.

3. In Firefox use `about:debugging` -> This Firefox -> Load Temporary Add-on and choose `dist/manifest.json`.

Notes:
- The manifest currently uses `popup.html` (in `public/`) for the action popup and `content-script.js` / `content-styles.css` as a small placeholder content script. You can replace these with your built bundle entrypoints or wire Vite to build separate entry points if you want a reactive popup bundled by Vite.
- Icons are using `public/placeholder.svg`. Replace with proper PNG/WebP images for best compatibility.

If you want, I can:
- Wire a dedicated Vite entry for the extension popup and background worker so the built `dist/` contains a bundled JS/CSS popup.
- Add a small background service worker to the manifest and a demo message flow between popup <-> content script.

