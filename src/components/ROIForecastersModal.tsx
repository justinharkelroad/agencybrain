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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { BarChart3, Mail, PhoneCall, ArrowLeft } from "lucide-react";
import {
  clampPercent,
  formatCurrency,
  formatInteger,
  MarketingInputs,
  MarketingDerived,
  computeMetrics,
  MailerInputs,
  MailerDerived,
  computeMailerMetrics,
  TransferInputs,
  TransferDerived,
  computeTransferMetrics,
} from "@/utils/marketingCalculator";

export type ROIForecastersModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const LAST_USED_KEY = "roiForecasters:lastCalc";

// Shared: two-column on desktop, single on mobile
function GridTwoCols({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">{children}</div>;
}

function SelectorView({ onPick }: { onPick: (k: CalcKey) => void }) {
  const [last, setLast] = useState<CalcKey | null>(null);
  useEffect(() => {
    try {
      const v = localStorage.getItem(LAST_USED_KEY) as CalcKey | null;
      if (v) setLast(v);
    } catch {}
  }, []);
  const cardBase = "glass-surface elevate rounded-2xl hover-scale transition-shadow shadow-md hover:shadow-lg";
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
      <Card className={cardBase} role="button" onClick={() => onPick("data")}
        aria-label="Open Data Lead Forecaster">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Data Lead Forecaster</CardTitle>
          <CardDescription>Estimate ROI from inbound lead sources (CPL-based)</CardDescription>
        </CardHeader>
        <CardContent>
          {last === "data" && <span className="text-xs text-muted-foreground">Last used</span>}
        </CardContent>
      </Card>
      <Card className={cardBase} role="button" onClick={() => onPick("mailer")} aria-label="Open Mailer Forecaster">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Mailer Forecaster</CardTitle>
          <CardDescription>Model direct mail performance to quotes and revenue</CardDescription>
        </CardHeader>
        <CardContent>
          {last === "mailer" && <span className="text-xs text-muted-foreground">Last used</span>}
        </CardContent>
      </Card>
      <Card className={cardBase} role="button" onClick={() => onPick("transfer")} aria-label="Open Live Transfer Forecaster">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PhoneCall className="h-5 w-5" /> Live Transfer Forecaster</CardTitle>
          <CardDescription>Forecast live transfer call outcomes and ROI</CardDescription>
        </CardHeader>
        <CardContent>
          {last === "transfer" && <span className="text-xs text-muted-foreground">Last used</span>}
        </CardContent>
      </Card>
    </div>
  );
}

type CalcKey = "data" | "mailer" | "transfer";

export function ROIForecastersModal({ open, onOpenChange }: ROIForecastersModalProps) {
  const [mode, setMode] = useState<CalcKey | null>(null);

  useEffect(() => {
    if (!open) setMode(null);
  }, [open]);

  const handlePick = (k: CalcKey) => {
    setMode(k);
    try { localStorage.setItem(LAST_USED_KEY, k); } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[85vh] overflow-y-auto glass-surface backdrop-blur-md rounded-2xl border border-border/60">
        <DialogHeader>
          <DialogTitle>ROI Forecasters</DialogTitle>
          <DialogDescription>
            Choose a calculator to estimate performance and compensation
          </DialogDescription>
        </DialogHeader>

        {!mode && <SelectorView onPick={handlePick} />}
        {mode === "data" && (
          <div className="animate-enter">
            <DataLeadForm onBack={() => setMode(null)} />
          </div>
        )}
        {mode === "mailer" && (
          <div className="animate-enter">
            <MailerForm onBack={() => setMode(null)} />
          </div>
        )}
        {mode === "transfer" && (
          <div className="animate-enter">
            <TransferForm onBack={() => setMode(null)} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center justify-between mt-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back to calculators">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-base font-medium text-muted-foreground">{title}</h3>
      </div>
    </div>
  );
}

// ========== Data Lead Form ==========
function DataLeadForm({ onBack }: { onBack: () => void }) {
  const STORAGE_KEY = "roiForecasters:dataInputs";
  const { register, watch, setValue, reset, formState: { errors } } = useForm<MarketingInputs>({ mode: "onChange", defaultValues: {} as any });

  // persist
  useEffect(() => {
    const sub = watch((val) => {
      const t = setTimeout(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(val)); } catch {}
      }, 200);
      return () => clearTimeout(t);
    });
    return () => sub.unsubscribe();
  }, [watch]);

  const loadLast = () => {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return; reset(JSON.parse(raw)); } catch {}
  };

  // clamp
  const values = watch();
  useEffect(() => {
    const q = values.quoteRatePct; if (typeof q === "number" && isFinite(q)) { const c = clampPercent(q); if (c !== q) setValue("quoteRatePct", c, { shouldValidate: true }); }
    const cl = values.closeRatePct; if (typeof cl === "number" && isFinite(cl)) { const c2 = clampPercent(cl); if (c2 !== cl) setValue("closeRatePct", c2, { shouldValidate: true }); }
    const cm = values.commissionPct; if (typeof cm === "number" && isFinite(cm)) { const c3 = clampPercent(cm); if (c3 !== cm) setValue("commissionPct", c3, { shouldValidate: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.quoteRatePct, values.closeRatePct, values.commissionPct]);

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
  const hasQuoteRate = typeof values.quoteRatePct === 'number' && isFinite(values.quoteRatePct);
  const hasCloseRate = typeof values.closeRatePct === 'number' && isFinite(values.closeRatePct);
  const hasAvgItems = typeof values.avgItemsPerHH === 'number' && isFinite(values.avgItemsPerHH);
  const hasAvgItemValue = typeof values.avgItemValue === 'number' && isFinite(values.avgItemValue);
  const hasCommission = typeof values.commissionPct === 'number' && isFinite(values.commissionPct);

  const canTotalLeads = hasSpend && hasCpl;
  const canQuotedHH = canTotalLeads && hasQuoteRate;
  const canClosedHH = canQuotedHH && hasCloseRate;
  const canSoldItems = canClosedHH && hasAvgItems;
  const canSoldPremium = canSoldItems && hasAvgItemValue;
  const canTotalComp = canSoldPremium && hasCommission;

  const quotedHHZero = canQuotedHH && derived.quotedHH === 0;
  const cplZeroExplicit = typeof values.cpl === 'number' && isFinite(values.cpl) && values.cpl === 0;

  const handleReset = () => { reset({
    leadSource: "",
    spend: undefined as any,
    cpl: undefined as any,
    quoteRatePct: undefined as any,
    closeRatePct: undefined as any,
    avgItemValue: undefined as any,
    avgItemsPerHH: undefined as any,
    commissionPct: undefined as any,
  }); try { localStorage.removeItem(STORAGE_KEY); } catch {} };

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
      `Cost Per Quoted HH: ${derived.quotedHH === 0 ? "—" : formatCurrency(derived.costPerQuotedHH || 0)}`,
      `Closed HH: ${formatInteger(derived.closedHH)}`,
      `Sold Items: ${formatInteger(derived.soldItems)}`,
      `Sold Premium: ${formatCurrency(derived.soldPremium)}`,
      `Total Compensation: ${formatCurrency(derived.totalComp)}`,
    ];
    try { await navigator.clipboard.writeText(lines.join("\n")); toast({ title: "Results copied", description: "ROI summary copied to clipboard" }); }
    catch { toast({ title: "Copy failed", description: "Please copy manually.", variant: "destructive" as any }); }
  };

  return (
    <div className="space-y-4">
      <BackHeader title="Data Lead Forecaster" onBack={onBack} />
      <GridTwoCols>
        <div>
          <Label htmlFor="leadSource">Lead Source</Label>
          <Input id="leadSource" {...register("leadSource")} />
        </div>
        <div>
          <Label htmlFor="spend">Spend</Label>
          <Input id="spend" type="number" step="any" min={0} aria-invalid={!!errors.spend}
            {...register("spend", { required: "Spend is required", min: { value: 0.01, message: "Must be greater than 0" }, valueAsNumber: true })}
          />
        </div>
        <div>
          <Label htmlFor="cpl">Cost Per Lead</Label>
          <Input id="cpl" type="number" step="any" min={0} aria-invalid={!!errors.cpl}
            {...register("cpl", { required: "Cost per lead is required", min: { value: 0.01, message: "Must be greater than 0" }, valueAsNumber: true })}
          />
        </div>
        <div>
          <Label htmlFor="quoteRatePct">Quote Rate</Label>
          <Input id="quoteRatePct" type="number" step="any" min={0} max={100} aria-invalid={!!errors.quoteRatePct}
            {...register("quoteRatePct", { required: "Quote rate is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" }, valueAsNumber: true })}
          />
        </div>
        <div>
          <Label htmlFor="closeRatePct">Close Rate</Label>
          <Input id="closeRatePct" type="number" step="any" min={0} max={100} aria-invalid={!!errors.closeRatePct}
            {...register("closeRatePct", { required: "Close rate is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" }, valueAsNumber: true })}
          />
        </div>
        <div>
          <Label htmlFor="avgItemValue">Average Item Value</Label>
          <Input id="avgItemValue" type="number" step="any" min={0} aria-invalid={!!errors.avgItemValue}
            {...register("avgItemValue", { required: "Average item value is required", min: { value: 0, message: "Must be non-negative" }, valueAsNumber: true })}
          />
        </div>
        <div>
          <Label htmlFor="avgItemsPerHH">Average Items Per HH</Label>
          <Input id="avgItemsPerHH" type="number" step="any" min={0} aria-invalid={!!errors.avgItemsPerHH}
            {...register("avgItemsPerHH", { required: "Average items per HH is required", min: { value: 0, message: "Must be non-negative" }, valueAsNumber: true })}
          />
        </div>
        <div>
          <Label htmlFor="commissionPct">Average Commission</Label>
          <Input id="commissionPct" type="number" step="any" min={0} max={100} aria-invalid={!!errors.commissionPct}
            {...register("commissionPct", { required: "Commission is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" }, valueAsNumber: true })}
          />
        </div>
      </GridTwoCols>

      <section>
        <h4 className="text-sm font-medium text-muted-foreground mb-2">Derived Metrics</h4>
        <GridTwoCols>
          <div>
            <Label>Total Leads</Label>
            <Input disabled value={canTotalLeads ? formatInteger(derived.totalLeads) : ""} />
          </div>
          <div>
            <Label>Quoted HH</Label>
            <Input disabled value={canQuotedHH ? formatInteger(derived.quotedHH) : ""} />
          </div>
          <div>
            <Label>Cost Per Quoted HH</Label>
            <Input disabled value={canQuotedHH ? (derived.quotedHH === 0 ? "—" : formatCurrency(derived.costPerQuotedHH || 0)) : ""} />
          </div>
          <div>
            <Label>Closed HH</Label>
            <Input disabled value={canClosedHH ? formatInteger(derived.closedHH) : ""} />
          </div>
          <div>
            <Label>Sold Items</Label>
            <Input disabled value={canSoldItems ? formatInteger(derived.soldItems) : ""} />
          </div>
          <div>
            <Label>Sold Premium</Label>
            <Input disabled value={canSoldPremium ? formatCurrency(derived.soldPremium) : ""} />
          </div>
          <div>
            <Label>Total Compensation</Label>
            <Input disabled value={canTotalComp ? formatCurrency(derived.totalComp) : ""} />
          </div>
        </GridTwoCols>
      </section>

      <div className="mt-2 flex items-center justify-between">
        <Button variant="secondary" onClick={handleReset}>Reset</Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={loadLast}>Load last inputs</Button>
          <Button variant="outline" onClick={handleCopy}>Copy results</Button>
        </div>
      </div>
    </div>
  );
}

// ========== Mailer Form ==========
function MailerForm({ onBack }: { onBack: () => void }) {
  const STORAGE_KEY = "roiForecasters:mailerInputs";
  const { register, watch, setValue, reset, formState: { errors } } = useForm<MailerInputs>({ mode: "onChange", defaultValues: {} as any });

  useEffect(() => {
    const sub = watch((val) => {
      const t = setTimeout(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(val)); } catch {} }, 200);
      return () => clearTimeout(t);
    });
    return () => sub.unsubscribe();
  }, [watch]);

  const loadLast = () => { try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return; reset(JSON.parse(raw)); } catch {} };

  const values = watch();
  useEffect(() => {
    const r = values.responseRatePct; if (typeof r === "number" && isFinite(r)) { const c = clampPercent(r); if (c !== r) setValue("responseRatePct", c, { shouldValidate: true }); }
    const q = values.quotedPctOfInboundPct; if (typeof q === "number" && isFinite(q)) { const c2 = clampPercent(q); if (c2 !== q) setValue("quotedPctOfInboundPct", c2, { shouldValidate: true }); }
    const cl = values.closeRatePct; if (typeof cl === "number" && isFinite(cl)) { const c3 = clampPercent(cl); if (c3 !== cl) setValue("closeRatePct", c3, { shouldValidate: true }); }
    const cm = values.commissionPct; if (typeof cm === "number" && isFinite(cm)) { const c4 = clampPercent(cm); if (c4 !== cm) setValue("commissionPct", c4, { shouldValidate: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.responseRatePct, values.quotedPctOfInboundPct, values.closeRatePct, values.commissionPct]);

  const derived: MailerDerived = useMemo(() => computeMailerMetrics({
    mailSource: values.mailSource || "",
    spend: Number(values.spend) || 0,
    costPerPiece: Number(values.costPerPiece) || 0,
    responseRatePct: Number(values.responseRatePct) || 0,
    quotedPctOfInboundPct: Number(values.quotedPctOfInboundPct) || 0,
    closeRatePct: Number(values.closeRatePct) || 0,
    avgItemsPerHH: Number(values.avgItemsPerHH) || 0,
    avgItemValue: Number(values.avgItemValue) || 0,
    commissionPct: Number(values.commissionPct) || 0,
  }), [values]);

  const canMailers = Number(values.spend) > 0 && Number(values.costPerPiece) > 0;
  const canCalls = canMailers && typeof values.responseRatePct === 'number';
  const canQuoted = canCalls && typeof values.quotedPctOfInboundPct === 'number';
  const canClosedHH = canQuoted && typeof values.closeRatePct === 'number';
  const canSoldItems = canClosedHH && typeof values.avgItemsPerHH === 'number';
  const canSoldPremium = canSoldItems && typeof values.avgItemValue === 'number';
  const canTotalComp = canSoldPremium && typeof values.commissionPct === 'number';

  const handleReset = () => { reset({
    mailSource: "",
    spend: undefined as any,
    costPerPiece: undefined as any,
    responseRatePct: undefined as any,
    quotedPctOfInboundPct: undefined as any,
    closeRatePct: undefined as any,
    avgItemsPerHH: undefined as any,
    avgItemValue: undefined as any,
    commissionPct: undefined as any,
  }); try { localStorage.removeItem(STORAGE_KEY); } catch {} };

  const handleCopy = async () => {
    const lines = [
      `Mail Source: ${values.mailSource || "—"}`,
      `Spend: ${formatCurrency(Number(values.spend) || 0)}`,
      `Cost Per Piece: ${formatCurrency(Number(values.costPerPiece) || 0)}`,
      `Response Rate: ${clampPercent(Number(values.responseRatePct) || 0)}%`,
      `Quoted % of Inbound Calls: ${clampPercent(Number(values.quotedPctOfInboundPct) || 0)}%`,
      `Close Rate: ${clampPercent(Number(values.closeRatePct) || 0)}%`,
      `Average Items Per HH: ${Number(values.avgItemsPerHH) || 0}`,
      `Average Item Value: ${formatCurrency(Number(values.avgItemValue) || 0)}`,
      `Average Commission: ${clampPercent(Number(values.commissionPct) || 0)}%`,
      `Total Mailers Sent: ${formatInteger(derived.totalMailersSent)}`,
      `Inbound Calls: ${formatInteger(derived.inboundCalls)}`,
      `Quoted HH: ${formatInteger(derived.quotedHH)}`,
      `Cost Per Quoted HH: ${derived.quotedHH === 0 ? "—" : formatCurrency(derived.costPerQuotedHH || 0)}`,
      `Closed HH: ${formatInteger(derived.closedHH)}`,
      `Sold Items: ${formatInteger(derived.soldItems)}`,
      `Sold Premium: ${formatCurrency(derived.soldPremium)}`,
      `Total Compensation: ${formatCurrency(derived.totalComp)}`,
    ];
    try { await navigator.clipboard.writeText(lines.join("\n")); toast({ title: "Results copied", description: "ROI summary copied to clipboard" }); }
    catch { toast({ title: "Copy failed", description: "Please copy manually.", variant: "destructive" as any }); }
  };

  return (
    <div className="space-y-4">
      <BackHeader title="Mailer Forecaster" onBack={onBack} />
      <GridTwoCols>
        <div>
          <Label htmlFor="mailSource">Mail Source</Label>
          <Input id="mailSource" {...register("mailSource")} />
        </div>
        <div>
          <Label htmlFor="spend">Spend</Label>
          <Input id="spend" type="number" step="any" min={0} aria-invalid={!!errors.spend}
            {...register("spend", { required: "Spend is required", min: { value: 0.01, message: "Must be greater than 0" }, valueAsNumber: true })}
          />
        </div>
        <div>
          <Label htmlFor="costPerPiece">Cost Per Piece</Label>
          <Input id="costPerPiece" type="number" step="any" min={0} aria-invalid={!!errors.costPerPiece}
            {...register("costPerPiece", { required: "Cost per piece is required", min: { value: 0.01, message: "Must be greater than 0" }, valueAsNumber: true })}
          />
        </div>
        <div>
          <Label htmlFor="responseRatePct">Response Rate</Label>
          <Input id="responseRatePct" type="number" step="any" min={0} max={100} aria-invalid={!!errors.responseRatePct}
            {...register("responseRatePct", { required: "Response rate is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" }, valueAsNumber: true })}
          />
        </div>
        <div>
          <Label htmlFor="quotedPctOfInboundPct">Quoted % of Inbound Calls</Label>
          <Input id="quotedPctOfInboundPct" type="number" step="any" min={0} max={100} aria-invalid={!!errors.quotedPctOfInboundPct}
            {...register("quotedPctOfInboundPct", { required: "Quoted % is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" }, valueAsNumber: true })}
          />
        </div>
        <div>
          <Label htmlFor="closeRatePct">Close Rate</Label>
          <Input id="closeRatePct" type="number" step="any" min={0} max={100} aria-invalid={!!errors.closeRatePct}
            {...register("closeRatePct", { required: "Close rate is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" }, valueAsNumber: true })}
          />
        </div>
        <div>
          <Label htmlFor="avgItemsPerHH">Average Items Per HH</Label>
          <Input id="avgItemsPerHH" type="number" step="any" min={0} aria-invalid={!!errors.avgItemsPerHH}
            {...register("avgItemsPerHH", { required: "Average items per HH is required", min: { value: 0, message: "Must be non-negative" }, valueAsNumber: true })}
          />
        </div>
        <div>
          <Label htmlFor="avgItemValue">Average Item Value</Label>
          <Input id="avgItemValue" type="number" step="any" min={0} aria-invalid={!!errors.avgItemValue}
            {...register("avgItemValue", { required: "Average item value is required", min: { value: 0, message: "Must be non-negative" }, valueAsNumber: true })}
          />
        </div>
        <div>
          <Label htmlFor="commissionPct">Average Commission</Label>
          <Input id="commissionPct" type="number" step="any" min={0} max={100} aria-invalid={!!errors.commissionPct}
            {...register("commissionPct", { required: "Commission is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" }, valueAsNumber: true })}
          />
        </div>
      </GridTwoCols>

      <section>
        <h4 className="text-sm font-medium text-muted-foreground mb-2">Derived Metrics</h4>
        <GridTwoCols>
          <div>
            <Label>Total Mailers Sent</Label>
            <Input disabled value={canMailers ? formatInteger(derived.totalMailersSent) : ""} />
          </div>
          <div>
            <Label>Inbound Calls</Label>
            <Input disabled value={canCalls ? formatInteger(derived.inboundCalls) : ""} />
          </div>
          <div>
            <Label>Quoted HH</Label>
            <Input disabled value={canQuoted ? formatInteger(derived.quotedHH) : ""} />
          </div>
          <div>
            <Label>Cost Per Quoted HH</Label>
            <Input disabled value={canQuoted ? (derived.quotedHH === 0 ? "—" : formatCurrency(derived.costPerQuotedHH || 0)) : ""} />
          </div>
          <div>
            <Label>Closed HH</Label>
            <Input disabled value={canClosedHH ? formatInteger(derived.closedHH) : ""} />
          </div>
          <div>
            <Label>Sold Items</Label>
            <Input disabled value={canSoldItems ? formatInteger(derived.soldItems) : ""} />
          </div>
          <div>
            <Label>Sold Premium</Label>
            <Input disabled value={canSoldPremium ? formatCurrency(derived.soldPremium) : ""} />
          </div>
          <div>
            <Label>Total Compensation</Label>
            <Input disabled value={canTotalComp ? formatCurrency(derived.totalComp) : ""} />
          </div>
        </GridTwoCols>
      </section>

      <div className="mt-2 flex items-center justify-between">
        <Button variant="secondary" onClick={handleReset}>Reset</Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={loadLast}>Load last inputs</Button>
          <Button variant="outline" onClick={handleCopy}>Copy results</Button>
        </div>
      </div>
    </div>
  );
}

// ========== Live Transfer Form ==========
function TransferForm({ onBack }: { onBack: () => void }) {
  const STORAGE_KEY = "roiForecasters:transferInputs";
  const { register, watch, setValue, reset, formState: { errors } } = useForm<TransferInputs>({ mode: "onChange", defaultValues: {} as any });

  useEffect(() => {
    const sub = watch((val) => {
      const t = setTimeout(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(val)); } catch {} }, 200);
      return () => clearTimeout(t);
    });
    return () => sub.unsubscribe();
  }, [watch]);

  const loadLast = () => { try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return; reset(JSON.parse(raw)); } catch {} };

  const values = watch();
  useEffect(() => {
    const q = values.quotedPctOfInboundPct; if (typeof q === "number" && isFinite(q)) { const c2 = clampPercent(q); if (c2 !== q) setValue("quotedPctOfInboundPct", c2, { shouldValidate: true }); }
    const cl = values.closeRatePct; if (typeof cl === "number" && isFinite(cl)) { const c3 = clampPercent(cl); if (c3 !== cl) setValue("closeRatePct", c3, { shouldValidate: true }); }
    const cm = values.commissionPct; if (typeof cm === "number" && isFinite(cm)) { const c4 = clampPercent(cm); if (c4 !== cm) setValue("commissionPct", c4, { shouldValidate: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.quotedPctOfInboundPct, values.closeRatePct, values.commissionPct]);

  const derived: TransferDerived = useMemo(() => computeTransferMetrics({
    liveTransferSource: values.liveTransferSource || "",
    spend: Number(values.spend) || 0,
    costPerTransfer: Number(values.costPerTransfer) || 0,
    quotedPctOfInboundPct: Number(values.quotedPctOfInboundPct) || 0,
    closeRatePct: Number(values.closeRatePct) || 0,
    avgItemsPerHH: Number(values.avgItemsPerHH) || 0,
    avgItemValue: Number(values.avgItemValue) || 0,
    commissionPct: Number(values.commissionPct) || 0,
  }), [values]);

  const canTransfers = Number(values.spend) > 0 && Number(values.costPerTransfer) > 0;
  const canQuoted = canTransfers && typeof values.quotedPctOfInboundPct === 'number';
  const canClosedHH = canQuoted && typeof values.closeRatePct === 'number';
  const canSoldItems = canClosedHH && typeof values.avgItemsPerHH === 'number';
  const canSoldPremium = canSoldItems && typeof values.avgItemValue === 'number';
  const canTotalComp = canSoldPremium && typeof values.commissionPct === 'number';

  const handleReset = () => { reset({
    liveTransferSource: "",
    spend: undefined as any,
    costPerTransfer: undefined as any,
    quotedPctOfInboundPct: undefined as any,
    closeRatePct: undefined as any,
    avgItemsPerHH: undefined as any,
    avgItemValue: undefined as any,
    commissionPct: undefined as any,
  }); try { localStorage.removeItem(STORAGE_KEY); } catch {} };

  const handleCopy = async () => {
    const lines = [
      `Live Transfer Source: ${values.liveTransferSource || "—"}`,
      `Spend: ${formatCurrency(Number(values.spend) || 0)}`,
      `Cost Per Transfer: ${formatCurrency(Number(values.costPerTransfer) || 0)}`,
      `Quoted % of Inbound Calls: ${clampPercent(Number(values.quotedPctOfInboundPct) || 0)}%`,
      `Close Rate: ${clampPercent(Number(values.closeRatePct) || 0)}%`,
      `Average Items Per HH: ${Number(values.avgItemsPerHH) || 0}`,
      `Average Item Value: ${formatCurrency(Number(values.avgItemValue) || 0)}`,
      `Average Commission: ${clampPercent(Number(values.commissionPct) || 0)}%`,
      `Total Transfers: ${formatInteger(derived.totalTransfers)}`,
      `Quoted HH: ${formatInteger(derived.quotedHH)}`,
      `Cost Per Quoted HH: ${derived.quotedHH === 0 ? "—" : formatCurrency(derived.costPerQuotedHH || 0)}`,
      `Closed HH: ${formatInteger(derived.closedHH)}`,
      `Sold Items: ${formatInteger(derived.soldItems)}`,
      `Sold Premium: ${formatCurrency(derived.soldPremium)}`,
      `Total Compensation: ${formatCurrency(derived.totalComp)}`,
    ];
    try { await navigator.clipboard.writeText(lines.join("\n")); toast({ title: "Results copied", description: "ROI summary copied to clipboard" }); }
    catch { toast({ title: "Copy failed", description: "Please copy manually.", variant: "destructive" as any }); }
  };

  return (
    <div className="space-y-4">
      <BackHeader title="Live Transfer Forecaster" onBack={onBack} />
      <GridTwoCols>
        <div>
          <Label htmlFor="liveTransferSource">Live Transfer Source</Label>
          <Input id="liveTransferSource" {...register("liveTransferSource")} />
        </div>
        <div>
          <Label htmlFor="spend">Spend</Label>
          <Input id="spend" type="number" step="any" min={0} aria-invalid={!!errors.spend}
            {...register("spend", { required: "Spend is required", min: { value: 0.01, message: "Must be greater than 0" }, valueAsNumber: true })}
          />
        </div>
        <div>
          <Label htmlFor="costPerTransfer">Cost Per Transfer</Label>
          <Input id="costPerTransfer" type="number" step="any" min={0} aria-invalid={!!errors.costPerTransfer}
            {...register("costPerTransfer", { required: "Cost per transfer is required", min: { value: 0.01, message: "Must be greater than 0" }, valueAsNumber: true })}
          />
        </div>
        <div>
          <Label htmlFor="quotedPctOfInboundPct">Quoted % of Inbound Calls</Label>
          <Input id="quotedPctOfInboundPct" type="number" step="any" min={0} max={100} aria-invalid={!!errors.quotedPctOfInboundPct}
            {...register("quotedPctOfInboundPct", { required: "Quoted % is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" }, valueAsNumber: true })}
          />
        </div>
        <div>
          <Label htmlFor="closeRatePct">Close Rate</Label>
          <Input id="closeRatePct" type="number" step="any" min={0} max={100} aria-invalid={!!errors.closeRatePct}
            {...register("closeRatePct", { required: "Close rate is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" }, valueAsNumber: true })}
          />
        </div>
        <div>
          <Label htmlFor="avgItemsPerHH">Average Items Per HH</Label>
          <Input id="avgItemsPerHH" type="number" step="any" min={0} aria-invalid={!!errors.avgItemsPerHH}
            {...register("avgItemsPerHH", { required: "Average items per HH is required", min: { value: 0, message: "Must be non-negative" }, valueAsNumber: true })}
          />
        </div>
        <div>
          <Label htmlFor="avgItemValue">Average Item Value</Label>
          <Input id="avgItemValue" type="number" step="any" min={0} aria-invalid={!!errors.avgItemValue}
            {...register("avgItemValue", { required: "Average item value is required", min: { value: 0, message: "Must be non-negative" }, valueAsNumber: true })}
          />
        </div>
        <div>
          <Label htmlFor="commissionPct">Average Commission</Label>
          <Input id="commissionPct" type="number" step="any" min={0} max={100} aria-invalid={!!errors.commissionPct}
            {...register("commissionPct", { required: "Commission is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" }, valueAsNumber: true })}
          />
        </div>
      </GridTwoCols>

      <section>
        <h4 className="text-sm font-medium text-muted-foreground mb-2">Derived Metrics</h4>
        <GridTwoCols>
          <div>
            <Label>Total Transfers</Label>
            <Input disabled value={canTransfers ? formatInteger(derived.totalTransfers) : ""} />
          </div>
          <div>
            <Label>Quoted HH</Label>
            <Input disabled value={canQuoted ? formatInteger(derived.quotedHH) : ""} />
          </div>
          <div>
            <Label>Cost Per Quoted HH</Label>
            <Input disabled value={canQuoted ? (derived.quotedHH === 0 ? "—" : formatCurrency(derived.costPerQuotedHH || 0)) : ""} />
          </div>
          <div>
            <Label>Closed HH</Label>
            <Input disabled value={canClosedHH ? formatInteger(derived.closedHH) : ""} />
          </div>
          <div>
            <Label>Sold Items</Label>
            <Input disabled value={canSoldItems ? formatInteger(derived.soldItems) : ""} />
          </div>
          <div>
            <Label>Sold Premium</Label>
            <Input disabled value={canSoldPremium ? formatCurrency(derived.soldPremium) : ""} />
          </div>
          <div>
            <Label>Total Compensation</Label>
            <Input disabled value={canTotalComp ? formatCurrency(derived.totalComp) : ""} />
          </div>
        </GridTwoCols>
      </section>

      <div className="mt-2 flex items-center justify-between">
        <Button variant="secondary" onClick={handleReset}>Reset</Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={loadLast}>Load last inputs</Button>
          <Button variant="outline" onClick={handleCopy}>Copy results</Button>
        </div>
      </div>
    </div>
  );
}

export default ROIForecastersModal;
