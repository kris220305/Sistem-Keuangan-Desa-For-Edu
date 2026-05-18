import { createRoot } from "react-dom/client";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element not found");
}

const root = createRoot(rootEl);

import("./App.tsx")
  .then(({ default: App }) => {
    root.render(<App />);
  })
  .catch((err) => {
    console.error("Failed to load App:", err);
    root.render(
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f2a1e, #1a3a2b)",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: "100%",
            background: "rgba(255,255,255,0.92)",
            borderRadius: 16,
            padding: 20,
            fontFamily:
              "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Gagal memuat aplikasi
          </div>
          <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.5 }}>
            Terjadi kesalahan saat memuat aplikasi. Silakan refresh halaman atau periksa console untuk detail error.
          </div>
        </div>
      </div>
    );
  });
