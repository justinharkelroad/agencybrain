if (typeof window !== "undefined" && window.customElements) {
  const ce = window.customElements;
  const orig = ce.define.bind(ce);
  ce.define = (name: string, ctor: CustomElementConstructor, opts?: ElementDefinitionOptions) => {
    if (name === "mce-autosize-textarea" && ce.get(name)) return; // ignore any re-define
    try { return orig(name, ctor, opts); } catch (e: any) {
      if (name === "mce-autosize-textarea" && String(e).includes("already been defined")) return;
      throw e;
    }
  };
}