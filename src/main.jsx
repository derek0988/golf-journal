import React from "react";
import ReactDOM from "react-dom/client";
import GolfJournal from "./GolfJournal.jsx";

// The component was originally built as a Claude.ai artifact, which provides
// a `window.storage` API backed by Anthropic's servers. Outside that
// environment we shim the same interface using the browser's localStorage,
// so all data is saved on this device/browser only.
if (!window.storage) {
  const scoped = (key, shared) => (shared ? `shared:${key}` : `local:${key}`);

  window.storage = {
    async get(key, shared = false) {
      const raw = localStorage.getItem(scoped(key, shared));
      if (raw === null) return null;
      return { key, value: raw, shared };
    },
    async set(key, value, shared = false) {
      localStorage.setItem(scoped(key, shared), value);
      return { key, value, shared };
    },
    async delete(key, shared = false) {
      localStorage.removeItem(scoped(key, shared));
      return { key, deleted: true, shared };
    },
    async list(prefix = "", shared = false) {
      const p = scoped(prefix, shared);
      const keys = Object.keys(localStorage)
        .filter((k) => k.startsWith(p))
        .map((k) => k.slice(shared ? 7 : 6));
      return { keys, prefix, shared };
    },
  };
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GolfJournal />
  </React.StrictMode>
);
