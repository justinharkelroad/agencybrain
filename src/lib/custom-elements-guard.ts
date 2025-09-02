// BULLETPROOF CUSTOM ELEMENT GUARD
// This must be imported FIRST before any other code that might register custom elements

if (typeof window !== "undefined" && window.customElements) {
  const ce = window.customElements;
  const orig = ce.define.bind(ce);
  
  ce.define = (name: string, ctor: CustomElementConstructor, opts?: ElementDefinitionOptions) => {
    if (name === "mce-autosize-textarea" && ce.get(name)) {
      console.log(`🛡️ Ignoring duplicate registration of ${name}`);
      return; // ignore duplicates
    }
    
    try { 
      return orig(name, ctor, opts); 
    } catch (e: any) {
      if (name === "mce-autosize-textarea" && String(e).includes("already been defined")) {
        console.log(`🛡️ Caught and ignored duplicate definition error for ${name}`);
        return;
      }
      throw e;
    }
  };
  
  console.log("🛡️ Custom element guard initialized");
}

export function ensureMceAutosizeRegistered() {
  if ((window as any).__mce_registered) return;
  
  // Just check if it exists - the third-party bundle will define it
  if (!customElements.get("mce-autosize-textarea")) {
    console.log("⏳ Waiting for mce-autosize-textarea to be defined by third-party bundle");
  }
  
  (window as any).__mce_registered = true;
}