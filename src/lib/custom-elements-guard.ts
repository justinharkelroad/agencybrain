// src/lib/custom-elements-guard.ts
if (typeof window !== "undefined" && window.customElements) {
  const ce = window.customElements;
  const orig = ce.define.bind(ce);
  const definedElements = new Set<string>();
  const onceKey = "__MCE_AUTOSIZE_DEFINED__";

  // Pre-define mce-autosize-textarea to prevent conflicts
  if (!ce.get("mce-autosize-textarea")) {
    ce.define("mce-autosize-textarea", class extends HTMLElement {});
    (window as any)[onceKey] = true;
    console.log("🛡️ Pre-defined mce-autosize-textarea to prevent conflicts");
  } else {
    (window as any)[onceKey] = true;
    console.log("🛡️ mce-autosize-textarea already exists");
  }
  
  ce.define = (name: string, ctor: CustomElementConstructor, opts?: ElementDefinitionOptions) => {
    // Enhanced protection for multiple definition attempts
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

// Singleton overlay loader to prevent multiple loads
let overlayLoaded = false;
export async function loadOverlayOnce() {
  if (overlayLoaded) {
    console.log("🛡️ Overlay already loaded, skipping");
    return;
  }
  overlayLoaded = true;
  console.log("📦 Loading overlay bundle once...");
  
  // Note: Add actual overlay import here when needed
  // await import("@/editor/overlay_bundle");
}