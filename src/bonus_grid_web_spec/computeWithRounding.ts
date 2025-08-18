import { computeSelected, type WorkbookState, type CellAddr } from "./formulas_impl";
import roundingPolicy from "./rounding_policy.json";
import { roundByType } from "./rounding";

export type { WorkbookState, CellAddr };

type Policy = Record<string, { type: any; digits: number }>;
const isFiniteNum = (v: any) => typeof v === "number" && Number.isFinite(v);

export function computeRounded(state: WorkbookState, addrs: CellAddr[]): Record<CellAddr, number> {
  const raw = computeSelected(state, addrs);
  const rp: Policy = roundingPolicy as any;
  const out: Record<CellAddr, number> = {};
  for (const a of addrs) {
    const v0 = raw[a];
    const v = isFiniteNum(v0) ? v0 : 0;                  // sanitize NaN/∞ → 0
    const p = rp[a as string];
    out[a] = p ? Number(roundByType(v, p.type, p.digits).toString()) : v;
  }
  return out;
}