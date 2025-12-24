import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";

/**
 * PWA Update Prompt Component
 * 
 * Shows a non-intrusive toast when a new service worker is available.
 * Users can click to refresh and get the latest version.
 * 
 * This uses registerType: "prompt" so updates don't auto-activate,
 * giving users control over when to update.
 */
export function PWAUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      console.log("[PWA] Service worker registered:", registration);
    },
    onRegisterError(error) {
      console.error("[PWA] Service worker registration error:", error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      setShowPrompt(true);
    }
  }, [needRefresh]);

  const handleUpdate = async () => {
    try {
      await updateServiceWorker(true);
      // The page will reload automatically after skipWaiting
    } catch (error) {
      console.error("[PWA] Failed to update service worker:", error);
      // Fallback: force reload
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setNeedRefresh(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <RefreshCw className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Update available
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              A new version of Agency Brain is ready.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDismiss}
            className="flex-1"
          >
            Later
          </Button>
          <Button
            size="sm"
            onClick={handleUpdate}
            className="flex-1"
          >
            <RefreshCw className="h-3 w-3 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Rollback Instructions:
 * 
 * To completely remove PWA support:
 * 
 * 1. Remove vite-plugin-pwa from vite.config.ts
 * 2. Delete this component (PWAUpdatePrompt.tsx)
 * 3. Remove the PWAUpdatePrompt import from App.tsx
 * 4. Delete public/manifest.webmanifest (keep manifest.json if needed for other purposes)
 * 5. Remove PWA-related meta tags from index.html
 * 
 * To unregister service worker (run in browser console):
 * 
 * navigator.serviceWorker.getRegistrations().then(function(registrations) {
 *   for(let registration of registrations) {
 *     registration.unregister();
 *     console.log('Service worker unregistered:', registration);
 *   }
 * }).then(function() {
 *   caches.keys().then(function(names) {
 *     for (let name of names) {
 *       caches.delete(name);
 *       console.log('Cache deleted:', name);
 *     }
 *   });
 * }).then(function() {
 *   console.log('All service workers unregistered and caches cleared. Reload the page.');
 * });
 */
