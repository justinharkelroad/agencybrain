// Prevent crashes when an imported bundle re-defines a custom element.
if (typeof window !== "undefined" && "customElements" in window) {
  const origDefine = window.customElements.define.bind(window.customElements);
  window.customElements.define = (name: string, ctor: CustomElementConstructor, opts?: ElementDefinitionOptions) => {
    if (name === "mce-autosize-textarea" && window.customElements.get(name)) return; // ignore re-define
    try { 
      origDefine(name, ctor, opts); 
    } catch (e) {
      const msg = String(e || "");
      if (name === "mce-autosize-textarea" && msg.includes("has already been defined")) return;
      throw e;
    }
  };
}