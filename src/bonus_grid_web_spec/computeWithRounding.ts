import { computeSelected, type WorkbookState, type CellAddr } from "./formulas_impl";

export type { WorkbookState, CellAddr };

export function computeRounded(state: WorkbookState, addrs: CellAddr[]) {
  return computeSelected(state, addrs); // rounding logic will be added later
}