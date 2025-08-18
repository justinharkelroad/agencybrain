import outputsMap from "./outputs_addresses.json";
import { computeRounded, type WorkbookState, type CellAddr } from "./computeWithRounding";
import { formatValue } from "./format";

export function SummaryGrid({ state }:{ state: Record<CellAddr, any> }) {
  const rows = [38,39,40,41,42,43,44] as const;
  const addrs = [
    ...outputsMap.bonus_percent_preset,
    ...outputsMap.bonus_dollars,
    ...outputsMap.daily_points_needed,
    ...outputsMap.daily_items_needed,
  ] as CellAddr[];

  const vals = computeRounded({ inputs: state } as WorkbookState, addrs);

  return (
    <div className="rounded-xl overflow-hidden border border-border">
      <div className="grid grid-cols-[80px,1fr,1fr,1fr,1fr] text-xs px-4 py-2 bg-muted border-b border-border text-muted-foreground">
        <div>Row</div><div>Bonus %</div><div>Bonus $</div><div>Daily Points</div><div>Daily Items</div>
      </div>
      <div className="divide-y divide-border">
        {rows.map(r=>(
          <div key={r} className="grid grid-cols-[80px,1fr,1fr,1fr,1fr] px-4 py-2 text-sm">
            <div className="text-muted-foreground">{r}</div>
            <div className="text-foreground">{formatValue(`Sheet1!H${r}` as CellAddr, vals[`Sheet1!H${r}` as CellAddr])}</div>
            <div className="text-foreground">{formatValue(`Sheet1!D${r}` as CellAddr, vals[`Sheet1!D${r}` as CellAddr])}</div>
            <div className="text-foreground">{formatValue(`Sheet1!K${r}` as CellAddr, vals[`Sheet1!K${r}` as CellAddr])}</div>
            <div className="text-foreground">{formatValue(`Sheet1!L${r}` as CellAddr, vals[`Sheet1!L${r}` as CellAddr])}</div>
          </div>
        ))}
      </div>
    </div>
  );
}