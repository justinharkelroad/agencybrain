if (typeof window !== "undefined") {
  const ce = window.customElements;
  if (ce) {
    const already = ce.get("mce-autosize-textarea");
    if (!already) {
      // do nothing here – the editor bundle will define it.
    } else {
      // harden define to ignore duplicate registrations for this tag
      const origDefine = ce.define.bind(ce);
      ce.define = (name: string, ctor: CustomElementConstructor, options?: ElementDefinitionOptions) => {
        if (name === "mce-autosize-textarea" && ce.get(name)) return; // swallow duplicate
        return origDefine(name, ctor, options);
      };
    }
  }
}