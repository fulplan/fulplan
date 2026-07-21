import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  appType: 'spa', // serve index.html for all unknown paths (e.g. /receipt/:id)
  server: {
    port: 5173,
  },
  build: {
    // Performance budget from Research-Notes.md: initial JS < 180KB gzipped.
    // Vite warns at 500KB raw by default — tighten it so regressions surface.
    chunkSizeWarningLimit: 400,
  },
});
