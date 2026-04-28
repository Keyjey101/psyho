import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/*.svg"],
      manifest: {
        name: "Ника — ИИ-психолог",
        short_name: "Ника",
        description: "ИИ-психолог: анонимно, без осуждения, 24/7",
        theme_color: "#B8785A",
        background_color: "#FAF6F1",
        display: "standalone",
        start_url: "/",
        lang: "ru",
        icons: [
          { src: "/icons/pwa-192.svg", sizes: "192x192", type: "image/svg+xml" },
          { src: "/icons/pwa-512.svg", sizes: "512x512", type: "image/svg+xml" },
          { src: "/icons/pwa-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" },
        ],
        categories: ["health", "lifestyle"],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,svg,woff2}"],
        globIgnores: ["illustrations/**", "icons/*.png"],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: "NetworkOnly",
          },
          {
            urlPattern: /^\/ws\//,
            handler: "NetworkOnly",
          },
          {
            urlPattern: /\/illustrations\//,
            handler: "CacheFirst",
            options: {
              cacheName: "illustrations",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ],
  envDir: path.resolve(__dirname, ".."),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "framer-motion": ["framer-motion"],
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
      },
    },
  },
});
