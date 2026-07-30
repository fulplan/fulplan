import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // Cache the app shell and assets; everything else goes network-first
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            // tRPC API — network-first so live data is always fresh
            urlPattern: /\/trpc\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "trpc-cache",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 },
            },
          },
        ],
      },
      manifest: {
        name: "Uptilll",
        short_name: "Uptilll",
        description: "Uptilll — offline-capable retail POS for Ghana",
        theme_color: "#37352f",
        background_color: "#ffffff",
        display: "standalone",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  appType: "spa",
  server: {
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 400,
  },
});
