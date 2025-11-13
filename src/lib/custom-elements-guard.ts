// src/lib/custom-elements-guard.ts
if (typeof window !== "undefined" && window.customElements) {
  const ce = window.customElements;
  const orig = ce.define.bind(ce);
  const definedElements = new Set<string>();
  
  // Idempotent wrapper - NO pre-definition
  ce.define = (name: string, ctor: CustomElementConstructor, opts?: ElementDefinitionOptions) => {
    // Idempotent define with enhanced protection
    if (definedElements.has(name) || ce.get(name)) {
      console.log(`🛡️ Custom element '${name}' already defined, skipping redefinition`);
      return;
    }
    
    try {
      const result = orig(name, ctor, opts);
      definedElements.add(name);
      console.log(`✅ Custom element '${name}' defined successfully`);
      return result;
    } catch (e: any) {
      const errorMsg = String(e);
      if (errorMsg.includes("already been defined") || errorMsg.includes("already defined")) {
        console.log(`🛡️ Custom element '${name}' definition blocked (already exists)`);
        definedElements.add(name);
        return; // Suppress error
      }
      console.error(`❌ Failed to define custom element '${name}':`, e);
      throw e; // Re-throw unexpected errors
    }
  };
  
  console.log("🛡️ Custom elements guard initialized");
}

// Global error suppression for known custom element conflicts
if (typeof window !== "undefined") {
  window.addEventListener('error', (event) => {
    const errorMsg = event.message || '';
    if (errorMsg.includes('custom element') && errorMsg.includes('already been defined')) {
      console.log('🛡️ Suppressed known custom element redefinition error:', errorMsg);
      event.preventDefault(); // Suppress the error from console
    }
  }, true); // Use capture phase to catch early
}

// Singleflight overlay loader to prevent multiple loads
let overlayPromise: Promise<any> | null = null;
export async function loadOverlayOnce(): Promise<any> {
  if (overlayPromise) {
    console.log("🛡️ Overlay already loading/loaded, reusing promise");
    return overlayPromise;
  }
  
  overlayPromise = (async () => {
    console.log("📦 Loading overlay bundle once...");
    // Singleflight pattern - only one load ever
    // await import("@/editor/overlay_bundle"); // Add when needed
    return {};
  })();
  
  return overlayPromise;
}