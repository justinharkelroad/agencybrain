import outputsMap from "./outputs_addresses.json";
import { computeRounded, type WorkbookState, type CellAddr } from "./computeWithRounding";
import { formatValue } from "./format";
import { GRID_GOAL_ROWS } from "./rows";

export function SummaryGrid({ state, setState }:{ state: Record<CellAddr, any>; setState: (addr: CellAddr, val: any) => void }) {
  const rows = GRID_GOAL_ROWS;
  const addrs = [
    ...outputsMap.bonus_percent_preset,
    ...outputsMap.bonus_dollars,
    ...outputsMap.daily_points_needed,
    ...outputsMap.daily_items_needed,
  ] as CellAddr[];

  const vals = computeRounded({ inputs: state } as WorkbookState, addrs);

  // Custom formatting for bonus percentages - use row-based lookup to avoid floating point issues
  const formatBonusPercent = (row: number): string => {
    const exactPercentages: Record<number, string> = {
      38: "4.000%",
      39: "3.500%", 
      40: "2.900%",
      41: "2.000%",
      42: "1.100%",
      43: "0.550%",
      44: "0.050%"
    };
    return exactPercentages[row] || "0.000%";
  };

  return (
    <div className="rounded-xl overflow-hidden border border-border">
      <div className="grid grid-cols-[100px,1fr,1fr,1fr,1fr] text-xs px-4 py-2 bg-muted border-b border-border text-muted-foreground">
        <div>Goal Points</div><div>Bonus %</div><div>Bonus $</div><div>Daily Points</div><div>Daily Items</div>
      </div>
      <div className="divide-y divide-border">
        {rows.map(r=>{
          const goalAddr = `Sheet1!C${r}` as CellAddr;
          const goalVal = state[goalAddr] ?? "";
          
          return (
            <div key={r} className="grid grid-cols-[100px,1fr,1fr,1fr,1fr] px-4 py-2 text-sm">
              <div>
                <input
                  className="w-full border border-input rounded px-2 py-1 bg-background text-foreground"
                  inputMode="decimal"
                  value={goalVal}
                  onChange={e => setState(goalAddr, e.target.value)}
                />
              </div>
              <div className="text-foreground">{formatBonusPercent(r)}</div>
              <div className="text-foreground">{formatValue(`Sheet1!D${r}` as CellAddr, vals[`Sheet1!D${r}` as CellAddr])}</div>
              <div className="text-foreground">{formatValue(`Sheet1!K${r}` as CellAddr, vals[`Sheet1!K${r}` as CellAddr])}</div>
              <div className="text-foreground">{formatValue(`Sheet1!L${r}` as CellAddr, vals[`Sheet1!L${r}` as CellAddr])}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}