// BULLETPROOF CUSTOM ELEMENT GUARD
// This must be imported FIRST before any other code that might register custom elements

(function() {
  if (typeof window === "undefined") return;
  
  const ce = window.customElements;
  if (!ce) return;

  // Check if we've already set up the guard
  if ((window as any).__custom_element_guard_initialized__) return;

  // Track which elements have been registered
  const registeredElements = new Set<string>();

  // Store original define method
  const originalDefine = ce.define.bind(ce);

  // Override the define method to prevent duplicates
  ce.define = function(name: string, constructor: CustomElementConstructor, options?: ElementDefinitionOptions) {
    // If already registered, silently ignore
    if (registeredElements.has(name)) {
      console.warn(`Custom element "${name}" already registered, ignoring duplicate registration`);
      return;
    }

    // Check if already defined in the registry
    if (ce.get(name)) {
      console.warn(`Custom element "${name}" already exists in registry, ignoring duplicate registration`);
      registeredElements.add(name);
      return;
    }

    try {
      // Register the element
      originalDefine(name, constructor, options);
      registeredElements.add(name);
      console.log(`✅ Registered custom element: ${name}`);
    } catch (error) {
      console.error(`❌ Failed to register custom element "${name}":`, error);
    }
  };

  // Mark guard as initialized
  (window as any).__custom_element_guard_initialized__ = true;
  console.log("🛡️ Custom element guard initialized");
})();

export function ensureMceAutosizeRegistered() {
  if ((window as any).__mce_registered) return;
  
  // Just check if it exists - the third-party bundle will define it
  if (!customElements.get("mce-autosize-textarea")) {
    console.log("⏳ Waiting for mce-autosize-textarea to be defined by third-party bundle");
  }
  
  (window as any).__mce_registered = true;
}