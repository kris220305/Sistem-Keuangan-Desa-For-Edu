import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const enableComponentTagger = process.env.VITE_ENABLE_COMPONENT_TAGGER === "true";

export default defineConfig(async ({ mode }) => {
  const taggerPlugin = mode === "development" && enableComponentTagger
    ? (await import("lovable-tagger")).componentTagger()
    : null;

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    optimizeDeps: {
      entries: ["index.html"],
      include: [
        "@radix-ui/react-progress",
        "@radix-ui/react-popover",
        "cmdk",
        "@radix-ui/react-tooltip",
      ],
    },
    plugins: [react(), taggerPlugin].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
            charts: ['recharts'],
            forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
  };
});
