import { computeSelected, type WorkbookState, type CellAddr } from "./formulas_impl";
import roundingPolicy from "./rounding_policy.json";
import { roundByType } from "./rounding";

export type { WorkbookState, CellAddr };

type Policy = Record<string, { type: any; digits: number }>;

export function computeRounded(state: WorkbookState, addrs: CellAddr[]): Record<CellAddr, number> {
  const raw = computeSelected(state, addrs);
  const rp: Policy = roundingPolicy as any;
  const out: Record<CellAddr, number> = {};
  for (const a of addrs) {
    const v = raw[a] ?? 0;
    const p = rp[a as string];
    if (p) {
      out[a] = Number(roundByType(v, p.type, p.digits).toString());
    } else {
      out[a] = v;
    }
  }
  return out;
}