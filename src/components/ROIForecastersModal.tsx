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
import { BarChart3, Mail, PhoneCall, ArrowLeft, ShieldCheck, Calculator, AlertCircle, ExternalLink, Mic } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { VendorVerifierForm } from "@/components/VendorVerifierForm";
import { useNavigate } from "react-router-dom";
import { useAuth } from '@/lib/auth';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export type ROIForecastersModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const LAST_USED_KEY = "roiForecasters:lastCalc";

// Shared: two-column on desktop, single on mobile
function GridTwoCols({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">{children}</div>;
}

function InputAffix({ children, prefix, suffix }: { children: React.ReactNode; prefix?: string; suffix?: string }) {
  return (
    <div className="relative">
      {prefix ? (
        <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground pointer-events-none">{prefix}</span>
      ) : null}
      {suffix ? (
        <span className="absolute inset-y-0 right-3 flex items-center text-muted-foreground pointer-events-none">{suffix}</span>
      ) : null}
      {children}
    </div>
  );
}

function SelectorView({ onPick, navigate, onOpenChange }: { 
  onPick: (k: CalcKey) => void;
  navigate: any;
  onOpenChange: (open: boolean) => void;
}) {
  const [last, setLast] = useState<CalcKey | null>(null);
  const { hasTierAccess } = useAuth();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  
  useEffect(() => {
    try {
      const v = localStorage.getItem(LAST_USED_KEY) as CalcKey | null;
      if (v) setLast(v);
    } catch {}
  }, []);
  const cardBase = "glass-surface elevate rounded-2xl hover-scale transition-shadow shadow-md hover:shadow-lg";
  
  // Restricted card component for Boardroom users
  const RestrictedCard = ({ 
    icon: Icon, 
    title, 
    description,
    last: isLast
  }: {
    icon: any;
    title: string;
    description: string;
    last?: boolean;
  }) => (
    <Card 
      className={`${cardBase} opacity-75 relative overflow-hidden`}
      role="button"
      onClick={() => setShowUpgradeDialog(true)}
      aria-label={`${title} - Restricted`}
    >
      <div className="absolute top-2 right-2 z-10">
        <Badge variant="destructive" className="text-xs">
          1:1 Only
        </Badge>
      </div>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-5 w-5" /> {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLast && <span className="text-xs text-muted-foreground">Last used</span>}
      </CardContent>
    </Card>
  );
  
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
        <Card
          className={cardBase}
          role="button"
          onClick={() => onPick("vendor")}
          aria-label="Open Vendor Verifier"
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Vendor Verifier
            </CardTitle>
            <CardDescription>Verify vendor performance and ROI</CardDescription>
          </CardHeader>
          <CardContent>
            {last === "vendor" && (
              <span className="text-xs text-muted-foreground">Last used</span>
            )}
          </CardContent>
        </Card>
        <Card className={cardBase} role="button" onClick={() => onPick("data")}
          aria-label="Open Data Lead Forecaster">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Data Lead Forecaster</CardTitle>
            <CardDescription>Estimate your return for Internet/Data Leads</CardDescription>
          </CardHeader>
          <CardContent>
            {last === "data" && <span className="text-xs text-muted-foreground">Last used</span>}
          </CardContent>
        </Card>
        <Card className={cardBase} role="button" onClick={() => onPick("mailer")} aria-label="Open Mailer Forecaster">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Mailer Forecaster</CardTitle>
            <CardDescription>Estimate your Direct Mail potential returns</CardDescription>
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
        {hasTierAccess('bonus-grid') ? (
          <Card className={cardBase} role="button" onClick={() => onPick("allstate_bonus_grid")} aria-label="Open Allstate Bonus Grid">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Allstate Bonus Grid</CardTitle>
              <CardDescription>Enter your baseline and production to see bonus, daily points, and items</CardDescription>
            </CardHeader>
            <CardContent>
              {last === "allstate_bonus_grid" && <span className="text-xs text-muted-foreground">Last used</span>}
            </CardContent>
          </Card>
        ) : (
          <RestrictedCard
            icon={Calculator}
            title="Allstate Bonus Grid"
            description="Enter your baseline and production to see bonus, daily points, and items"
            last={last === "allstate_bonus_grid"}
          />
        )}
        <Card 
          className={cardBase} 
          role="button" 
          onClick={() => window.open('https://quickquote-reality.lovable.app/', '_blank', 'noopener,noreferrer')} 
          aria-label="Open Producer Quote Details Dashboard"
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" /> Producer Quote Details Dashboard
              <ExternalLink className="h-4 w-4" />
            </CardTitle>
            <CardDescription>One quick upload and get some valuable insights.</CardDescription>
          </CardHeader>
        </Card>
        {hasTierAccess('roleplay-trainer') ? (
          <Card 
            className={cardBase} 
            role="button" 
            onClick={() => {
              onOpenChange(false);
              navigate("/roleplaybot");
            }} 
            aria-label="Open AI Sales Roleplay Trainer"
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" /> AI Sales Roleplay Trainer
              </CardTitle>
              <CardDescription>AI voice bot that trains and scores your team members.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <RestrictedCard
            icon={Mic}
            title="AI Sales Roleplay Trainer"
            description="AI voice bot that trains and scores your team members."
          />
        )}
      </div>
      
      {/* Upgrade Dialog for Restricted Access */}
      <AlertDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>1:1 Coaching Access Required</AlertDialogTitle>
            <AlertDialogDescription>
              This tool is accessible to "1:1 Coaching" clients only. 
              Please contact info@standardplaybook.com for more help.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowUpgradeDialog(false)}>
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type CalcKey = "vendor" | "data" | "mailer" | "transfer" | "allstate_bonus_grid";

export function ROIForecastersModal({ open, onOpenChange }: ROIForecastersModalProps) {
  const [mode, setMode] = useState<CalcKey | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) setMode(null);
  }, [open]);

  const handlePick = (k: CalcKey) => {
    if (k === "allstate_bonus_grid") {
      onOpenChange(false);
      navigate("/bonus-grid");
      return;
    }
    setMode(k);
    try { localStorage.setItem(LAST_USED_KEY, k); } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[85vh] overflow-y-auto glass-surface backdrop-blur-md rounded-2xl border border-border/60">
        <DialogHeader>
          <DialogTitle>Tools</DialogTitle>
          <DialogDescription>Choose Your Weapon</DialogDescription>
          <Badge variant="outline" className="w-fit mt-2 px-3 py-1 text-xs font-medium bg-muted/50 text-muted-foreground border-muted-foreground/20">
            EXPERIENCE BUILT FOR DESKTOP
          </Badge>
        </DialogHeader>

        {!mode && <SelectorView onPick={handlePick} navigate={navigate} onOpenChange={onOpenChange} />}
        {mode === "vendor" && (
          <div className="animate-enter">
            <VendorVerifierForm onBack={() => setMode(null)} />
          </div>
        )}
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

  

  const values = watch() as any;

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
          <InputAffix prefix="$">
            <Input id="spend" type="number" step="any" min={0} aria-invalid={!!errors.spend}
              className="pl-7"
              {...register("spend", { required: "Spend is required", min: { value: 0.01, message: "Must be greater than 0" } })}
            />
          </InputAffix>
          <p className="text-xs text-muted-foreground mt-1">Values shown in USD.</p>
        </div>
        <div>
          <Label htmlFor="cpl">Cost Per Lead</Label>
          <InputAffix prefix="$">
            <Input id="cpl" type="number" step="any" min={0} aria-invalid={!!errors.cpl}
              className="pl-7"
              {...register("cpl", { required: "Cost per lead is required", min: { value: 0.01, message: "Must be greater than 0" } })}
            />
          </InputAffix>
          <p className="text-xs text-muted-foreground mt-1">Values shown in USD.</p>
        </div>
        <div>
          <Label htmlFor="quoteRatePct">Quote Rate</Label>
          <InputAffix suffix="%">
            <Input id="quoteRatePct" type="number" step="any" min={0} max={100} aria-invalid={!!errors.quoteRatePct}
              className="pr-7"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                const n = normalizePercent(v);
                if (n !== v) setValue("quoteRatePct", n, { shouldValidate: true, shouldDirty: true });
              }}
               {...register("quoteRatePct", { required: "Quote rate is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" } })}
            />
          </InputAffix>
          <p className="text-xs text-muted-foreground mt-1">Enter as percent. 5 = 5%. 0.05 will convert to 5%.</p>
        </div>
        <div>
          <Label htmlFor="closeRatePct">Close Rate</Label>
          <InputAffix suffix="%">
            <Input id="closeRatePct" type="number" step="any" min={0} max={100} aria-invalid={!!errors.closeRatePct}
              className="pr-7"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                const n = normalizePercent(v);
                if (n !== v) setValue("closeRatePct", n, { shouldValidate: true, shouldDirty: true });
              }}
               {...register("closeRatePct", { required: "Close rate is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" } })}
            />
          </InputAffix>
          <p className="text-xs text-muted-foreground mt-1">Enter as percent. 5 = 5%. 0.05 will convert to 5%.</p>
        </div>
        <div>
          <Label htmlFor="avgItemValue">Average Item Value</Label>
          <InputAffix prefix="$">
            <Input id="avgItemValue" type="number" step="any" min={0} aria-invalid={!!errors.avgItemValue}
              className="pl-7"
               {...register("avgItemValue", { required: "Average item value is required", min: { value: 0, message: "Must be non-negative" } })}
            />
          </InputAffix>
          <p className="text-xs text-muted-foreground mt-1">Values shown in USD.</p>
        </div>
        <div>
          <Label htmlFor="avgItemsPerHH">Average Items Per HH</Label>
          <Input id="avgItemsPerHH" type="number" step="any" min={0} aria-invalid={!!errors.avgItemsPerHH}
             {...register("avgItemsPerHH", { required: "Average items per HH is required", min: { value: 0, message: "Must be non-negative" } })}
          />
        </div>
        <div>
          <Label htmlFor="commissionPct">Average Commission</Label>
          <InputAffix suffix="%">
            <Input id="commissionPct" type="number" step="any" min={0} max={100} aria-invalid={!!errors.commissionPct}
              className="pr-7"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                const n = normalizePercent(v);
                if (n !== v) setValue("commissionPct", n, { shouldValidate: true, shouldDirty: true });
              }}
               {...register("commissionPct", { required: "Commission is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" } })}
            />
          </InputAffix>
          <p className="text-xs text-muted-foreground mt-1">Enter as percent. 5 = 5%. 0.05 will convert to 5%.</p>
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
          <Button variant="gradient-glow" onClick={handleCopy}>Copy results</Button>
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

  const values = watch() as any;
  

  const normalizePercent = (v: number) => {
    if (!isFinite(v)) return 0;
    const val = v > 0 && v < 1 ? v * 100 : v;
    return clampPercent(val);
  };

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
  const canCalls = canMailers && values.responseRatePct !== undefined && values.responseRatePct !== '' && isFinite(Number(values.responseRatePct));
  const canQuoted = canCalls && values.quotedPctOfInboundPct !== undefined && values.quotedPctOfInboundPct !== '' && isFinite(Number(values.quotedPctOfInboundPct));
  const canClosedHH = canQuoted && values.closeRatePct !== undefined && values.closeRatePct !== '' && isFinite(Number(values.closeRatePct));
  const canSoldItems = canClosedHH && values.avgItemsPerHH !== undefined && values.avgItemsPerHH !== '' && isFinite(Number(values.avgItemsPerHH));
  const canSoldPremium = canSoldItems && values.avgItemValue !== undefined && values.avgItemValue !== '' && isFinite(Number(values.avgItemValue));
  const canTotalComp = canSoldPremium && values.commissionPct !== undefined && values.commissionPct !== '' && isFinite(Number(values.commissionPct));

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
          <InputAffix prefix="$">
            <Input id="spend" type="number" step="any" min={0} aria-invalid={!!errors.spend}
              className="pl-7"
              {...register("spend", { required: "Spend is required", min: { value: 0.01, message: "Must be greater than 0" } })}
            />
          </InputAffix>
          <p className="text-xs text-muted-foreground mt-1">Values shown in USD.</p>
        </div>
        <div>
          <Label htmlFor="costPerPiece">Cost Per Piece</Label>
          <InputAffix prefix="$">
            <Input id="costPerPiece" type="number" step="any" min={0} aria-invalid={!!errors.costPerPiece}
              className="pl-7"
              {...register("costPerPiece", { required: "Cost per piece is required", min: { value: 0.01, message: "Must be greater than 0" } })}
            />
          </InputAffix>
          <p className="text-xs text-muted-foreground mt-1">Values shown in USD.</p>
        </div>
        <div>
          <Label htmlFor="responseRatePct">Response Rate</Label>
          <InputAffix suffix="%">
            <Input id="responseRatePct" type="number" step="any" min={0} max={100} aria-invalid={!!errors.responseRatePct}
              className="pr-7"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                const n = normalizePercent(v);
                if (n !== v) setValue("responseRatePct", n, { shouldValidate: true, shouldDirty: true });
              }}
               {...register("responseRatePct", { required: "Response rate is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" } })}
            />
          </InputAffix>
          <p className="text-xs text-muted-foreground mt-1">Enter as percent. 5 = 5%. 0.05 will convert to 5%.</p>
        </div>
        <div>
          <Label htmlFor="quotedPctOfInboundPct">Quoted % of Inbound Calls</Label>
          <InputAffix suffix="%">
            <Input id="quotedPctOfInboundPct" type="number" step="any" min={0} max={100} aria-invalid={!!errors.quotedPctOfInboundPct}
              className="pr-7"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                const n = normalizePercent(v);
                if (n !== v) setValue("quotedPctOfInboundPct", n, { shouldValidate: true, shouldDirty: true });
              }}
               {...register("quotedPctOfInboundPct", { required: "Quoted % is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" } })}
            />
          </InputAffix>
          <p className="text-xs text-muted-foreground mt-1">Enter as percent. 5 = 5%. 0.05 will convert to 5%.</p>
        </div>
        <div>
          <Label htmlFor="closeRatePct">Close Rate</Label>
          <InputAffix suffix="%">
            <Input id="closeRatePct" type="number" step="any" min={0} max={100} aria-invalid={!!errors.closeRatePct}
              className="pr-7"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                const n = normalizePercent(v);
                if (n !== v) setValue("closeRatePct", n, { shouldValidate: true, shouldDirty: true });
              }}
               {...register("closeRatePct", { required: "Close rate is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" } })}
            />
          </InputAffix>
          <p className="text-xs text-muted-foreground mt-1">Enter as percent. 5 = 5%. 0.05 will convert to 5%.</p>
        </div>
        <div>
          <Label htmlFor="avgItemsPerHH">Average Items Per HH</Label>
          <Input id="avgItemsPerHH" type="number" step="any" min={0} aria-invalid={!!errors.avgItemsPerHH}
             {...register("avgItemsPerHH", { required: "Average items per HH is required", min: { value: 0, message: "Must be non-negative" } })}
          />
        </div>
        <div>
          <Label htmlFor="avgItemValue">Average Item Value</Label>
          <InputAffix prefix="$">
            <Input id="avgItemValue" type="number" step="any" min={0} aria-invalid={!!errors.avgItemValue}
              className="pl-7"
               {...register("avgItemValue", { required: "Average item value is required", min: { value: 0, message: "Must be non-negative" } })}
            />
          </InputAffix>
          <p className="text-xs text-muted-foreground mt-1">Values shown in USD.</p>
        </div>
        <div>
          <Label htmlFor="commissionPct">Average Commission</Label>
          <InputAffix suffix="%">
            <Input id="commissionPct" type="number" step="any" min={0} max={100} aria-invalid={!!errors.commissionPct}
              className="pr-7"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                const n = normalizePercent(v);
                if (n !== v) setValue("commissionPct", n, { shouldValidate: true, shouldDirty: true });
              }}
               {...register("commissionPct", { required: "Commission is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" } })}
            />
          </InputAffix>
          <p className="text-xs text-muted-foreground mt-1">Enter as percent. 5 = 5%. 0.05 will convert to 5%.</p>
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
          <Button variant="gradient-glow" onClick={handleCopy}>Copy results</Button>
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

  const values = watch() as any;
  

  const normalizePercent = (v: number) => {
    if (!isFinite(v)) return 0;
    const val = v > 0 && v < 1 ? v * 100 : v;
    return clampPercent(val);
  };

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
  const canQuoted = canTransfers && values.quotedPctOfInboundPct !== undefined && values.quotedPctOfInboundPct !== '' && isFinite(Number(values.quotedPctOfInboundPct));
  const canClosedHH = canQuoted && values.closeRatePct !== undefined && values.closeRatePct !== '' && isFinite(Number(values.closeRatePct));
  const canSoldItems = canClosedHH && values.avgItemsPerHH !== undefined && values.avgItemsPerHH !== '' && isFinite(Number(values.avgItemsPerHH));
  const canSoldPremium = canSoldItems && values.avgItemValue !== undefined && values.avgItemValue !== '' && isFinite(Number(values.avgItemValue));
  const canTotalComp = canSoldPremium && values.commissionPct !== undefined && values.commissionPct !== '' && isFinite(Number(values.commissionPct));

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
          <InputAffix prefix="$">
            <Input id="spend" type="number" step="any" min={0} aria-invalid={!!errors.spend}
              className="pl-7"
              {...register("spend", { required: "Spend is required", min: { value: 0.01, message: "Must be greater than 0" } })}
            />
          </InputAffix>
          <p className="text-xs text-muted-foreground mt-1">Values shown in USD.</p>
        </div>
        <div>
          <Label htmlFor="costPerTransfer">Cost Per Transfer</Label>
          <InputAffix prefix="$">
            <Input id="costPerTransfer" type="number" step="any" min={0} aria-invalid={!!errors.costPerTransfer}
              className="pl-7"
              {...register("costPerTransfer", { required: "Cost per transfer is required", min: { value: 0.01, message: "Must be greater than 0" } })}
            />
          </InputAffix>
          <p className="text-xs text-muted-foreground mt-1">Values shown in USD.</p>
        </div>
        <div>
          <Label htmlFor="quotedPctOfInboundPct">Quoted % of Inbound Calls</Label>
          <InputAffix suffix="%">
            <Input id="quotedPctOfInboundPct" type="number" step="any" min={0} max={100} aria-invalid={!!errors.quotedPctOfInboundPct}
              className="pr-7"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                const n = normalizePercent(v);
                if (n !== v) setValue("quotedPctOfInboundPct", n, { shouldValidate: true, shouldDirty: true });
              }}
               {...register("quotedPctOfInboundPct", { required: "Quoted % is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" } })}
            />
          </InputAffix>
          <p className="text-xs text-muted-foreground mt-1">Enter as percent. 5 = 5%. 0.05 will convert to 5%.</p>
        </div>
        <div>
          <Label htmlFor="closeRatePct">Close Rate</Label>
          <InputAffix suffix="%">
            <Input id="closeRatePct" type="number" step="any" min={0} max={100} aria-invalid={!!errors.closeRatePct}
              className="pr-7"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                const n = normalizePercent(v);
                if (n !== v) setValue("closeRatePct", n, { shouldValidate: true, shouldDirty: true });
               }}
               {...register("closeRatePct", { required: "Close rate is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" } })}
             />
          </InputAffix>
          <p className="text-xs text-muted-foreground mt-1">Enter as percent. 5 = 5%. 0.05 will convert to 5%.</p>
        </div>
        <div>
          <Label htmlFor="avgItemsPerHH">Average Items Per HH</Label>
           <Input id="avgItemsPerHH" type="number" step="any" min={0} aria-invalid={!!errors.avgItemsPerHH}
             {...register("avgItemsPerHH", { required: "Average items per HH is required", min: { value: 0, message: "Must be non-negative" } })}
           />
        </div>
        <div>
          <Label htmlFor="avgItemValue">Average Item Value</Label>
          <InputAffix prefix="$">
            <Input id="avgItemValue" type="number" step="any" min={0} aria-invalid={!!errors.avgItemValue}
              className="pl-7"
              {...register("avgItemValue", { required: "Average item value is required", min: { value: 0, message: "Must be non-negative" } })}
            />
          </InputAffix>
          <p className="text-xs text-muted-foreground mt-1">Values shown in USD.</p>
        </div>
        <div>
          <Label htmlFor="commissionPct">Average Commission</Label>
          <InputAffix suffix="%">
            <Input id="commissionPct" type="number" step="any" min={0} max={100} aria-invalid={!!errors.commissionPct}
              className="pr-7"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                const n = normalizePercent(v);
                if (n !== v) setValue("commissionPct", n, { shouldValidate: true, shouldDirty: true });
               }}
               {...register("commissionPct", { required: "Commission is required", min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" } })}
             />
          </InputAffix>
          <p className="text-xs text-muted-foreground mt-1">Enter as percent. 5 = 5%. 0.05 will convert to 5%.</p>
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
          <Button variant="gradient-glow" onClick={handleCopy}>Copy results</Button>
        </div>
      </div>
    </div>
  );
}

export default ROIForecastersModal;
