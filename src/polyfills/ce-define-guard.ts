// guard duplicate custom element definitions from third-party bundles
(() => {
  const orig = customElements.define.bind(customElements);
  (customElements as any).define = (name: string, ctor: any, opts?: any) => {
    if (customElements.get(name)) return; // skip duplicates silently
    try { return orig(name, ctor, opts); } catch { /* ignore duplicate */ }
  };
})();