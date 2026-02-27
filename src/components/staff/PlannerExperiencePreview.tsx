import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getBusinessDaysElapsed, getBusinessDaysInMonth } from "@/utils/businessDays";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronRight, Sparkles, Target } from "lucide-react";

type GoalMode = "commission" | "items";
type PlannerStep = "plan" | "confidence";

interface StaffGoal {
  name: string;
  mode: GoalMode;
  targetCommission: number;
  targetItems: number;
  closeRate: number;
  avgItemsPerHousehold: number;
  avgPoliciesPerHousehold: number;
  avgValuePerItem: number;
}

const DEFAULT_GOAL: StaffGoal = {
  name: "Last Saved",
  mode: "items",
  targetCommission: 0,
  targetItems: 17,
  closeRate: 29,
  avgItemsPerHousehold: 2.0,
  avgPoliciesPerHousehold: 1.4,
  avgValuePerItem: 900,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function ceilSafe(value: number): number {
  return Number.isFinite(value) ? Math.ceil(value) : 0;
}

function formatOneDecimal(value: number): string {
  return value.toFixed(1);
}

function commissionFromItems(items: number, avgValuePerItem: number, commissionRate: number): number {
  return Math.round(items * avgValuePerItem * commissionRate);
}

function itemsFromCommission(commissionTarget: number, avgValuePerItem: number, commissionRate: number): number {
  return ceilSafe(commissionTarget / Math.max(avgValuePerItem * commissionRate, 1));
}

function formatPresetSummary(goal: StaffGoal): string {
  return `Aim for ${goal.targetItems} sold items/month, assuming ${goal.closeRate}% of quoted households close, ${formatOneDecimal(goal.avgItemsPerHousehold)} items per closed household, and $${Math.round(goal.avgValuePerItem).toLocaleString()} average value per item.`;
}

export function PlannerExperiencePreview() {
  const now = new Date();
  const simulatedDate = new Date(now.getFullYear(), 2, 1); // March 1 local year for full-month testing
  const bizTotal = getBusinessDaysInMonth(simulatedDate);
  const bizElapsed = getBusinessDaysElapsed(simulatedDate);
  const bizRemaining = Math.max(1, bizTotal - bizElapsed);

  // Local simulation state
  const hasCompPlan = true;

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<PlannerStep>("plan");
  const [mode, setMode] = useState<GoalMode>("items");
  const [targetItems, setTargetItems] = useState(17);
  const [targetCommission, setTargetCommission] = useState(2448);
  const [agencyDefaults] = useState({
    closeRate: 29,
    avgItemsPerHousehold: 2.0,
    avgPoliciesPerHousehold: 1.4,
    avgValuePerItem: 900,
  });
  const [closeRate, setCloseRate] = useState(agencyDefaults.closeRate);
  const [avgItemsPerHousehold, setAvgItemsPerHousehold] = useState(agencyDefaults.avgItemsPerHousehold);
  const [avgPoliciesPerHousehold, setAvgPoliciesPerHousehold] = useState(agencyDefaults.avgPoliciesPerHousehold);
  const [avgValuePerItem, setAvgValuePerItem] = useState(agencyDefaults.avgValuePerItem);
  const [lastSavedGoal, setLastSavedGoal] = useState<StaffGoal>(DEFAULT_GOAL);

  const estimatedCommissionRate = 0.16;
  const actualQuotedHHPerDay = 5;

  const derived = useMemo(() => {
    const effectiveItemsTarget = mode === "commission"
      ? ceilSafe(targetCommission / Math.max(avgValuePerItem * estimatedCommissionRate, 1))
      : targetItems;

    const householdsToClose = ceilSafe(effectiveItemsTarget / Math.max(avgItemsPerHousehold, 0.1));
    const policiesToClose = ceilSafe(householdsToClose * Math.max(avgPoliciesPerHousehold, 0.1));
    const quotedHouseholdsNeeded = ceilSafe(householdsToClose / Math.max(closeRate / 100, 0.01));
    const quotedHouseholdsPerDay = ceilSafe(quotedHouseholdsNeeded / bizRemaining);
    const estimatedWrittenPremium = effectiveItemsTarget * avgValuePerItem;
    const paceDelta = actualQuotedHHPerDay - quotedHouseholdsPerDay;

    return {
      itemsTarget: effectiveItemsTarget,
      householdsToClose,
      policiesToClose,
      quotedHouseholdsNeeded,
      quotedHouseholdsPerDay,
      estimatedWrittenPremium,
      paceDelta,
    };
  }, [
    mode,
    targetCommission,
    targetItems,
    closeRate,
    avgItemsPerHousehold,
    avgPoliciesPerHousehold,
    avgValuePerItem,
    bizRemaining,
  ]);

  const nextBestAction = derived.paceDelta >= 0
    ? `Keep current pace. Maintain at least ${derived.quotedHouseholdsPerDay} quoted households/day.`
    : `Need +${Math.abs(derived.paceDelta)} more quoted households/day to recover pace this month.`;

  const onSaveGoal = () => {
    const newPreset: StaffGoal = {
      name: "Last Saved",
      mode,
      targetCommission: mode === "commission" ? targetCommission : 0,
      targetItems: derived.itemsTarget,
      closeRate,
      avgItemsPerHousehold,
      avgPoliciesPerHousehold,
      avgValuePerItem,
    };
    setLastSavedGoal(newPreset);
  };

  const onModeChange = (next: string) => {
    if (next === "commission" && !hasCompPlan) return;
    setMode(next as GoalMode);
  };

  return (
    <>
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Today&apos;s Planner</CardTitle>
              <CardDescription>At-a-glance plan metrics. Open full planner to adjust assumptions.</CardDescription>
            </div>
            <Badge variant="outline">Local Preview</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <MiniStat label="Items Needed" value={derived.itemsTarget.toString()} />
            <MiniStat label="Households To Close" value={derived.householdsToClose.toString()} />
            <MiniStat label="Policies To Close" value={derived.policiesToClose.toString()} />
            <MiniStat label="Quoted HH Needed" value={derived.quotedHouseholdsNeeded.toString()} />
            <MiniStat label="Quoted HH / Day" value={derived.quotedHouseholdsPerDay.toString()} />
            <MiniStat label="Est. Written Premium" value={`$${Math.round(derived.estimatedWrittenPremium).toLocaleString()}`} />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setOpen(true);
                setStep("plan");
              }}
            >
              Open Planner
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              My Pipeline Planner
            </DialogTitle>
            <DialogDescription>
              {step === "plan" ? "Step 1: Set your target and assumptions." : "Step 2: Review confidence and next best action."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <button
              className={cn(
                "px-3 py-1.5 rounded-md text-sm border",
                step === "plan" ? "bg-primary text-primary-foreground border-primary" : "bg-background"
              )}
              onClick={() => setStep("plan")}
            >
              1. Today Plan
            </button>
            <button
              className={cn(
                "px-3 py-1.5 rounded-md text-sm border",
                step === "confidence" ? "bg-primary text-primary-foreground border-primary" : "bg-background"
              )}
              onClick={() => setStep("confidence")}
            >
              2. Confidence + Actions
            </button>
          </div>

          {step === "plan" ? (
            <div className="space-y-4">
              {!hasCompPlan && (
                <div className="rounded-lg border border-amber-300/40 bg-amber-500/10 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4" />
                    No compensation plan assigned
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Planner defaults to item targets and agency assumptions until a comp plan is assigned.
                  </p>
                </div>
              )}

              <div className="rounded-lg border bg-card p-4 space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Business days (simulated date: March 1)</span>
                  <span>{bizElapsed} elapsed of {bizTotal} ({bizRemaining} left)</span>
                </div>

                <Tabs value={mode} onValueChange={onModeChange}>
                  <TabsList>
                    <TabsTrigger value="items">Target Items Written</TabsTrigger>
                    <TabsTrigger
                      value="commission"
                      disabled={!hasCompPlan}
                      className={cn(!hasCompPlan && "opacity-50 cursor-not-allowed")}
                    >
                      Target Commission $
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {mode === "commission" ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Monthly Commission Target</span>
                      <span className="font-semibold">${targetCommission.toLocaleString()}</span>
                    </div>
                    <Slider
                      value={[targetCommission]}
                      min={500}
                      max={10000}
                      step={100}
                      onValueChange={(v) => {
                        const nextCommission = clamp(v[0] ?? 2500, 500, 10000);
                        setTargetCommission(nextCommission);
                        setTargetItems(itemsFromCommission(nextCommission, avgValuePerItem, estimatedCommissionRate));
                      }}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Items Written Target</span>
                      <span className="font-semibold">{targetItems} / month</span>
                    </div>
                    <Slider
                      value={[targetItems]}
                      min={5}
                      max={120}
                      step={1}
                      onValueChange={(v) => {
                        const nextItems = clamp(v[0] ?? 17, 5, 120);
                        setTargetItems(nextItems);
                        setTargetCommission(commissionFromItems(nextItems, avgValuePerItem, estimatedCommissionRate));
                      }}
                    />
                  </div>
                )}

                <SliderRow
                  label="Close Rate"
                  valueLabel={`${closeRate}%`}
                  helper={`Default from your agency is ${agencyDefaults.closeRate}%.`}
                >
                  <Slider
                    value={[closeRate]}
                    min={10}
                    max={60}
                    step={1}
                    onValueChange={(v) => setCloseRate(clamp(v[0] ?? 29, 10, 60))}
                  />
                </SliderRow>

                <SliderRow
                  label="Avg Items Per Household"
                  valueLabel={formatOneDecimal(avgItemsPerHousehold)}
                  helper={`Default from your agency is ${formatOneDecimal(agencyDefaults.avgItemsPerHousehold)} items/household.`}
                >
                  <Slider
                    value={[avgItemsPerHousehold]}
                    min={0.5}
                    max={4}
                    step={0.1}
                    onValueChange={(v) => setAvgItemsPerHousehold(clamp(v[0] ?? 2, 0.5, 4))}
                  />
                </SliderRow>

                <SliderRow
                  label="Avg Policies Per Household"
                  valueLabel={formatOneDecimal(avgPoliciesPerHousehold)}
                  helper={`Default from your agency is ${formatOneDecimal(agencyDefaults.avgPoliciesPerHousehold)} policies/household.`}
                >
                  <Slider
                    value={[avgPoliciesPerHousehold]}
                    min={0.5}
                    max={3}
                    step={0.1}
                    onValueChange={(v) => setAvgPoliciesPerHousehold(clamp(v[0] ?? 1.4, 0.5, 3))}
                  />
                </SliderRow>

                <SliderRow
                  label="Avg Value Per Item"
                  valueLabel={`$${avgValuePerItem.toLocaleString()}`}
                  helper={`Default from your agency is $${agencyDefaults.avgValuePerItem.toLocaleString()} per item.`}
                >
                  <Slider
                    value={[avgValuePerItem]}
                    min={300}
                    max={3000}
                    step={25}
                    onValueChange={(v) => {
                      const nextValue = clamp(v[0] ?? 900, 300, 3000);
                      setAvgValuePerItem(nextValue);
                      if (mode === "items") {
                        setTargetCommission(commissionFromItems(targetItems, nextValue, estimatedCommissionRate));
                      } else {
                        setTargetItems(itemsFromCommission(targetCommission, nextValue, estimatedCommissionRate));
                      }
                    }}
                  />
                </SliderRow>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <MetricCard label="Items Needed" value={derived.itemsTarget.toString()} />
                <MetricCard label="Households To Close" value={derived.householdsToClose.toString()} />
                <MetricCard label="Policies To Close" value={derived.policiesToClose.toString()} />
                <MetricCard label="Quoted HH Needed" value={derived.quotedHouseholdsNeeded.toString()} />
                <MetricCard label="Quoted HH / Day" value={derived.quotedHouseholdsPerDay.toString()} accent />
                <MetricCard label="Est. Written Premium" value={`$${Math.round(derived.estimatedWrittenPremium).toLocaleString()}`} />
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Last Saved Plan</p>
                  <Button size="sm" onClick={onSaveGoal}>Save Current Goal</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Saving replaces your previous saved plan.
                </p>
                <div className="text-sm text-muted-foreground">
                  {formatPresetSummary(lastSavedGoal)}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-primary font-medium">
                  <Sparkles className="h-4 w-4" />
                  Next Best Action
                </div>
                <p>{nextBestAction}</p>
                <p className="text-sm text-muted-foreground">
                  Current pace: {actualQuotedHHPerDay} quoted HH/day. Required pace: {derived.quotedHouseholdsPerDay} quoted HH/day.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            {step === "plan" ? (
              <Button onClick={() => setStep("confidence")}>Continue to Confidence</Button>
            ) : (
              <Button onClick={() => setOpen(false)}>Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MiniStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3", accent ? "border-amber-500/40 bg-amber-500/10" : "bg-card")}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

function SliderRow({
  label,
  valueLabel,
  helper,
  children,
}: {
  label: string;
  valueLabel: string;
  helper: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold">{valueLabel}</span>
      </div>
      {children}
      <p className="text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function MetricCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3 bg-card", accent && "border-primary/40 bg-primary/5")}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
