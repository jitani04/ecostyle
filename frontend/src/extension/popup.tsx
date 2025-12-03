import React from "react";
import { createRoot } from "react-dom/client";
import { ExtensionPopup } from "@/components/extension/ExtensionPopup";
import "@/index.css";

// Keep only the Close button for the toolbar popup. Opening a separate window was removed.

const closePopup = () => {
  try {
    // For extension popup this will close the popup
    window.close();
  } catch (e) {
    console.error("Failed to close popup", e);
  }
};

const rootEl = document.getElementById("root");

if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, justifyContent: "flex-end" }}>
          <button
            onClick={closePopup}
            style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#ef4444", color: "white", cursor: "pointer", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}
            title="Close"
          >
            ×
          </button>
        </div>

        <ExtensionPopup />
    </React.StrictMode>
  );
} else {
  console.error("Popup root element not found");
}
