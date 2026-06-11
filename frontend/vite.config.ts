import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "favicon.png", "apple-touch-icon.png"],
      manifest: {
        name: "MindAnchor",
        short_name: "MindAnchor",
        description: "Your external brain — AI project manager, scrum master & calendar.",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        categories: ["productivity", "utilities"],
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Cache the app shell + static assets
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Navigation fallback — serve index.html for all SPA routes
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Cache API responses for 5 minutes (stale-while-revalidate)
            urlPattern: /^\/api\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "api-cache",
              expiration: { maxAgeSeconds: 300, maxEntries: 50 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
