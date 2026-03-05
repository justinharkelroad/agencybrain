import { useCallback, useEffect, useMemo, useState } from "react";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AlertTriangle, Calendar, ChevronRight, CircleHelp, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { toast } from "sonner";
import { buildHouseholdFocusSaveRequest, type SaveTargetPayload } from "@/components/staff/plannerSaveScope";
import { HouseholdFocusDrilldownSheet, type DrilldownHousehold } from "@/components/staff/HouseholdFocusDrilldownSheet";

type GoalMode = "commission" | "items";
type PeriodKey = "this_week" | "last_week" | "this_month" | "last_month" | "custom";
const PANEL = "panel-highlight rounded-xl border border-border/60 bg-gradient-to-br from-card to-card/90 shadow-card dark:border-border/50 dark:from-card/80 dark:to-card/40 dark:shadow-none";
const SUBPANEL = "panel-highlight rounded-lg border border-border/60 bg-card shadow-sm dark:border-border/50 dark:bg-card/50 dark:shadow-none";

interface PlannerExperiencePreviewProps {
  isManager?: boolean;
  teamMembers?: Array<{ id: string; name: string }>;
  managerViewLabel?: string;
  onDayTargetChanged?: (quotedHhPerDay: number, periodTarget: number) => void;
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

interface PersistedTargetRow {
  team_member_id: string | null;
  mode: GoalMode;
  target_items: number;
  target_commission: number;
  close_rate: number;
  avg_items_per_household: number;
  avg_policies_per_household: number;
  avg_value_per_item: number;
}

const DEFAULT_GOAL: StaffGoal = {
  name: "Last Saved",
  mode: "items",
  targetCommission: 2160,
  targetItems: 30,
  closeRate: 20,
  avgItemsPerHousehold: 2.3,
  avgPoliciesPerHousehold: 1.8,
  avgValuePerItem: 900,
};

const MEMBER_DEFAULT_GOAL: StaffGoal = {
  ...DEFAULT_GOAL,
  name: "Member Default",
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

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const root = error as Record<string, unknown>;

  const context = root.context;
  if (context && typeof context === "object") {
    const contextStatus = (context as Record<string, unknown>).status;
    if (typeof contextStatus === "number") return contextStatus;
  }

  const status = root.status;
  if (typeof status === "number") return status;

  const response = root.response;
  if (response && typeof response === "object") {
    const responseStatus = (response as Record<string, unknown>).status;
    if (typeof responseStatus === "number") return responseStatus;
  }

  return undefined;
}

export function PlannerExperiencePreview({
  isManager = false,
  teamMembers = [],
  managerViewLabel = "Leadership View",
  onDayTargetChanged,
}: PlannerExperiencePreviewProps) {
  const { sessionToken, user, loading: staffAuthLoading } = useStaffAuth();
  const simulatedDate = useMemo(() => new Date(), []);

  // Local simulation state
  const hasCompPlan = true;
  const estimatedCommissionRate = 0.08;

  const [open, setOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("this_month");
  const [customStart, setCustomStart] = useState(() => toDateInputValue(new Date(simulatedDate.getFullYear(), simulatedDate.getMonth(), 1)));
  const [customEnd, setCustomEnd] = useState(() => toDateInputValue(new Date(simulatedDate.getFullYear(), simulatedDate.getMonth() + 1, 0)));
  const [viewAs, setViewAs] = useState<string>("team");
  const [mode, setMode] = useState<GoalMode>("items");
  const [targetItems, setTargetItems] = useState(30);
  const [targetCommission, setTargetCommission] = useState(2160);
  const [agencyDefaults] = useState({
    closeRate: 20,
    avgItemsPerHousehold: 2.3,
    avgPoliciesPerHousehold: 1.8,
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
  const [overrideIdsFromServer, setOverrideIdsFromServer] = useState<string[]>([]);
  const [isHydratingTargets, setIsHydratingTargets] = useState(false);
  const [isSavingTargets, setIsSavingTargets] = useState(false);
  const [currentStaffMemberId, setCurrentStaffMemberId] = useState<string | null>(null);
  const [periodActuals, setPeriodActuals] = useState<{
    period_quoted_count: number;
    today_quoted_count: number;
    period_sold_items: number;
    today_sold_items: number;
    days_with_data: number;
  } | null>(null);
  const [isLoadingActuals, setIsLoadingActuals] = useState(false);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownHouseholds, setDrilldownHouseholds] = useState<DrilldownHousehold[]>([]);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
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

  const viewAsOptions = useMemo(() => {
    const roster = teamMembers.map((m) => ({ id: m.id, name: m.name }));
    const existing = new Set(roster.map((m) => m.id));
    const extras = overrideIdsFromServer
      .filter((id) => !existing.has(id))
      .map((id) => ({ id, name: `Saved Override (${id.slice(0, 8)})` }));
    return [...roster, ...extras];
  }, [teamMembers, overrideIdsFromServer]);

  const viewingTeam = isManager && viewAs === "team";
  const isMemberContext = isManager && !viewingTeam && viewAs !== "team";
  const selectedMemberName =
    !viewingTeam && isManager
      ? viewAsOptions.find((m) => m.id === viewAs)?.name || "Team Member"
      : null;
  const hasMemberOverride = isMemberContext ? Boolean(memberOverrideGoals[viewAs]) : false;
  const memberOverrideCount = Object.keys(memberOverrideGoals).length;
  const memberItemsMax = Math.max(120, teamDefaultGoal.targetItems);
  const memberCommissionMax = Math.max(
    10000,
    commissionFromItems(memberItemsMax, agencyDefaults.avgValuePerItem, estimatedCommissionRate)
  );
  const targetItemsMin = viewingTeam ? 20 : 5;
  const targetItemsMax = viewingTeam ? 500 : memberItemsMax;
  const targetCommissionMin = viewingTeam ? 2000 : 500;
  const targetCommissionMax = viewingTeam ? 75000 : memberCommissionMax;
  const actualQuotedHHPerDay = periodActuals?.today_quoted_count ?? 0;
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

  const invokeOptions = useMemo(() => (
    sessionToken ? { headers: { "x-staff-session": sessionToken } } : {}
  ), [sessionToken]);

  const rowToGoal = useCallback((row: PersistedTargetRow): StaffGoal => ({
    name: row.team_member_id ? "Member Target" : "Team Default",
    mode: row.mode === "commission" ? "commission" : "items",
    targetItems: Math.max(1, Math.round(row.target_items || 0)),
    targetCommission: Math.max(0, Math.round(row.target_commission || 0)),
    closeRate: Number(row.close_rate || agencyDefaults.closeRate),
    avgItemsPerHousehold: Number(row.avg_items_per_household || agencyDefaults.avgItemsPerHousehold),
    avgPoliciesPerHousehold: Number(row.avg_policies_per_household || agencyDefaults.avgPoliciesPerHousehold),
    avgValuePerItem: Math.max(0, Math.round(row.avg_value_per_item || agencyDefaults.avgValuePerItem)),
  }), [agencyDefaults]);

  useEffect(() => {
    let mounted = true;
    const hydrateTargets = async (attempt = 0) => {
      setIsHydratingTargets(true);
      // Guard against startup race: in staff mode, token may not be hydrated yet.
      // Do not call the edge function until we have a valid auth context.
      if (!sessionToken) {
        if (staffAuthLoading) {
          if (mounted) setIsHydratingTargets(false);
          return;
        }
        const { data: sessionData } = await supabase.auth.getSession();
        const hasSupabaseSession = Boolean(sessionData.session);
        if (!hasSupabaseSession) {
          if (mounted) setIsHydratingTargets(false);
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke("household_focus_targets", {
        body: { action: "get" },
        ...invokeOptions,
      });

      if (mounted && !error && data?.success) {
        const teamDefaultRow = (data.team_default as PersistedTargetRow | null) ?? null;
        setCurrentStaffMemberId((data.current_member_id as string | null) ?? user?.team_member_id ?? null);
        if (teamDefaultRow) {
          setTeamDefaultGoal(rowToGoal(teamDefaultRow));
        }

        const incomingOverrides = (data.member_overrides || {}) as Record<string, PersistedTargetRow>;
        setOverrideIdsFromServer(Object.keys(incomingOverrides));
        const mappedOverrides = Object.entries(incomingOverrides).reduce<Record<string, StaffGoal>>((acc, [memberId, row]) => {
          acc[memberId] = rowToGoal(row);
          return acc;
        }, {});
        setMemberOverrideGoals(mappedOverrides);

        if (!isManager) {
          const currentMemberOverride = (data.current_member_override as PersistedTargetRow | null) ?? null;
          if (currentMemberOverride) {
            setStaffPersonalGoal(rowToGoal(currentMemberOverride));
          } else {
            setStaffPersonalGoal(MEMBER_DEFAULT_GOAL);
          }
        }
      } else if (error) {
        const status = getErrorStatus(error);
        // Hard refresh can briefly race auth/session bootstrap in preview environments.
        // Retry once on 401 before surfacing to the user.
        if (status === 401 && attempt === 0 && mounted) {
          setTimeout(() => {
            if (mounted) void hydrateTargets(1);
          }, 1200);
          setIsHydratingTargets(false);
          return;
        }
        console.error("[PlannerExperiencePreview] Failed to load persisted targets:", error);
        toast.error("Could not load saved household focus targets.");
      }

      if (mounted) setIsHydratingTargets(false);
    };

    hydrateTargets();
    return () => {
      mounted = false;
    };
  }, [sessionToken, isManager, user?.team_member_id, invokeOptions, rowToGoal, staffAuthLoading]);

  // Fetch real actuals from metrics_daily via edge function
  useEffect(() => {
    let mounted = true;
    const fetchActuals = async () => {
      // Guard: wait for auth to be ready
      if (!sessionToken) {
        if (staffAuthLoading) return;
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) return;
      }

      setIsLoadingActuals(true);
      const teamMemberId = viewingTeam
        ? null
        : isManager
          ? viewAs !== "team" ? viewAs : null
          : currentStaffMemberId || user?.team_member_id || null;

      const { data, error } = await supabase.functions.invoke("get-household-focus-actuals", {
        body: {
          team_member_id: teamMemberId,
          start_date: toDateInputValue(periodStart),
          end_date: toDateInputValue(periodEnd),
          today_date: toDateInputValue(simulatedDate),
        },
        ...invokeOptions,
      });

      if (mounted && !error && data) {
        setPeriodActuals({
          period_quoted_count: Number(data.period_quoted_count) || 0,
          today_quoted_count: Number(data.today_quoted_count) || 0,
          period_sold_items: Number(data.period_sold_items) || 0,
          today_sold_items: Number(data.today_sold_items) || 0,
          days_with_data: Number(data.days_with_data) || 0,
        });
      } else if (error) {
        console.error("[PlannerExperiencePreview] Failed to fetch actuals:", error);
        // On error, reset to zero rather than showing stale data
        if (mounted) setPeriodActuals(null);
      }
      if (mounted) setIsLoadingActuals(false);
    };

    fetchActuals();
    return () => { mounted = false; };
  }, [
    sessionToken,
    staffAuthLoading,
    invokeOptions,
    viewingTeam,
    isManager,
    viewAs,
    currentStaffMemberId,
    user?.team_member_id,
    periodStart,
    periodEnd,
    simulatedDate,
  ]);

  const openDrilldown = useCallback(async () => {
    setDrilldownOpen(true);
    setDrilldownLoading(true);
    setDrilldownHouseholds([]);

    const teamMemberId = viewingTeam
      ? null
      : isManager
        ? viewAs !== "team" ? viewAs : null
        : currentStaffMemberId || user?.team_member_id || null;

    const { data, error } = await supabase.functions.invoke("get-household-focus-actuals", {
      body: {
        action: "list",
        team_member_id: teamMemberId,
        start_date: toDateInputValue(periodStart),
        end_date: toDateInputValue(periodEnd),
      },
      ...invokeOptions,
    });

    if (!error && data?.households) {
      setDrilldownHouseholds(data.households as DrilldownHousehold[]);
    } else if (error) {
      console.error("[PlannerExperiencePreview] Failed to fetch household list:", error);
    }
    setDrilldownLoading(false);
  }, [viewingTeam, isManager, viewAs, currentStaffMemberId, user?.team_member_id, periodStart, periodEnd, invokeOptions]);

  useEffect(() => {
    if (!isManager) return;
    if (viewAs === "team") return;
    const exists = viewAsOptions.some((m) => m.id === viewAs);
    if (!exists) setViewAs("team");
  }, [isManager, viewAs, viewAsOptions]);

  useEffect(() => {
    const activeGoal: StaffGoal = isManager
      ? viewingTeam
        ? teamDefaultGoal
        : memberOverrideGoals[viewAs] ?? {
            ...MEMBER_DEFAULT_GOAL,
            name: `${selectedMemberName || "Team Member"} Default`,
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

  // Notify parent of the computed day target (used by AgencyMetricRings)
  useEffect(() => {
    if (onDayTargetChanged && viewingTeam) {
      onDayTargetChanged(derived.quotedHouseholdsPerDay, derived.quotedHouseholdsNeeded);
    }
  }, [onDayTargetChanged, derived.quotedHouseholdsPerDay, derived.quotedHouseholdsNeeded, viewingTeam]);

  // The plan target is monthly, so custom/weekly views should pro-rate by business days.
  const periodShare = bizTotal / baseMonthBusinessDays;
  const targetPeriodQuotedHH = ceilSafe(derived.quotedHouseholdsNeeded * periodShare);
  const actualQuotedHHPeriod = periodActuals?.period_quoted_count ?? 0;
  const reviewPerDay = ceilSafe(actualQuotedHHPeriod / Math.max(1, bizTotal));
  const actualPerDay = isPastPeriod ? reviewPerDay : actualQuotedHHPerDay;
  const activeRequiredPerDay = isPastPeriod
    ? ceilSafe(targetPeriodQuotedHH / Math.max(1, bizTotal))
    : requiredPerDay;
  const periodVariance = actualQuotedHHPeriod - targetPeriodQuotedHH;
  const periodHitRate = clamp(Math.round((actualQuotedHHPeriod / Math.max(1, targetPeriodQuotedHH)) * 100), 0, 999);

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

    const doSave = async () => {
      setIsSavingTargets(true);
      if (isManager) {
        const payload: SaveTargetPayload = {
          mode,
          target_items: newPreset.targetItems,
          target_commission: newPreset.targetCommission,
          close_rate: newPreset.closeRate,
          avg_items_per_household: newPreset.avgItemsPerHousehold,
          avg_policies_per_household: newPreset.avgPoliciesPerHousehold,
          avg_value_per_item: newPreset.avgValuePerItem,
        };

        const body = buildHouseholdFocusSaveRequest({
          isManager: true,
          viewingTeam,
          viewAs,
          staffMemberId: null,
          target: payload,
        });

        const { data, error } = await supabase.functions.invoke("household_focus_targets", {
          body,
          ...invokeOptions,
        });

        if (error || !data?.success) {
          console.error("[PlannerExperiencePreview] Failed to persist manager target:", error || data?.error);
          toast.error("Save failed. No target changes were saved.");
          setIsSavingTargets(false);
          return;
        }

        if (viewingTeam) {
          setTeamDefaultGoal(newPreset);
          toast.success("Team default target saved.");
        } else if (viewAs !== "team") {
          setMemberOverrideGoals((prev) => ({ ...prev, [viewAs]: newPreset }));
          setOverrideIdsFromServer((prev) => (prev.includes(viewAs) ? prev : [...prev, viewAs]));
          toast.success(`${selectedMemberName || "Member"} target saved.`);
        }
      } else {
        // Staff can only save personal target for their own member scope.
        const staffMemberId = currentStaffMemberId || user?.team_member_id;
        if (!staffMemberId) {
          console.error("[PlannerExperiencePreview] Missing staff member id for personal save");
          toast.error("Save failed. Your account is not linked to a team member.");
          setIsSavingTargets(false);
          return;
        }

        const payload: SaveTargetPayload = {
          mode,
          target_items: newPreset.targetItems,
          target_commission: newPreset.targetCommission,
          close_rate: newPreset.closeRate,
          avg_items_per_household: newPreset.avgItemsPerHousehold,
          avg_policies_per_household: newPreset.avgPoliciesPerHousehold,
          avg_value_per_item: newPreset.avgValuePerItem,
        };

        const body = buildHouseholdFocusSaveRequest({
          isManager: false,
          viewingTeam: false,
          viewAs,
          staffMemberId: staffMemberId ?? null,
          target: payload,
        });

        const { data, error } = await supabase.functions.invoke("household_focus_targets", {
          body,
          ...invokeOptions,
        });

        if (error || !data?.success) {
          console.error("[PlannerExperiencePreview] Failed to persist staff target:", error || data?.error);
          toast.error("Save failed. No target changes were saved.");
          setIsSavingTargets(false);
          return;
        }

        setStaffPersonalGoal(newPreset);
        toast.success("Your target saved.");
      }

      setIsSavingTargets(false);
      setOpen(false);
    };

    void doSave();
  };

  const onResetMemberTarget = () => {
    if (!isMemberContext) return;
    const doReset = async () => {
      setIsSavingTargets(true);
      const { data, error } = await supabase.functions.invoke("household_focus_targets", {
        body: { action: "reset_member", team_member_id: viewAs },
        ...invokeOptions,
      });

      if (error || !data?.success) {
        console.error("[PlannerExperiencePreview] Failed to reset member target:", error || data?.error);
        toast.error("Reset failed. Member target was not changed.");
        setIsSavingTargets(false);
        return;
      }

      setMemberOverrideGoals((prev) => {
        const next = { ...prev };
        delete next[viewAs];
        return next;
      });
      setOverrideIdsFromServer((prev) => prev.filter((id) => id !== viewAs));
      toast.success(`${selectedMemberName || "Member"} now uses member defaults.`);
      setIsSavingTargets(false);
      setOpen(false);
    };

    void doReset();
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
                    {viewingTeam ? "Team Default" : hasMemberOverride ? "Custom Member Target" : "Using Member Default"}
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
              {selectedMemberName || "This member"} is currently using member defaults. Create a member target only if they need a different plan.
            </p>
          )}
          {isManager && viewingTeam && memberOverrideCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {memberOverrideCount} member override{memberOverrideCount === 1 ? "" : "s"} active. Entire Team view shows team default targets; select a team member in View As to see their custom target.
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
                    {viewAsOptions.map((member) => (
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
              onClick={isPastPeriod ? openDrilldown : undefined}
            />
          </div>
          <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isLoadingActuals && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-[1px]">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              </div>
            )}
            <SemiGauge
              title={viewingTeam ? "Team Quoted HH" : "Quoted Households"}
              todayLabel={isPastPeriod ? "Avg" : "Today"}
              today={`${actualPerDay} / ${activeRequiredPerDay}`}
              period={`${actualQuotedHHPeriod} of ${targetPeriodQuotedHH}`}
              progress={quotedPeriodProgress}
              colorClass="text-cyan-600 dark:text-cyan-400"
              onPeriodClick={openDrilldown}
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
            <DialogDescription>Set your targets and assumptions.</DialogDescription>
          </DialogHeader>

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
                  <span className="text-muted-foreground">Business days ({periodOptions[selectedPeriod].label})</span>
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
                    {selectedMemberName || "This team member"} is currently using member defaults. Saving here creates a member-specific target.
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
                        const nextCommission = clamp(v[0] ?? 2160, targetCommissionMin, targetCommissionMax);
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
                        const nextItems = clamp(v[0] ?? 30, targetItemsMin, targetItemsMax);
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
                    min={2}
                    max={60}
                    step={1}
                    onValueChange={(v) => setCloseRate(clamp(v[0] ?? 20, 2, 60))}
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
                    onValueChange={(v) => setAvgItemsPerHousehold(clamp(v[0] ?? 2.3, 0.5, 4))}
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
                    onValueChange={(v) => setAvgPoliciesPerHousehold(clamp(v[0] ?? 1.8, 0.5, 3))}
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
                        <Button size="sm" onClick={onSaveGoal} disabled={isSavingTargets || isHydratingTargets}>
                          {isSavingTargets ? "Saving..." : "Save Targets"}
                        </Button>
                      ) : (
                        <>
                          {hasMemberOverride && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={onResetMemberTarget}
                              disabled={isSavingTargets || isHydratingTargets}
                            >
                              Use Team Default
                            </Button>
                          )}
                          <Button size="sm" onClick={onSaveGoal} disabled={isSavingTargets || isHydratingTargets}>
                            {isSavingTargets ? "Saving..." : "Save Targets"}
                          </Button>
                        </>
                      )
                    ) : (
                      <Button size="sm" onClick={onSaveGoal} disabled={isSavingTargets || isHydratingTargets}>
                        {isSavingTargets ? "Saving..." : "Save Targets"}
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isManager
                    ? viewingTeam
                      ? "Saving team defaults updates team-level targets and team view."
                      : `Saving ${selectedMemberName || "this team member"} target does not change team defaults.`
                    : "Saving replaces your previous saved plan."}
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
        </DialogContent>
      </Dialog>

      <HouseholdFocusDrilldownSheet
        open={drilldownOpen}
        onOpenChange={setDrilldownOpen}
        households={drilldownHouseholds}
        loading={drilldownLoading}
        title={viewingTeam ? "Team Quoted Households" : "Quoted Households"}
      />
    </>
  );
}

function MiniStat({ label, value, accent = false, onClick }: { label: string; value: string; accent?: boolean; onClick?: () => void }) {
  return (
    <div
      className={cn(SUBPANEL, "p-3", accent && "border-amber-500/40 bg-amber-500/10", onClick && "cursor-pointer hover:border-primary/40 transition-colors")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-semibold mt-1", onClick && "underline decoration-dotted underline-offset-4")}>{value}</p>
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
  onPeriodClick,
}: {
  title: string;
  todayLabel?: string;
  today: string;
  period: string;
  progress: number;
  colorClass?: string;
  onPeriodClick?: () => void;
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
      {onPeriodClick ? (
        <button
          type="button"
          className="text-sm text-center font-medium mt-1 w-full underline decoration-dotted underline-offset-4 hover:text-primary transition-colors cursor-pointer"
          onClick={onPeriodClick}
        >
          {period} this period
        </button>
      ) : (
        <p className="text-sm text-center font-medium mt-1">{period} this period</p>
      )}
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
