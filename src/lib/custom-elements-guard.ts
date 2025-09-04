// src/lib/custom-elements-guard.ts
if (typeof window !== "undefined" && window.customElements) {
  const ce = window.customElements;
  const orig = ce.define.bind(ce);
  const definedElements = new Set<string>();
  
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
  
  console.log("🛡️ Custom elements guard initialized");
}