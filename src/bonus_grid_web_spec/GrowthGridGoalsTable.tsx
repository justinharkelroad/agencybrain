import { GRID_GOAL_ROWS, type CellAddr } from "./rows";

export function GrowthGridGoalsTable({ 
  state, 
  setState 
}: {
  state: Record<CellAddr, any>;
  setState: (addr: CellAddr, val: any) => void;
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-border">
      <div className="grid grid-cols-[100px,1fr] text-xs px-4 py-3 bg-muted border-b border-border text-muted-foreground font-medium">
        <div>Row</div>
        <div>Goal Points</div>
      </div>
      <div className="divide-y divide-border">
        {GRID_GOAL_ROWS.map(row => {
          const addr = `Sheet1!C${row}` as CellAddr;
          const val = state[addr] ?? "";

          return (
            <div key={row} className="grid grid-cols-[100px,1fr] px-4 py-3 text-sm">
              <div className="text-muted-foreground">{row}</div>
              <div>
                <input
                  className="w-full border border-input rounded px-2 py-1 bg-background text-foreground"
                  inputMode="decimal"
                  value={val}
                  onChange={e => setState(addr, e.target.value)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}