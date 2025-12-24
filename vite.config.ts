import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Disable overlay in development to prevent custom element conflicts
    hmr: {
      overlay: false
    }
  },
  optimizeDeps: {
    exclude: ["lamejs"]
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    // PWA Plugin - Production-safe configuration
    // Uses "prompt" registerType so updates don't auto-activate
    // Explicitly excludes Supabase URLs from service worker handling
    VitePWA({
      registerType: "prompt",
      // Only include in production builds to avoid dev issues
      injectRegister: mode === "production" ? "auto" : null,
      // Use the webmanifest we created
      manifest: false, // We're using our own manifest.webmanifest
      // Workbox configuration - CONSERVATIVE settings
      workbox: {
        // Clean up old caches on update
        cleanupOutdatedCaches: true,
        // Only cache static assets, not API calls
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        // CRITICAL: Exclude Supabase and API routes from ALL fetch handling
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          // Supabase URLs - exact project
          /^.*wjqyccbytctqwceuhzhk\.supabase\.co.*/,
          // Generic Supabase patterns
          /^.*\.supabase\.co.*/,
          /^.*supabase.*/i,
          // API paths
          /^\/api\/.*/,
          /^\/auth\/.*/,
          /^\/rest\/.*/,
          /^\/functions\/.*/,
          /^\/storage\/.*/,
          // Realtime websocket
          /^\/realtime\/.*/,
        ],
        // Runtime caching - minimal and safe
        runtimeCaching: [
          {
            // Cache static assets with network-first strategy (safe)
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
          {
            // Cache fonts with cache-first (they rarely change)
            urlPattern: /\.(?:woff|woff2|ttf|otf|eot)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "fonts-cache",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
        // CRITICAL: Skip waiting is controlled by the user via PWAUpdatePrompt
        skipWaiting: false,
        clientsClaim: false,
      },
      // Development options
      devOptions: {
        enabled: false, // Disable in dev to avoid issues
        type: "module",
      },
    }),
  ].filter(Boolean),
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __APP_VERSION__: JSON.stringify("stable-1"),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
