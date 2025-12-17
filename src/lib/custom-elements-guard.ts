// src/lib/custom-elements-guard.ts
// GLOBAL LOCK: Prevent multiple guard initializations
if (typeof window !== "undefined") {
  // Pre-register problematic custom elements FIRST before any other code runs
  const MCE_KEY = "__MCE_AUTOSIZE_DEFINED__";
  if (window.customElements && !window.customElements.get("mce-autosize-textarea") && !(window as any)[MCE_KEY]) {
    try {
      window.customElements.define("mce-autosize-textarea", class extends HTMLElement {});
      (window as any)[MCE_KEY] = true;
      if (import.meta.env.DEV) {
        console.log("🛡️ Pre-defined mce-autosize-textarea");
      }
    } catch (e) {
      // Already defined, that's fine
    }
  }
  const GUARD_KEY = '__customElementsGuardInitialized__';
  
  if (!(window as any)[GUARD_KEY]) {
    // Mark as initialized IMMEDIATELY
    Object.defineProperty(window, GUARD_KEY, {
      value: true,
      writable: false,
      configurable: false,
    });

    if (window.customElements) {
      const ce = window.customElements;
      const orig = ce.define.bind(ce);
      const definedElements = new Set<string>();
      
      // Immutable override
      try {
        Object.defineProperty(ce, 'define', {
          value: (name: string, ctor: CustomElementConstructor, opts?: ElementDefinitionOptions) => {
            // Idempotent define with enhanced protection
            if (definedElements.has(name) || ce.get(name)) {
              if (import.meta.env.DEV) {
                console.log(`🛡️ Custom element '${name}' already defined, skipping redefinition`);
              }
              return;
            }
            
            try {
              const result = orig(name, ctor, opts);
              definedElements.add(name);
              if (import.meta.env.DEV) {
                console.log(`✅ Custom element '${name}' defined successfully`);
              }
              return result;
            } catch (e: any) {
              const errorMsg = String(e);
              if (errorMsg.includes("already been defined") || errorMsg.includes("already defined")) {
                if (import.meta.env.DEV) {
                  console.log(`🛡️ Custom element '${name}' definition blocked (already exists)`);
                }
                definedElements.add(name);
                return; // Suppress error
              }
              if (import.meta.env.DEV) {
                console.error(`❌ Failed to define custom element '${name}':`, e);
              }
              throw e; // Re-throw unexpected errors
            }
          },
          writable: false,
          configurable: false,
        });
        
        if (import.meta.env.DEV) {
          console.log("🛡️ Custom elements guard initialized with immutable protection");
        }
      } catch (guardError) {
        // Fallback if Object.defineProperty fails
        console.warn("⚠️ Could not make custom element guard immutable, using regular override");
      }
    }
  } else {
    if (import.meta.env.DEV) {
      console.log("🛡️ Custom elements guard already initialized, skipping");
    }
  }
}

// Global error suppression for known custom element conflicts
if (typeof window !== "undefined") {
  const ERROR_HANDLER_KEY = '__customElementErrorHandlerInstalled__';
  
  if (!(window as any)[ERROR_HANDLER_KEY]) {
    (window as any)[ERROR_HANDLER_KEY] = true;
    
    window.addEventListener('error', (event) => {
      const errorMsg = event.message || '';
      if (errorMsg.includes('custom element') && errorMsg.includes('already been defined')) {
        if (import.meta.env.DEV) {
          console.log('🛡️ Suppressed known custom element redefinition error:', errorMsg);
        }
        event.preventDefault(); // Suppress the error from console
        event.stopImmediatePropagation();
        return false;
      }
    }, true); // Use capture phase to catch early
  }
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