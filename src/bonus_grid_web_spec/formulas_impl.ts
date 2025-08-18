// formulas_impl.ts — stub evaluator, will be replaced with generated formulas
export type CellAddr = `${string}!${string}`;
export interface WorkbookState { inputs: Record<CellAddr, number | string | null>; }
export interface CalcContext { get(a: CellAddr): number; }

const impls: Record<CellAddr, (c: CalcContext) => number> = {}; // placeholder

class Resolver implements CalcContext {
  private cache = new Map<string, number>();
  constructor(private s: WorkbookState) {}
  get(a: CellAddr) {
    if (this.cache.has(a)) return this.cache.get(a)!;
    const v = this.s.inputs[a];
    if (typeof v === "number") { this.cache.set(a, v); return v; }
    if (typeof v === "string") {
      const n = Number(v.replace(/[%,$]/g, ""));
      if (!Number.isNaN(n)) { this.cache.set(a, n); return n; }
    }
    const fn = impls[a];
    const out = fn ? fn(this) : 0;
    this.cache.set(a, out);
    return out;
  }
}

export function computeSelected(s: WorkbookState, addrs: CellAddr[]) {
  const r = new Resolver(s);
  const o: Record<CellAddr, number> = {};
  for (const a of addrs) o[a] = r.get(a);
  return o;
}
export { impls as formulaImpls, Resolver };