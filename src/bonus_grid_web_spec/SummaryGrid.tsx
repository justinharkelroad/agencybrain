import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatValue } from "./format";
import { GRID_GOAL_ROWS } from "./rows";
import { type CellAddr } from "./computeWithRounding";

export function SummaryGrid({ 
  state, 
  computed, 
  setField,
  className 
}: { 
  state: Record<CellAddr, any>; 
  computed: Record<CellAddr, number>;
  setField: (addr: CellAddr, val: any) => void;
  className?: string;
}) {
  const rows = GRID_GOAL_ROWS;

  // No inline calculations - read computed values only
  const rowData = useMemo(() => {
    return rows.map(r => {
      const goalVal = state[`Sheet1!C${r}` as CellAddr] ?? "";
      
      return {
        row: r,
        goalVal,
        bonusPct: computed[`Sheet1!H${r}` as CellAddr] ?? 0,
        bonusDollars: computed[`Sheet1!D${r}` as CellAddr] ?? 0,
        pointLossRetention: computed["Sheet1!G24" as CellAddr] ?? 0,
        netPointsNeeded: computed[`Sheet1!E${r}` as CellAddr] ?? 0,
        firstYearRetentionLoss: computed[`Sheet1!F${r}` as CellAddr] ?? 0,
        totalPointsNeeded: computed[`Sheet1!G${r}` as CellAddr] ?? 0,
        monthlyPointsNeeded: computed[`Sheet1!I${r}` as CellAddr] ?? 0,
        monthlyItemsNeeded: computed[`Sheet1!J${r}` as CellAddr] ?? 0,
        dailyPointsNeeded: computed[`Sheet1!K${r}` as CellAddr] ?? 0,
        dailyItemsNeeded: computed[`Sheet1!L${r}` as CellAddr] ?? 0,
      };
    });
  }, [state, rows, computed]);

  return (
    <div className={cn("rounded-xl border bg-card overflow-x-auto", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
        <div className="font-medium">Growth Grid Summary</div>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[140px,100px,120px,140px,140px,160px,160px,160px,160px,160px,160px] gap-2 px-2 py-2 text-xs text-muted-foreground bg-muted/30 border-b">
        <div>Growth Goal</div>
        <div>Bonus %</div>
        <div>Bonus $</div>
        <div>Point Loss Retention</div>
        <div>Net Points Needed</div>
        <div>1st Yr Retention Loss</div>
        <div>TOTAL Points Needed</div>
        <div>Monthly Points Needed</div>
        <div>Monthly Items Needed</div>
        <div>Daily Points Needed</div>
        <div>Daily Items Needed</div>
      </div>
      <div className="px-2 pb-2 text-[11px] text-muted-foreground text-right">*21 Days / Month Avg</div>

      {/* Data Rows */}
      <div className="divide-y divide-border">
        {rowData.map(data => {
          const r = data.row;
          const goalAddr = `Sheet1!C${r}` as CellAddr;
          return (
            <div key={r} className="grid grid-cols-[140px,100px,120px,140px,140px,160px,160px,160px,160px,160px,160px] gap-2 py-2 border-b">
              {/* Growth Goal (editable C[r]) */}
              <input
                className="w-full px-2 py-1 rounded border border-input bg-background text-right tabular-nums"
                inputMode="numeric"
                value={state[goalAddr] ?? ""}
                onChange={e => setField(goalAddr, e.target.value)}
                placeholder="3469"
              />
              {/* Bonus % (H[r], read-only) */}
              <div className="rounded px-2 py-1 bg-muted/50 text-right">
                {formatValue(`Sheet1!H${r}` as CellAddr, computed[`Sheet1!H${r}` as CellAddr])}
              </div>
              {/* Bonus $ */}
              <div className="text-right">{formatValue(`Sheet1!D${r}` as CellAddr, computed[`Sheet1!D${r}` as CellAddr])}</div>
              {/* Point Loss Retention (G24) */}
              <div className="text-right">{formatValue("Sheet1!G24" as CellAddr, computed["Sheet1!G24" as CellAddr])}</div>
              {/* Net Points Needed */}
              <div className="text-right">{formatValue(`Sheet1!E${r}` as CellAddr, computed[`Sheet1!E${r}` as CellAddr])}</div>
              {/* 1st Yr Retention Loss */}
              <div className="text-right">{formatValue(`Sheet1!F${r}` as CellAddr, computed[`Sheet1!F${r}` as CellAddr])}</div>
              {/* TOTAL Points Needed */}
              <div className="text-right">{formatValue(`Sheet1!G${r}` as CellAddr, computed[`Sheet1!G${r}` as CellAddr])}</div>
              {/* Monthly Points Needed */}
              <div className="text-right">{formatValue(`Sheet1!I${r}` as CellAddr, computed[`Sheet1!I${r}` as CellAddr])}</div>
              {/* Monthly Items Needed */}
              <div className="text-right">{formatValue(`Sheet1!J${r}` as CellAddr, computed[`Sheet1!J${r}` as CellAddr])}</div>
              {/* Daily Points Needed */}
              <div className="text-right">{formatValue(`Sheet1!K${r}` as CellAddr, computed[`Sheet1!K${r}` as CellAddr])}</div>
              {/* Daily Items Needed */}
              <div className="text-right">{formatValue(`Sheet1!L${r}` as CellAddr, computed[`Sheet1!L${r}` as CellAddr])}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}