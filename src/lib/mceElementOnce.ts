export async function ensureMceAutosizeRegistered() {
  if ((window as any).__mce_registered) return;
  if (!customElements.get("mce-autosize-textarea")) {
    // Guard against duplicate registrations - let the third-party bundle define it
    console.log("Waiting for mce-autosize-textarea to be defined by third-party bundle");
  }
  (window as any).__mce_registered = true;
}