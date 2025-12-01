import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        popup: path.resolve(__dirname, "popup.html"),
  // extension entry points (background & content script)
  background: path.resolve(__dirname, "src/extension/background.tsx"),
  "content-script": path.resolve(__dirname, "src/extension/content-script.tsx"),
      },
      output: {
        // emit entry files with stable names at dist/ so manifest can refer to them directly
        entryFileNames: (chunk) => {
          // keep HTML entries handled separately; name entries by their input key
          return `${chunk.name}.js`;
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
