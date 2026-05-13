import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register the PWA service worker so the browser treats this site as
// installable and emits `beforeinstallprompt`. The SW itself is pass-through
// (see client/public/sw.js) — we want install eligibility without offline
// caching while data + auth flows are still evolving.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => {
        // Don't crash the app if registration fails (older browsers, mixed
        // content, etc.). The install button will simply stay hidden.
        console.warn("Service worker registration failed:", err);
      });
  });
}
