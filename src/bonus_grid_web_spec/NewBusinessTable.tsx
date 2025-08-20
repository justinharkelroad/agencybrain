import { NEW_BIZ_ROWS, type CellAddr } from "./rows";
import { formatValue } from "./format";

const PPI_DEFAULTS: Record<CellAddr, number> = {
  "Sheet1!D9":10,"Sheet1!D10":0,"Sheet1!D11":0,"Sheet1!D12":5,"Sheet1!D13":20,"Sheet1!D14":20,
  "Sheet1!D15":5,"Sheet1!D16":5,"Sheet1!D17":5,"Sheet1!D18":5,"Sheet1!D19":5,"Sheet1!D20":0,
  "Sheet1!D21":0,"Sheet1!D22":0,"Sheet1!D23":10,
  "Sheet1!L9":10,"Sheet1!L10":0,"Sheet1!L11":0,"Sheet1!L12":5,"Sheet1!L13":20,"Sheet1!L14":20,
  "Sheet1!L15":5,"Sheet1!L16":5,"Sheet1!L17":5,"Sheet1!L18":5,"Sheet1!L19":5,"Sheet1!L20":0,
  "Sheet1!L21":0,"Sheet1!L22":0,"Sheet1!L23":10,
};

export function NewBusinessTable({ 
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
      <div className="grid grid-cols-[1fr,100px,100px,100px] text-xs px-4 py-3 bg-muted border-b border-border text-muted-foreground font-medium">
        <div>Product</div>
        <div># Items</div>
        <div>PPI</div>
        <div>Total Points</div>
      </div>
      <div className="divide-y divide-border">
        {NEW_BIZ_ROWS.map(row => {
          const itemsVal = state[row.items] ?? "";
          const ppiVal = state[row.ppi] ?? PPI_DEFAULTS[row.ppi] ?? "";
          const totalVal = computedValues[row.total] ?? 0;

          return (
            <div key={row.row} className="grid grid-cols-[1fr,100px,100px,100px] px-4 py-3 text-sm">
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
                  className="w-full border border-input rounded px-2 py-1 bg-background text-foreground text-center"
                  inputMode="decimal"
                  value={ppiVal}
                  onChange={e => setState(row.ppi, e.target.value)}
                />
              </div>
              
              {/* Read-only Total Points */}
              <div className="text-center text-muted-foreground bg-muted/50 rounded px-2 py-1">
                {formatValue(row.total, totalVal)}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Totals Row */}
      <div className="grid grid-cols-[1fr,100px,100px,100px] px-4 py-3 border-t bg-muted/20 font-medium">
        <div>Totals</div>
        <div className="text-center">{formatValue("Sheet1!K24", computedValues["Sheet1!K24"] ?? 0)}</div>
        <div className="text-center text-muted-foreground">—</div>
        <div className="text-center">{formatValue("Sheet1!M24", computedValues["Sheet1!M24"] ?? 0)}</div>
      </div>
    </div>
  );
}