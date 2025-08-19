import { useState } from "react";
import { type CellAddr } from "./rows";
import { formatValue } from "./format";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import PercentInput from "./PercentInput";

export function GrowthBonusFactorsCard({ 
  state, 
  setState, 
  computedValues 
}: {
  state: Record<CellAddr, any>;
  setState: (addr: CellAddr, val: any) => void;
  computedValues: Record<CellAddr, number>;
}) {
  const premium = state["Sheet1!D33" as CellAddr] ?? "";
  
  const baselineItems = computedValues["Sheet1!D30" as CellAddr] ?? 0;
  const baselinePoints = computedValues["Sheet1!D31" as CellAddr] ?? 0;
  const newPointsItemsMix = computedValues["Sheet1!D32" as CellAddr] ?? 0;

  return (
    <div className="space-y-4">
      {/* Editable Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">Annualized Written Premium $</label>
          <input
            className="border border-input rounded-lg px-3 py-2 bg-background text-foreground placeholder-muted-foreground focus:border-ring"
            inputMode="numeric"
            placeholder="3,000,000"
            value={premium}
            onChange={e => setState("Sheet1!D33" as CellAddr, e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground flex items-center gap-2">
            Overall Retention (%)
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Net Retention on Business Metrics</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </label>
          <PercentInput
            addr={"Sheet1!D29" as CellAddr}
            state={state}
            setState={setState}
            placeholder="86.71"
          />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground flex items-center gap-2">
            1st Year Retention %
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>0-2 Year Retention on Business Metrics</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </label>
          <PercentInput
            addr={"Sheet1!D34" as CellAddr}
            state={state}
            setState={setState}
            placeholder="86.67"
          />
        </div>
      </div>

      {/* Computed Values */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <h4 className="text-sm font-medium text-foreground mb-3">Computed Values</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Baseline Items:</span>
            <span className="text-foreground font-medium">
              {formatValue("Sheet1!D30" as CellAddr, baselineItems)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Baseline Points:</span>
            <span className="text-foreground font-medium">
              {formatValue("Sheet1!D31" as CellAddr, baselinePoints)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">New Points/Items Mix:</span>
            <span className="text-foreground font-medium">
              {formatValue("Sheet1!D32" as CellAddr, newPointsItemsMix)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}