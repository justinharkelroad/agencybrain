import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatValue } from "./format";
import { GRID_GOAL_ROWS } from "./rows";
import { type CellAddr } from "./computeWithRounding";

export function SummaryGrid({ 
  state, 
  computed, 
  className 
}: { 
  state: Record<CellAddr, any>; 
  computed: Record<CellAddr, number>;
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
        <div className="text-xs text-muted-foreground">*21 Days / Month Avg</div>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[80px,80px,100px,120px,120px,140px,130px,130px,130px,70px,70px] gap-2 px-4 py-2 text-xs text-muted-foreground bg-muted/30 border-b">
        <div>Row</div>
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

      {/* Data Rows */}
      <div className="divide-y divide-border">
        {rowData.map(data => (
          <div key={data.row} className="grid grid-cols-[80px,80px,100px,120px,120px,140px,130px,130px,130px,70px,70px] gap-2 px-4 py-2 text-sm">
            <div className="text-foreground">{data.row}</div>
            <div className="text-foreground bg-muted/20 px-2 py-1 rounded">{formatValue(`Sheet1!H${data.row}` as CellAddr, data.bonusPct)}</div>
            <div className="text-foreground">{formatValue(`Sheet1!D${data.row}` as CellAddr, data.bonusDollars)}</div>
            <div className="text-foreground">{formatValue(`Sheet1!E${data.row}` as CellAddr, data.netPointsNeeded)}</div>
            <div className="text-foreground">{formatValue(`Sheet1!F${data.row}` as CellAddr, data.firstYearRetentionLoss)}</div>
            <div className="text-foreground">{formatValue(`Sheet1!G${data.row}` as CellAddr, data.totalPointsNeeded)}</div>
            <div className="text-foreground">{formatValue(`Sheet1!I${data.row}` as CellAddr, data.monthlyPointsNeeded)}</div>
            <div className="text-foreground">{formatValue(`Sheet1!J${data.row}` as CellAddr, data.monthlyItemsNeeded)}</div>
            <div className="text-foreground">{formatValue(`Sheet1!K${data.row}` as CellAddr, data.dailyPointsNeeded)}</div>
            <div className="text-foreground">{formatValue(`Sheet1!L${data.row}` as CellAddr, data.dailyItemsNeeded)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}