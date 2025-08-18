import outputsMap from "./outputs_addresses.json";
import { computeRounded, type WorkbookState, type CellAddr } from "./computeWithRounding";
import { formatValue } from "./format";

export function SummaryGrid({ state }:{ state: Record<CellAddr, any> }) {
  const rows = [38,39,40,41,42,43,44];
  const addrs = [
    ...outputsMap.bonus_percent_preset,
    ...outputsMap.bonus_dollars,
    ...outputsMap.daily_points_needed,
    ...outputsMap.daily_items_needed,
  ] as CellAddr[];

  const vals = computeRounded({ inputs: state } as WorkbookState, addrs);

  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden">
      <div className="grid grid-cols-5 text-sm p-3 border-b border-white/10 text-white/70 bg-white/5">
        <div>Row</div><div>Bonus %</div><div>Bonus $</div><div>Daily Points</div><div>Daily Items</div>
      </div>
      <div className="divide-y divide-white/10">
        {rows.map(r=>(
          <div key={r} className="grid grid-cols-5 p-3">
            <div className="text-white/80">{r}</div>
            <div className="text-white/90">{formatValue(`Sheet1!H${r}` as CellAddr, vals[`Sheet1!H${r}` as CellAddr])}</div>
            <div className="text-white/90">{formatValue(`Sheet1!D${r}` as CellAddr, vals[`Sheet1!D${r}` as CellAddr])}</div>
            <div className="text-white/90">{formatValue(`Sheet1!K${r}` as CellAddr, vals[`Sheet1!K${r}` as CellAddr])}</div>
            <div className="text-white/90">{formatValue(`Sheet1!L${r}` as CellAddr, vals[`Sheet1!L${r}` as CellAddr])}</div>
          </div>
        ))}
      </div>
    </div>
  );
}