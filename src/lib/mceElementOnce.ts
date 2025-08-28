export async function ensureMceAutosizeRegistered() {
  if ((window as any).__mce_registered) return;
  if (!customElements.get("mce-autosize-textarea")) {
    // Guard against duplicate registrations
    try {
      // Import the bundle exactly once
      await import(/* @vite-ignore */ "/overlay_bundle.js");
    } catch (error) {
      console.warn("Could not load mce overlay bundle:", error);
    }
  }
  (window as any).__mce_registered = true;
}