import { BASELINE_ROWS, type CellAddr } from "./rows";
import { formatValue } from "./format";

export function BaselineTable({ 
  state, 
  setState, 
  computedValues 
}: {
  state: Record<CellAddr, any>;
  setState: (addr: CellAddr, val: any) => void;
  computedValues: Record<CellAddr, number>;
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-border">
      <div className="grid grid-cols-[1fr,100px,100px,120px,100px,100px] text-xs px-4 py-3 bg-muted border-b border-border text-muted-foreground font-medium">
        <div>Product</div>
        <div># Items</div>
        <div>PPI</div>
        <div>Retention %</div>
        <div>Total Points</div>
        <div>Point Loss</div>
      </div>
      <div className="divide-y divide-border">
        {BASELINE_ROWS.map(row => {
          const itemsVal = state[row.items] ?? "";
          const retentionVal = state[row.retention] ?? "";
          // PPI is now editable, not computed
          const totalVal = computedValues[row.total] ?? 0;
          const lossVal = computedValues[row.loss] ?? 0;

          return (
            <div key={row.row} className="grid grid-cols-[1fr,100px,100px,120px,100px,100px] px-4 py-3 text-sm">
              <div className="text-foreground font-medium">{row.name}</div>
              
              {/* Editable Items */}
              <div>
                <input
                  className="w-full border border-input rounded px-2 py-1 bg-background text-foreground text-center"
                  inputMode="decimal"
                  value={itemsVal}
                  onChange={e => setState(row.items, e.target.value)}
                />
              </div>
              
              {/* Editable PPI */}
              <div>
                <input
                  className="w-full border border-input rounded px-2 py-1 bg-background text-foreground text-right tabular-nums"
                  inputMode="decimal"
                  value={state[row.ppi] ?? ""}
                  onChange={e => setState(row.ppi, e.target.value)}
                />
              </div>
              
              {/* Editable Retention % */}
              <div>
                <input
                  className="w-full border border-input rounded px-2 py-1 bg-background text-foreground text-center"
                  inputMode="decimal"
                  value={retentionVal}
                  onChange={e => setState(row.retention, e.target.value)}
                  placeholder="0–100"
                />
              </div>
              
              {/* Read-only Total Points */}
              <div className="text-center text-muted-foreground bg-muted/50 rounded px-2 py-1">
                {formatValue(row.total, totalVal)}
              </div>
              
              {/* Read-only Point Loss */}
              <div className="text-center text-muted-foreground bg-muted/50 rounded px-2 py-1">
                {formatValue(row.loss, lossVal)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}