// src/lib/custom-elements-guard.ts
if (typeof window !== "undefined" && window.customElements) {
  const ce = window.customElements;
  const orig = ce.define.bind(ce);
  const definedElements = new Set<string>();
  const onceKey = "__MCE_AUTOSIZE_DEFINED__";

  // Enhanced guard: Pre-define mce-autosize-textarea to prevent conflicts
  if (!customElements.get('mce-autosize-textarea')) {
    try {
      customElements.define('mce-autosize-textarea', class extends HTMLElement {});
      (window as any)[onceKey] = true;
      console.log("🛡️ Pre-defined mce-autosize-textarea to prevent conflicts");
    } catch (e) {
      console.log("🛡️ mce-autosize-textarea definition blocked (already exists):", e);
      (window as any)[onceKey] = true;
    }
  } else {
    (window as any)[onceKey] = true;
    console.log("🛡️ mce-autosize-textarea already exists");
  }
  
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
        console.log(`🛡️ Custom element '${name}' definition blocked (already exists):`, errorMsg);
        definedElements.add(name);
        return;
      }
      console.error(`❌ Failed to define custom element '${name}':`, e);
      throw e;
    }
  };
  
  console.log("🛡️ Custom elements guard initialized with mce-autosize-textarea protection");
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