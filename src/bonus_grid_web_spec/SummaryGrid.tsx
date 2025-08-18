import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatValue } from "./format";
import { GRID_GOAL_ROWS } from "./rows";
import { type CellAddr } from "./computeWithRounding";

// Helper to safely get numeric value
const getNumericValue = (value: any, fallback = 0): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export function SummaryGrid({ 
  state, 
  setState,
  computed, 
  className 
}: { 
  state: Record<CellAddr, any>; 
  setState?: (addr: CellAddr, val: any) => void;
  computed: Record<CellAddr, number>;
  className?: string;
}) {
  const rows = GRID_GOAL_ROWS;

  // Get key values for calculations
  const m25 = getNumericValue(computed["Sheet1!M25" as CellAddr]); // New Points/Items Mix
  const d34 = getNumericValue(computed["Sheet1!D34" as CellAddr]); // 1st Year Retention (decimal)
  const g24 = getNumericValue(computed["Sheet1!G24" as CellAddr]); // Point Loss Retention
  const d33 = getNumericValue(computed["Sheet1!D33" as CellAddr]); // Premium

  const rowData = useMemo(() => {
    // Fixed bonus percentages as decimals
    const bonusPercentages: Record<number, number> = {
      38: 0.04, 39: 0.035, 40: 0.029, 41: 0.02, 42: 0.011, 43: 0.0055, 44: 0.0005
    };

    return rows.map(r => {
      const goalVal = state[`Sheet1!C${r}` as CellAddr] ?? "";
      const goalPoints = getNumericValue(goalVal);
      const bonusPct = bonusPercentages[r] || 0;
      const bonusDollars = d33 * bonusPct;
      const pointLossRetention = g24;
      const netPointsNeeded = goalPoints;
      const firstYearRetentionLoss = netPointsNeeded * (1 - d34);
      const totalPointsNeeded = netPointsNeeded + firstYearRetentionLoss;
      const monthlyPointsNeeded = totalPointsNeeded / 12;
      const monthlyItemsNeeded = m25 > 0 ? monthlyPointsNeeded / m25 : 0;
      const dailyPointsNeeded = monthlyPointsNeeded / 21;
      const dailyItemsNeeded = m25 > 0 ? dailyPointsNeeded / m25 : 0;

      return {
        row: r,
        goalVal,
        goalPoints,
        bonusPct,
        bonusDollars,
        pointLossRetention,
        netPointsNeeded,
        firstYearRetentionLoss,
        totalPointsNeeded,
        monthlyPointsNeeded,
        monthlyItemsNeeded,
        dailyPointsNeeded,
        dailyItemsNeeded,
      };
    });
  }, [state, rows, d33, g24, d34, m25]);

  return (
    <div className={cn("rounded-xl border bg-card overflow-x-auto", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
        <div className="font-medium">Growth Grid Summary</div>
        <div className="text-xs text-muted-foreground">*21 Days / Month Avg</div>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[80px,80px,100px,120px,120px,140px,130px,130px,130px,140px] gap-2 px-4 py-2 text-xs text-muted-foreground bg-muted/30 border-b">
        <div>Goal Points</div>
        <div>Bonus %</div>
        <div>Bonus $</div>
        <div>Point Loss Retention</div>
        <div>Net Points Needed</div>
        <div>1st Yr Retention Loss</div>
        <div>TOTAL Points Needed</div>
        <div>Monthly Points Needed</div>
        <div>Monthly Items Needed</div>
        <div>Daily Points / Items Needed</div>
      </div>

      {/* Data Rows */}
      <div className="divide-y divide-border">
        {rowData.map(data => (
          <div key={data.row} className="grid grid-cols-[80px,80px,100px,120px,120px,140px,130px,130px,130px,140px] gap-2 px-4 py-2 text-sm">
            <div>
              <input
                className="w-full border border-input rounded px-2 py-1 bg-background text-foreground text-xs"
                inputMode="decimal"
                value={data.goalVal}
                onChange={e => setState?.(`Sheet1!C${data.row}` as CellAddr, e.target.value)}
              />
            </div>
            <div className="text-foreground">{(data.bonusPct * 100).toFixed(3)}%</div>
            <div className="text-foreground">${data.bonusDollars.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <div className="text-foreground">{data.pointLossRetention.toFixed(0)}</div>
            <div className="text-foreground">{data.netPointsNeeded.toFixed(0)}</div>
            <div className="text-foreground">{data.firstYearRetentionLoss.toFixed(0)}</div>
            <div className="text-foreground">{data.totalPointsNeeded.toFixed(0)}</div>
            <div className="text-foreground">{data.monthlyPointsNeeded.toFixed(2)}</div>
            <div className="text-foreground">{data.monthlyItemsNeeded.toFixed(2)}</div>
            <div className="text-foreground text-xs">
              <div>{data.dailyPointsNeeded.toFixed(2)}</div>
              <div className="text-muted-foreground">{data.dailyItemsNeeded.toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}