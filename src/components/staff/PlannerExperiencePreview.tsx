import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AlertTriangle, Calendar, ChevronRight, CircleHelp, Sparkles, Target } from "lucide-react";

type GoalMode = "commission" | "items";
type PlannerStep = "plan" | "confidence";
type PeriodKey = "this_week" | "last_week" | "this_month" | "last_month" | "custom";
const PANEL = "panel-highlight rounded-xl border border-border/50 bg-gradient-to-br from-card/80 to-card/40";
const SUBPANEL = "panel-highlight rounded-lg border border-border/50 bg-card/50";

interface PlannerExperiencePreviewProps {
  isManager?: boolean;
  teamMembers?: Array<{ id: string; name: string }>;
  managerViewLabel?: "Manager View" | "Owner View";
}

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

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function countBusinessDaysInRange(start: Date, end: Date): number {
  const from = startOfDay(start);
  const to = startOfDay(end);
  if (to < from) return 0;
  let count = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function getWeekRange(anchor: Date, weekOffset: number): { start: Date; end: Date } {
  const base = startOfDay(anchor);
  const day = base.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(base);
  start.setDate(base.getDate() + mondayOffset + weekOffset * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function formatPeriodRange(start: Date, end: Date): string {
  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateInputValue(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function PlannerExperiencePreview({
  isManager = false,
  teamMembers = [],
  managerViewLabel = "Manager View",
}: PlannerExperiencePreviewProps) {
  const simulatedDate = useMemo(() => new Date(new Date().getFullYear(), 2, 1), []); // March 1 local year for full-month testing

  // Local simulation state
  const hasCompPlan = true;
  const estimatedCommissionRate = 0.16;

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<PlannerStep>("plan");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("this_month");
  const [customStart, setCustomStart] = useState(() => toDateInputValue(new Date(simulatedDate.getFullYear(), simulatedDate.getMonth(), 1)));
  const [customEnd, setCustomEnd] = useState(() => toDateInputValue(new Date(simulatedDate.getFullYear(), simulatedDate.getMonth() + 1, 0)));
  const [viewAs, setViewAs] = useState<string>("team");
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
  const [teamDefaultGoal, setTeamDefaultGoal] = useState<StaffGoal>({
    ...DEFAULT_GOAL,
    mode: "items",
    targetItems: 120,
    targetCommission: commissionFromItems(120, agencyDefaults.avgValuePerItem, estimatedCommissionRate),
    closeRate: agencyDefaults.closeRate,
    avgItemsPerHousehold: agencyDefaults.avgItemsPerHousehold,
    avgPoliciesPerHousehold: agencyDefaults.avgPoliciesPerHousehold,
    avgValuePerItem: agencyDefaults.avgValuePerItem,
  });
  const [staffPersonalGoal, setStaffPersonalGoal] = useState<StaffGoal>(DEFAULT_GOAL);
  const [memberOverrideGoals, setMemberOverrideGoals] = useState<Record<string, StaffGoal>>({});
  const periodOptions = useMemo(() => {
    const thisWeek = getWeekRange(simulatedDate, 0);
    const lastWeek = getWeekRange(simulatedDate, -1);
    const thisMonth = {
      start: new Date(simulatedDate.getFullYear(), simulatedDate.getMonth(), 1),
      end: new Date(simulatedDate.getFullYear(), simulatedDate.getMonth() + 1, 0),
    };
    const lastMonth = {
      start: new Date(simulatedDate.getFullYear(), simulatedDate.getMonth() - 1, 1),
      end: new Date(simulatedDate.getFullYear(), simulatedDate.getMonth(), 0),
    };
    const customStartDate = fromDateInputValue(customStart) || thisMonth.start;
    const customEndDate = fromDateInputValue(customEnd) || thisMonth.end;
    return {
      this_week: { label: "This Week", ...thisWeek },
      last_week: { label: "Last Week", ...lastWeek },
      this_month: { label: "This Month", ...thisMonth },
      last_month: { label: "Last Month", ...lastMonth },
      custom: { label: "Custom Range", start: customStartDate, end: customEndDate },
    } as const;
  }, [simulatedDate, customStart, customEnd]);
  const periodDef = periodOptions[selectedPeriod];
  const periodStart = periodDef.end < periodDef.start ? periodDef.end : periodDef.start;
  const periodEnd = periodDef.end < periodDef.start ? periodDef.start : periodDef.end;
  const periodLabel = formatPeriodRange(periodStart, periodEnd);
  const simulatedDay = startOfDay(simulatedDate);
  const isPastPeriod = periodEnd < simulatedDay;
  const isFuturePeriod = periodStart > simulatedDay;
  const bizTotal = countBusinessDaysInRange(periodStart, periodEnd);
  const baseMonthStart = new Date(simulatedDate.getFullYear(), simulatedDate.getMonth(), 1);
  const baseMonthEnd = new Date(simulatedDate.getFullYear(), simulatedDate.getMonth() + 1, 0);
  const baseMonthBusinessDays = Math.max(1, countBusinessDaysInRange(baseMonthStart, baseMonthEnd));
  const bizElapsed = isFuturePeriod
    ? 0
    : isPastPeriod
      ? bizTotal
      : countBusinessDaysInRange(periodStart, simulatedDay);
  const bizRemaining = Math.max(1, bizTotal - bizElapsed);

  const viewingTeam = isManager && viewAs === "team";
  const isMemberContext = isManager && !viewingTeam && viewAs !== "team";
  const selectedMemberName =
    !viewingTeam && isManager
      ? teamMembers.find((m) => m.id === viewAs)?.name || "Team Member"
      : null;
  const hasMemberOverride = isMemberContext ? Boolean(memberOverrideGoals[viewAs]) : false;
  const memberItemsMax = Math.max(120, teamDefaultGoal.targetItems);
  const memberCommissionMax = Math.max(
    10000,
    commissionFromItems(memberItemsMax, agencyDefaults.avgValuePerItem, estimatedCommissionRate)
  );
  const targetItemsMin = viewingTeam ? 20 : 5;
  const targetItemsMax = viewingTeam ? 500 : memberItemsMax;
  const targetCommissionMin = viewingTeam ? 2000 : 500;
  const targetCommissionMax = viewingTeam ? 75000 : memberCommissionMax;
  const actualQuotedHHPerDay = viewingTeam ? 20 : 5;
  const managerActionLabel = viewingTeam
    ? "Adjust Team Targets"
    : hasMemberOverride
      ? `Adjust ${selectedMemberName || "Member"} Target`
      : `Create ${selectedMemberName || "Member"} Target`;
  const activeContextLabel = isManager
    ? viewingTeam
      ? "Team Default Target"
      : hasMemberOverride
        ? `${selectedMemberName || "Team Member"} Custom Target`
        : `${selectedMemberName || "Team Member"} Target (Inherited)`
    : "My Saved Target";

  useEffect(() => {
    const activeGoal: StaffGoal = isManager
      ? viewingTeam
        ? teamDefaultGoal
        : memberOverrideGoals[viewAs] ?? {
            ...teamDefaultGoal,
            name: `${selectedMemberName || "Team Member"} Target`,
          }
      : staffPersonalGoal;

    setMode(activeGoal.mode);
    setTargetItems(activeGoal.targetItems);
    setTargetCommission(
      activeGoal.targetCommission || commissionFromItems(
        activeGoal.targetItems,
        activeGoal.avgValuePerItem,
        estimatedCommissionRate
      )
    );
    setCloseRate(activeGoal.closeRate);
    setAvgItemsPerHousehold(activeGoal.avgItemsPerHousehold);
    setAvgPoliciesPerHousehold(activeGoal.avgPoliciesPerHousehold);
    setAvgValuePerItem(activeGoal.avgValuePerItem);
  }, [
    isManager,
    viewingTeam,
    viewAs,
    selectedMemberName,
    teamDefaultGoal,
    memberOverrideGoals,
    staffPersonalGoal,
  ]);

  useEffect(() => {
    const clampedItems = clamp(targetItems, targetItemsMin, targetItemsMax);
    if (clampedItems !== targetItems) {
      setTargetItems(clampedItems);
    }
    const clampedCommission = clamp(targetCommission, targetCommissionMin, targetCommissionMax);
    if (clampedCommission !== targetCommission) {
      setTargetCommission(clampedCommission);
    }
  }, [
    viewingTeam,
    targetItems,
    targetCommission,
    targetItemsMin,
    targetItemsMax,
    targetCommissionMin,
    targetCommissionMax,
  ]);

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
    actualQuotedHHPerDay,
  ]);

  const requiredPerDay = derived.quotedHouseholdsPerDay;
  // Preview-only attainment model must be range-driven (not selector-driven),
  // so the same date range always renders the same percentages.
  const mockAttainmentRate = isPastPeriod ? 0.88 : isFuturePeriod ? 0.2 : 0.46;
  // The plan target is monthly, so custom/weekly views should pro-rate by business days.
  const periodShare = bizTotal / baseMonthBusinessDays;
  const targetPeriodQuotedHH = ceilSafe(derived.quotedHouseholdsNeeded * periodShare);
  const actualQuotedHHPeriod = Math.round(targetPeriodQuotedHH * mockAttainmentRate);
  const reviewPerDay = ceilSafe(actualQuotedHHPeriod / Math.max(1, bizTotal));
  const actualPerDay = isPastPeriod ? reviewPerDay : actualQuotedHHPerDay;
  const activeRequiredPerDay = isPastPeriod
    ? ceilSafe(targetPeriodQuotedHH / Math.max(1, bizTotal))
    : requiredPerDay;
  const teamPaceDelta = actualPerDay - requiredPerDay;
  const periodVariance = actualQuotedHHPeriod - targetPeriodQuotedHH;
  const periodHitRate = clamp(Math.round((actualQuotedHHPeriod / Math.max(1, targetPeriodQuotedHH)) * 100), 0, 999);

  const nextBestAction = isPastPeriod
    ? periodVariance >= 0
      ? `Last period closed strong. Keep this same activity mix; target beat by ${periodVariance} quoted households.`
      : `Last period missed by ${Math.abs(periodVariance)} quoted households. Raise quoting pace by +${Math.max(1, ceilSafe(Math.abs(periodVariance) / Math.max(1, bizTotal)))} HH/day this period.`
    : teamPaceDelta >= 0
      ? `${viewingTeam ? "Team is" : "You are"} on pace. Maintain at least ${activeRequiredPerDay} quoted households/day${viewingTeam ? " across the team" : ""}.`
      : `Need +${Math.abs(teamPaceDelta)} more quoted households/day${viewingTeam ? " across the team" : ""} to recover pace this period.`;

  const quotedPeriodProgress = clamp(
    Math.round((actualQuotedHHPeriod / Math.max(1, targetPeriodQuotedHH)) * 100),
    0,
    100
  );
  const quotedTodayProgress = clamp(
    Math.round((actualPerDay / Math.max(1, activeRequiredPerDay)) * 100),
    0,
    100
  );

  const onSaveGoal = () => {
    const newPreset: StaffGoal = {
      name: "Last Saved",
      mode,
      targetCommission,
      targetItems: derived.itemsTarget,
      closeRate,
      avgItemsPerHousehold,
      avgPoliciesPerHousehold,
      avgValuePerItem,
    };
    if (isManager) {
      if (viewingTeam) {
        setTeamDefaultGoal(newPreset);
      } else if (viewAs !== "team") {
        setMemberOverrideGoals((prev) => ({ ...prev, [viewAs]: newPreset }));
      }
      setOpen(false);
      setStep("plan");
      return;
    }
    setStaffPersonalGoal(newPreset);
    setOpen(false);
    setStep("plan");
  };

  const onResetMemberTarget = () => {
    if (!isMemberContext) return;
    setMemberOverrideGoals((prev) => {
      const next = { ...prev };
      delete next[viewAs];
      return next;
    });
    setOpen(false);
    setStep("plan");
  };

  const onModeChange = (next: string) => {
    if (next === "commission" && !hasCompPlan) return;
    setMode(next as GoalMode);
  };

  return (
    <>
      <Card className={PANEL}>
        <CardHeader>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">
                  {isManager
                    ? viewingTeam
                      ? "Team Household Focus"
                      : `${selectedMemberName} Household Focus`
                    : "Household Focus"}
                </CardTitle>
                {isManager && (
                  <Badge variant="outline">
                    {viewingTeam ? "Team Default" : hasMemberOverride ? "Custom Member Target" : "Using Team Default"}
                  </Badge>
                )}
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/70 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                        aria-label="How this section works"
                      >
                        <CircleHelp className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="start" className="max-w-[320px] p-3">
                      <p className="text-xs font-semibold mb-1">How this card works</p>
                      <p className="text-xs leading-relaxed">
                        Quoted HH Needed sets the target for the selected period. Quoted HH shows progress toward that target. The second gauge shows pace against required daily target (today for active periods, average for completed periods). Use Adjust Targets to change assumptions.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <CardDescription>Period: {periodLabel}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as PeriodKey)}>
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="last_week">Last Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
              {isManager && <Badge variant="secondary">{managerViewLabel}</Badge>}
              <Button
                size="sm"
                className="whitespace-nowrap"
                onClick={() => {
                setOpen(true);
                setStep("plan");
              }}
              >
                {isManager ? (
                  <>
                    <span className="sm:hidden">Adjust</span>
                    <span className="hidden sm:inline">{managerActionLabel}</span>
                  </>
                ) : (
                  "Adjust Targets"
                )}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
          {isManager && !viewingTeam && !hasMemberOverride && (
            <p className="text-xs text-muted-foreground">
              {selectedMemberName || "This member"} is currently using team defaults. Create a member target only if they need a different plan.
            </p>
          )}
          {selectedPeriod === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Start Date</p>
                <DateInput value={customStart} onChange={setCustomStart} />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">End Date</p>
                <DateInput value={customEnd} onChange={setCustomEnd} />
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            {isManager && (
              <div className={cn(SUBPANEL, "p-2.5")}>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">View As</p>
                <Select value={viewAs} onValueChange={setViewAs}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select view" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team">Entire Team</SelectItem>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {teamMembers.length === 0 && (
                  <p className="mt-2 text-xs text-amber-300">
                    No active team members were returned for this agency yet.
                  </p>
                )}
              </div>
            )}
            <MiniStat
              label={isPastPeriod
                ? (viewingTeam ? "Team Target Quoted HH (Period)" : "Target Quoted HH (Period)")
                : (viewingTeam ? "Team Quoted HH Needed (Period)" : "Quoted HH Needed (Period)")}
              value={targetPeriodQuotedHH.toString()}
            />
            <MiniStat
              label={isPastPeriod
                ? (viewingTeam ? "Team Actual Quoted HH (Period)" : "Actual Quoted HH (Period)")
                : (viewingTeam ? "Team Quoted HH / Day Target" : "Quoted HH / Day Target")}
              value={isPastPeriod ? actualQuotedHHPeriod.toString() : activeRequiredPerDay.toString()}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SemiGauge
              title={viewingTeam ? "Team Quoted HH" : "Quoted Households"}
              todayLabel={isPastPeriod ? "Avg" : "Today"}
              today={`${actualPerDay} / ${activeRequiredPerDay}`}
              period={`${actualQuotedHHPeriod} of ${targetPeriodQuotedHH}`}
              progress={quotedPeriodProgress}
              colorClass="text-cyan-400"
            />
            <SemiGauge
              title={isPastPeriod
                ? (viewingTeam ? "Team Quoted HH Daily Avg" : "Quoted HH Daily Avg")
                : (viewingTeam ? "Team Quoted HH Today" : "Quoted HH Today")}
              todayLabel={isPastPeriod ? "Avg" : "Today"}
              today={`${actualPerDay} / ${activeRequiredPerDay}`}
              period={isPastPeriod
                ? `${quotedTodayProgress}% of avg daily target`
                : `${quotedTodayProgress}% of daily target`}
              progress={quotedTodayProgress}
              colorClass="text-indigo-400"
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {isManager
                ? viewingTeam
                  ? "Team Household Focus"
                  : `${selectedMemberName || "Team Member"} Household Focus`
                : "Household Focus"}
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

              <div className={cn(PANEL, "p-4 space-y-4")}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Business days ({periodOptions[selectedPeriod].label}, simulated date: March 1)</span>
                  <span>{bizElapsed} elapsed of {bizTotal} ({bizRemaining} left)</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    {isPastPeriod ? "Review mode: showing target vs actual for a completed period." : "Plan mode: showing required pace for remaining business days."}
                  </div>
                  <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as PeriodKey)}>
                    <SelectTrigger className="h-8 w-[145px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="this_week">This Week</SelectItem>
                      <SelectItem value="last_week">Last Week</SelectItem>
                      <SelectItem value="this_month">This Month</SelectItem>
                      <SelectItem value="last_month">Last Month</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {selectedPeriod === "custom" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Custom Start</p>
                      <DateInput value={customStart} onChange={setCustomStart} />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Custom End</p>
                      <DateInput value={customEnd} onChange={setCustomEnd} />
                    </div>
                  </div>
                )}

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
                {viewingTeam && (
                  <p className="text-xs text-muted-foreground">
                    Team mode uses total team targets for the selected period, not per-person targets.
                  </p>
                )}
                {isManager && !viewingTeam && (
                  <p className="text-xs text-muted-foreground">
                    Member mode uses per-person targets for {selectedMemberName || "this team member"}.
                  </p>
                )}
                {isManager && !viewingTeam && !hasMemberOverride && (
                  <div className="rounded-md border border-border/60 bg-muted/20 p-2 text-xs text-muted-foreground">
                    {selectedMemberName || "This team member"} is currently inheriting team defaults. Saving here creates a member-specific target.
                  </div>
                )}

                {mode === "commission" ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{viewingTeam ? "Team Monthly Commission Target" : "Monthly Commission Target"}</span>
                      <span className="font-semibold">${targetCommission.toLocaleString()}</span>
                    </div>
                    <Slider
                      value={[targetCommission]}
                      min={targetCommissionMin}
                      max={targetCommissionMax}
                      step={100}
                      onValueChange={(v) => {
                        const nextCommission = clamp(v[0] ?? 2500, targetCommissionMin, targetCommissionMax);
                        setTargetCommission(nextCommission);
                        setTargetItems(clamp(
                          itemsFromCommission(nextCommission, avgValuePerItem, estimatedCommissionRate),
                          targetItemsMin,
                          targetItemsMax
                        ));
                      }}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{viewingTeam ? "Team Items Written Target" : "Items Written Target"}</span>
                      <span className="font-semibold">{targetItems} / month</span>
                    </div>
                    <Slider
                      value={[targetItems]}
                      min={targetItemsMin}
                      max={targetItemsMax}
                      step={1}
                      onValueChange={(v) => {
                        const nextItems = clamp(v[0] ?? 17, targetItemsMin, targetItemsMax);
                        setTargetItems(nextItems);
                        setTargetCommission(clamp(
                          commissionFromItems(nextItems, avgValuePerItem, estimatedCommissionRate),
                          targetCommissionMin,
                          targetCommissionMax
                        ));
                      }}
                    />
                    {!viewingTeam && (
                      <p className="text-[11px] text-muted-foreground">
                        Per-person max auto-scales with team default (current max: {targetItemsMax}).
                      </p>
                    )}
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
              {isPastPeriod && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard label="Target Quoted HH" value={targetPeriodQuotedHH.toString()} />
                  <MetricCard label="Actual Quoted HH" value={actualQuotedHHPeriod.toString()} />
                  <MetricCard label="Variance" value={`${periodVariance >= 0 ? "+" : ""}${periodVariance}`} accent={periodVariance >= 0} />
                  <MetricCard label="Hit Rate" value={`${periodHitRate}%`} accent={periodHitRate >= 100} />
                </div>
              )}

              <div className={cn(SUBPANEL, "p-3 space-y-2")}>
                <div className="flex items-center justify-between">
                  <p className="font-medium">{activeContextLabel}</p>
                  <div className="flex items-center gap-2">
                    {isManager ? (
                      viewingTeam ? (
                        <Button size="sm" onClick={onSaveGoal}>Save Team Defaults</Button>
                      ) : (
                        <>
                          {hasMemberOverride && (
                            <Button size="sm" variant="outline" onClick={onResetMemberTarget}>
                              Use Team Default
                            </Button>
                          )}
                          <Button size="sm" onClick={onSaveGoal}>
                            Save {selectedMemberName || "Member"} Target
                          </Button>
                        </>
                      )
                    ) : (
                      <Button size="sm" onClick={onSaveGoal}>Save Current Goal</Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isManager
                    ? viewingTeam
                      ? "Saving team defaults updates what staff sees by default."
                      : `Saving ${selectedMemberName || "this team member"} target does not change team defaults.`
                    : "Saving replaces your previous saved plan."}
                </p>
                <p className="text-xs text-amber-300">
                  Preview mode: this save is local to your current session and is not yet synced to production targets.
                </p>
                <div className="text-sm text-muted-foreground">
                  {formatPresetSummary({
                    name: activeContextLabel,
                    mode,
                    targetCommission,
                    targetItems: derived.itemsTarget,
                    closeRate,
                    avgItemsPerHousehold,
                    avgPoliciesPerHousehold,
                    avgValuePerItem,
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={cn(SUBPANEL, "border-primary/30 bg-primary/5 p-4 space-y-2")}>
                <div className="flex items-center gap-2 text-primary font-medium">
                  <Sparkles className="h-4 w-4" />
                  Next Best Action
                </div>
                <p>{nextBestAction}</p>
                <p className="text-sm text-muted-foreground">
                  Current pace: {actualPerDay} quoted HH/day. Required pace: {activeRequiredPerDay} quoted HH/day.
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
    <div className={cn(SUBPANEL, "p-3", accent && "border-amber-500/40 bg-amber-500/10")}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

function SemiGauge({
  title,
  todayLabel = "Today",
  today,
  period,
  progress,
  colorClass,
}: {
  title: string;
  todayLabel?: string;
  today: string;
  period: string;
  progress: number;
  colorClass?: string;
}) {
  const radius = 52;
  const circumference = Math.PI * radius;
  const normalized = clamp(progress, 0, 100);
  const dash = (normalized / 100) * circumference;

  return (
    <div className={cn(SUBPANEL, "p-3")}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{title}</p>
      <div className="flex items-center justify-center">
        <svg width="130" height="78" viewBox="0 0 130 78" role="img" aria-label={`${title} progress ${normalized}%`}>
          <path
            d="M 13 65 A 52 52 0 0 1 117 65"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M 13 65 A 52 52 0 0 1 117 65"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            className={cn("transition-all", colorClass)}
            style={{ strokeDasharray: `${dash} ${circumference}` }}
          />
          <text x="65" y="48" textAnchor="middle" className="fill-current text-[16px] font-semibold text-foreground">
            {normalized}%
          </text>
        </svg>
      </div>
      <p className="text-xs text-center text-muted-foreground">{todayLabel} {today}</p>
      <p className="text-sm text-center font-medium mt-1">{period} this period</p>
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

function DateInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative">
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
        style={{ colorScheme: "dark" }}
      />
      <Calendar className="h-4 w-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}
