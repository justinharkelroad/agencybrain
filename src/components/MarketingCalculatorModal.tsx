import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  MarketingInputs,
  MarketingDerived,
  computeMetrics,
  formatCurrency,
  formatInteger,
  
  clampPercent,
} from "@/utils/marketingCalculator";

const STORAGE_KEY = "roiForecaster:lastInputs";

export type MarketingCalculatorModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MarketingCalculatorModal({ open, onOpenChange }: MarketingCalculatorModalProps) {
  const { register, watch, setValue, reset, formState: { errors } } = useForm<MarketingInputs>({
    mode: "onChange",
    defaultValues: {} as any,
  });

  // Manual loader for last inputs (no auto-fill on open)
  const loadLast = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<MarketingInputs>;
      reset(parsed as any);
    } catch {}
  };

  // Persist with debounce
  useEffect(() => {
    const sub = watch((val) => {
      const t = setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
        } catch {}
      }, 200);
      return () => clearTimeout(t);
    });
    return () => sub.unsubscribe();
  }, [watch]);

  // Watch all fields
  const values = watch();

  // Normalize percent helper for onBlur only
  const normalizePercent = (v: number) => {
    if (!isFinite(v)) return 0;
    const val = v > 0 && v < 1 ? v * 100 : v;
    return clampPercent(val);
  };

  const derived: MarketingDerived = useMemo(() => computeMetrics({
    leadSource: values.leadSource || "",
    spend: Number(values.spend) || 0,
    cpl: Number(values.cpl) || 0,
    quoteRatePct: Number(values.quoteRatePct) || 0,
    closeRatePct: Number(values.closeRatePct) || 0,
    avgItemValue: Number(values.avgItemValue) || 0,
    avgItemsPerHH: Number(values.avgItemsPerHH) || 0,
    commissionPct: Number(values.commissionPct) || 0,
  }), [values]);
  const hasSpend = Number(values.spend) > 0;
  const hasCpl = Number(values.cpl) > 0;
  const hasQuoteRate = values.quoteRatePct !== undefined && values.quoteRatePct !== '' && isFinite(Number(values.quoteRatePct));
  const hasCloseRate = values.closeRatePct !== undefined && values.closeRatePct !== '' && isFinite(Number(values.closeRatePct));
  const hasAvgItems = values.avgItemsPerHH !== undefined && values.avgItemsPerHH !== '' && isFinite(Number(values.avgItemsPerHH));
  const hasAvgItemValue = values.avgItemValue !== undefined && values.avgItemValue !== '' && isFinite(Number(values.avgItemValue));
  const hasCommission = values.commissionPct !== undefined && values.commissionPct !== '' && isFinite(Number(values.commissionPct));

  const canTotalLeads = hasSpend && hasCpl;
  const canQuotedHH = canTotalLeads && hasQuoteRate;
  const canClosedHH = canQuotedHH && hasCloseRate;
  const canSoldItems = canClosedHH && hasAvgItems;
  const canSoldPremium = canSoldItems && hasAvgItemValue;
  const canTotalComp = canSoldPremium && hasCommission;

  const quotedHHZero = canQuotedHH && derived.quotedHH === 0;
  const cplZeroExplicit = values.cpl !== undefined && values.cpl !== '' && isFinite(Number(values.cpl)) && Number(values.cpl) === 0;
  const handleReset = () => {
    reset({
      leadSource: "",
      spend: undefined as any,
      cpl: undefined as any,
      quoteRatePct: undefined as any,
      closeRatePct: undefined as any,
      avgItemValue: undefined as any,
      avgItemsPerHH: undefined as any,
      commissionPct: undefined as any,
    });
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const handleCopy = async () => {
    const lines = [
      `Lead Source: ${values.leadSource || "—"}`,
      `Spend: ${formatCurrency(Number(values.spend) || 0)}`,
      `Cost Per Lead: ${formatCurrency(Number(values.cpl) || 0)}`,
      `Quote Rate: ${clampPercent(Number(values.quoteRatePct) || 0)}%`,
      `Close Rate: ${clampPercent(Number(values.closeRatePct) || 0)}%`,
      `Average Item Value: ${formatCurrency(Number(values.avgItemValue) || 0)}`,
      `Average Items Per HH: ${Number(values.avgItemsPerHH) || 0}`,
      `Average Commission: ${clampPercent(Number(values.commissionPct) || 0)}%`,
      `Total Leads: ${formatInteger(derived.totalLeads)}`,
      `Quoted HH: ${formatInteger(derived.quotedHH)}`,
      `Cost Per Quoted HH: ${derived.costPerQuotedHH == null ? "—" : formatCurrency(derived.costPerQuotedHH)}`,
      `Closed HH: ${formatInteger(derived.closedHH)}`,
      `Sold Items: ${formatInteger(derived.soldItems)}`,
      `Sold Premium: ${formatCurrency(derived.soldPremium)}`,
      `Total Compensation: ${formatCurrency(derived.totalComp)}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast({ title: "Results copied", description: "ROI summary copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", description: "Please copy manually.", variant: "destructive" as any });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[85vh] overflow-y-auto glass-surface backdrop-blur-md rounded-2xl border border-border/60">
        <DialogHeader>
          <DialogTitle>You Fill Out This</DialogTitle>
          <DialogDescription>
            Enter your numbers to estimate ROI from marketing spend
          </DialogDescription>
        </DialogHeader>

        {canTotalLeads && (
          <div aria-live="polite" className="sr-only" id="roi-live">
            Total Leads {derived.totalLeads}, Quoted Households {derived.quotedHH}, Closed Households {derived.closedHH}, Sold Items {derived.soldItems}, Sold Premium {formatCurrency(derived.soldPremium)}, Total Compensation {formatCurrency(derived.totalComp)}.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {/* Lead Source */}
          <div>
            <Label htmlFor="leadSource">Lead Source</Label>
            <Input id="leadSource" {...register("leadSource")} />
            <p className="text-xs text-muted-foreground mt-1">Optional label to identify the source</p>
          </div>

          {/* Spend */}
          <div>
            <Label htmlFor="spend">Spend</Label>
            <Input id="spend" type="number" step="any" min={0}
              aria-invalid={!!errors.spend}
              {...register("spend", { required: "Spend is required", min: { value: 0.01, message: "Must be greater than 0" } })}
            />
            <p className="text-xs text-muted-foreground mt-1">Total marketing spend (USD)</p>
            {errors.spend && <p className="text-xs text-destructive mt-1">{errors.spend.message as string}</p>}
          </div>

          {/* CPL */}
          <div>
            <Label htmlFor="cpl">Cost Per Lead</Label>
            <Input id="cpl" type="number" step="any" min={0}
              aria-invalid={!!errors.cpl}
              {...register("cpl", { required: "Cost per lead is required", min: { value: 0.01, message: "Must be greater than 0" } })}
            />
            <p className="text-xs text-muted-foreground mt-1">Average cost per lead (USD)</p>
            {(errors.cpl || cplZeroExplicit) && (
              <p className="text-xs text-destructive mt-1">{errors.cpl?.message as string || "CPL cannot be 0"}</p>
            )}
          </div>

          {/* Quote Rate % */}
          <div>
            <Label htmlFor="quoteRatePct">Quote Rate</Label>
            <Input id="quoteRatePct" type="number" step="any" min={0} max={100}
              aria-invalid={!!errors.quoteRatePct}
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                const n = normalizePercent(v);
                if (n !== v) setValue("quoteRatePct", n as any, { shouldValidate: true, shouldDirty: true });
              }}
              {...register("quoteRatePct", { required: "Quote rate is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" } })}
            />
            <p className="text-xs text-muted-foreground mt-1">Percent of leads you quote</p>
          </div>

          {/* Close Rate % */}
          <div>
            <Label htmlFor="closeRatePct">Close Rate</Label>
            <Input id="closeRatePct" type="number" step="any" min={0} max={100}
              aria-invalid={!!errors.closeRatePct}
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                const n = normalizePercent(v);
                if (n !== v) setValue("closeRatePct", n as any, { shouldValidate: true, shouldDirty: true });
              }}
              {...register("closeRatePct", { required: "Close rate is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" } })}
            />
            <p className="text-xs text-muted-foreground mt-1">Percent of quoted households you close</p>
          </div>

          {/* Avg Item Value */}
          <div>
            <Label htmlFor="avgItemValue">Average Item Value</Label>
            <Input id="avgItemValue" type="number" step="any" min={0}
              aria-invalid={!!errors.avgItemValue}
              {...register("avgItemValue", { required: "Average item value is required", min: { value: 0, message: "Must be non-negative" } })}
            />
            <p className="text-xs text-muted-foreground mt-1">Average policy/item premium (USD)</p>
          </div>

          {/* Avg Items per HH */}
          <div>
            <Label htmlFor="avgItemsPerHH">Average Items Per HH</Label>
            <Input id="avgItemsPerHH" type="number" step="any" min={0}
              aria-invalid={!!errors.avgItemsPerHH}
              {...register("avgItemsPerHH", { required: "Average items per HH is required", min: { value: 0, message: "Must be non-negative" } })}
            />
            <p className="text-xs text-muted-foreground mt-1">Average number of items sold per closed HH</p>
          </div>

          {/* Commission % */}
          <div>
            <Label htmlFor="commissionPct">Average Commission</Label>
            <Input id="commissionPct" type="number" step="any" min={0} max={100}
              aria-invalid={!!errors.commissionPct}
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                const n = normalizePercent(v);
                if (n !== v) setValue("commissionPct", n as any, { shouldValidate: true, shouldDirty: true });
              }}
              {...register("commissionPct", { required: "Commission is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" } })}
            />
            <p className="text-xs text-muted-foreground mt-1">Percent of sold premium paid as commission</p>
          </div>
        </div>

        {/* Derived metrics */}
        <section className="mt-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">And We Got This Part</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Total Leads</Label>
              <Input disabled value={canTotalLeads ? formatInteger(derived.totalLeads) : ""} />
              <p className="text-xs text-muted-foreground mt-1">Rounded: spend ÷ CPL</p>
            </div>
            <div>
              <Label>Quoted HH</Label>
              <Input disabled value={canQuotedHH ? formatInteger(derived.quotedHH) : ""} />
              <p className="text-xs text-muted-foreground mt-1">Rounded: leads × quote rate</p>
            </div>
            <div>
              <Label>Cost Per Quoted HH</Label>
              <Input disabled value={canQuotedHH ? (derived.quotedHH === 0 ? "—" : formatCurrency(derived.costPerQuotedHH!)) : ""} />
              <p className="text-xs text-muted-foreground mt-1">Spend ÷ quoted HH</p>
              {quotedHHZero && (
                <p className="text-xs text-destructive mt-1">No quoted households yet</p>
              )}
            </div>
            <div>
              <Label>Closed HH</Label>
              <Input disabled value={canClosedHH ? formatInteger(derived.closedHH) : ""} />
              <p className="text-xs text-muted-foreground mt-1">Rounded: quoted × close rate</p>
            </div>
            <div>
              <Label>Sold Items</Label>
              <Input disabled value={canSoldItems ? formatInteger(derived.soldItems) : ""} />
              <p className="text-xs text-muted-foreground mt-1">Rounded: closed × avg items/HH</p>
            </div>
            <div>
              <Label>Sold Premium</Label>
              <Input disabled value={canSoldPremium ? formatCurrency(derived.soldPremium) : ""} />
              <p className="text-xs text-muted-foreground mt-1">Sold items × avg item value</p>
            </div>
            <div>
              <Label>Total Compensation</Label>
              <Input disabled value={canTotalComp ? formatCurrency(derived.totalComp) : ""} />
              <p className="text-xs text-muted-foreground mt-1">Sold premium × commission</p>
            </div>
          </div>
        </section>

        <div className="mt-6 flex items-center justify-between">
          <Button variant="secondary" onClick={handleReset}>Reset</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={loadLast}>Load last inputs</Button>
            <Button variant="outline" onClick={handleCopy}>Copy results</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MarketingCalculatorModal;
