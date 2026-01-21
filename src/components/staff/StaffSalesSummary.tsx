import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { DollarSign, Package, FileText, Trophy, Users, Upload, BarChart3, AlertTriangle, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { useNavigate } from "react-router-dom";
import { GoalProgressRing } from "@/components/sales/GoalProgressRing";
import { StatOrb } from "@/components/sales/StatOrb";
import { StaffPromoGoalsWidget } from "@/components/sales/StaffPromoGoalsWidget";
import { SalesBreakdownTabs } from "@/components/sales/SalesBreakdownTabs";
import { RankBadgeHeader } from "@/components/sales/RankBadge";
import { StreakBadge } from "@/components/sales/StreakBadge";
import { MiniLeaderboard } from "@/components/sales/MiniLeaderboard";
import { GoalConfetti } from "@/components/sales/Confetti";
import { TierProgressCard } from "@/components/sales/TierProgressCard";
import { cn } from "@/lib/utils";
import {
  getBusinessDaysInMonth,
  getBusinessDaysElapsed,
  calculateProjection,
  formatProjection
} from "@/utils/businessDays";

interface StaffSalesSummaryProps {
  agencyId: string;
  teamMemberId: string;
  showViewAll?: boolean;
}

interface SalesTotals {
  premium: number;
  items: number;
  points: number;
  policies: number;
  households: number;
}

interface SalesTrends {
  premium: number | null;
  items: number | null;
  points: number | null;
  policies: number | null;
  households: number | null;
}

interface SalesStreak {
  current: number;
  longest: number;
  last_sale_date: string | null;
}

interface MyRank {
  rank: number;
  total_producers: number;
}

interface LeaderboardEntry {
  team_member_id: string;
  name: string;
  items: number;
  premium: number;
  points: number;
  policies: number;
  households: number;
  rank?: number;
}

interface SalesDataWithGamification {
  totals: SalesTotals;
  trends: SalesTrends | null;
  streak: SalesStreak | null;
  my_rank: MyRank | null;
  leaderboard: LeaderboardEntry[];
}

interface TierData {
  currentTier: { min_threshold: number; commission_value: number } | null;
  nextTier: { min_threshold: number; commission_value: number } | null;
  currentCommission: number;
  nextCommission: number | null;
  targetValue: number | null;
  amountNeeded: number;
  atMaxTier: boolean;
  belowFirstTier: boolean;
}

// Helper to get metric value based on metric type
function getMetricValue(totals: SalesTotals | null, metric: string): number {
  if (!totals) return 0;
  switch (metric) {
    case "premium": return totals.premium;
    case "items": return totals.items;
    case "policies": return totals.policies;
    case "points": return totals.points;
    default: return totals.premium;
  }
}

// Helper to format metric value
function formatMetricValue(value: number, metric: string): string {
  if (metric === "premium") {
    return `$${value.toLocaleString()}`;
  }
  return value.toLocaleString();
}

// Calculate tier progress
function calculateTierGoal(
  tiers: Array<{ min_threshold: number; commission_value: number }> | null,
  currentValue: number
): TierData | null {
  if (!tiers?.length) return null;
  
  // Sort by min_threshold ascending
  const sorted = [...tiers].sort((a, b) => 
    Number(a.min_threshold) - Number(b.min_threshold)
  );
  
  let currentTier = null;
  let nextTier = null;
  
  for (const tier of sorted) {
    if (currentValue >= Number(tier.min_threshold)) {
      currentTier = tier;
    } else if (!nextTier) {
      nextTier = tier;
    }
  }
  
  const belowFirstTier = !currentTier && sorted.length > 0;
  const atMaxTier = !!currentTier && !nextTier;
  
  return {
    currentTier,
    nextTier,
    currentCommission: currentTier ? Number(currentTier.commission_value) : 0,
    nextCommission: nextTier ? Number(nextTier.commission_value) : null,
    targetValue: nextTier ? Number(nextTier.min_threshold) : (belowFirstTier ? Number(sorted[0].min_threshold) : null),
    amountNeeded: nextTier 
      ? Number(nextTier.min_threshold) - currentValue 
      : (belowFirstTier ? Number(sorted[0].min_threshold) - currentValue : 0),
    atMaxTier,
    belowFirstTier,
  };
}

export function StaffSalesSummary({ agencyId, teamMemberId, showViewAll = false }: StaffSalesSummaryProps) {
  const { sessionToken } = useStaffAuth();
  const navigate = useNavigate();
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [viewMode, setViewMode] = useState<"personal" | "team">("personal");
  
  const today = new Date();
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");
  
  // Use business days instead of calendar days
  const bizDaysElapsed = getBusinessDaysElapsed(today);
  const bizDaysTotal = getBusinessDaysInMonth(today);

  // Fetch lead sources for staff to use in edit modal
  const { data: leadSources = [] } = useQuery({
    queryKey: ["staff-lead-sources", agencyId, sessionToken],
    queryFn: async () => {
      if (!sessionToken) return [];
      
      const { data, error } = await supabase.functions.invoke('get_staff_lead_sources', {
        headers: { 'x-staff-session': sessionToken },
      });
      
      if (error || data?.error) {
        console.error('Error fetching lead sources:', error || data?.error);
        return [];
      }
      
      return (data?.lead_sources || []) as { id: string; name: string }[];
    },
    enabled: !!agencyId && !!sessionToken,
  });

  // Fetch personal sales with gamification data
  const { data: personalData, isLoading } = useQuery({
    queryKey: ["staff-sales-summary", agencyId, teamMemberId, monthStart, monthEnd, sessionToken],
    queryFn: async (): Promise<SalesDataWithGamification> => {
      if (sessionToken) {
        const { data, error } = await supabase.functions.invoke('get_staff_sales', {
          headers: { 'x-staff-session': sessionToken },
          body: {
            date_start: monthStart,
            date_end: monthEnd,
            include_leaderboard: true,
            scope: "personal"
          }
        });

        if (error) {
          console.error('Error fetching staff sales summary:', error);
          throw error;
        }

        if (data?.error) {
          console.error('Staff sales summary error:', data.error);
          throw new Error(data.error);
        }

        return {
          totals: {
            premium: data.totals?.premium || 0,
            items: data.totals?.items || 0,
            points: data.totals?.points || 0,
            policies: data.totals?.policies || 0,
            households: data.totals?.households || 0,
          },
          trends: data.trends || null,
          streak: data.streak || null,
          my_rank: data.my_rank || null,
          leaderboard: data.leaderboard || [],
        };
      }

      const { data: salesData, error } = await supabase
        .from("sales")
        .select(`
          id,
          customer_name,
          total_premium,
          total_items,
          total_points,
          sale_policies(id)
        `)
        .eq("agency_id", agencyId)
        .eq("team_member_id", teamMemberId)
        .gte("sale_date", monthStart)
        .lte("sale_date", monthEnd);

      if (error) throw error;

      const uniqueCustomers = new Set(salesData?.map(s => s.customer_name?.toLowerCase().trim()).filter(Boolean));

      const totals = (salesData || []).reduce(
        (acc, sale) => ({
          premium: acc.premium + (sale.total_premium || 0),
          items: acc.items + (sale.total_items || 0),
          points: acc.points + (sale.total_points || 0),
          policies: acc.policies + ((sale.sale_policies as any[])?.length || 0),
          households: uniqueCustomers.size,
        }),
        { premium: 0, items: 0, points: 0, policies: 0, households: 0 }
      );

      return {
        totals,
        trends: null,
        streak: null,
        my_rank: null,
        leaderboard: [],
      };
    },
    enabled: !!agencyId && !!teamMemberId,
  });

  // Fetch team sales (only when toggle is on team)
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ["staff-team-sales", agencyId, monthStart, monthEnd, sessionToken],
    queryFn: async (): Promise<SalesDataWithGamification | null> => {
      if (!sessionToken) return null;

      const { data, error } = await supabase.functions.invoke('get_staff_sales', {
        headers: { 'x-staff-session': sessionToken },
        body: {
          date_start: monthStart,
          date_end: monthEnd,
          include_leaderboard: true,
          scope: "team"
        }
      });

      if (error || data?.error) {
        console.error('Error fetching team sales:', error || data?.error);
        return null;
      }

      return {
        totals: {
          premium: data.totals?.premium || 0,
          items: data.totals?.items || 0,
          points: data.totals?.points || 0,
          policies: data.totals?.policies || 0,
          households: data.totals?.households || 0,
        },
        trends: data.trends || null,
        streak: null, // Team view doesn't have personal streak
        my_rank: null,
        leaderboard: data.leaderboard || [],
      };
    },
    enabled: viewMode === "team" && !!sessionToken,
  });

  // Fetch goal data
  const { data: goalData } = useQuery({
    queryKey: ["staff-sales-goal", agencyId, teamMemberId, sessionToken],
    queryFn: async () => {
      if (!sessionToken) {
        return { goal: 0, type: "agency", name: null, measurement: "premium", has_personal_goal: false };
      }

      const { data, error } = await supabase.functions.invoke('get_staff_goal', {
        headers: { 'x-staff-session': sessionToken },
        body: { team_member_id: teamMemberId }
      });

      if (error || data?.error) {
        console.error('Error fetching staff goal:', error || data?.error);
        return { goal: 0, type: "agency", name: null, measurement: "premium", has_personal_goal: false };
      }

      return data || { goal: 0, type: "agency", name: null, measurement: "premium", has_personal_goal: false };
    },
    enabled: !!agencyId && !!teamMemberId && !!sessionToken,
  });

  // Fetch commission data for tier display
  const { data: commissionData } = useQuery({
    queryKey: ["staff-commission", teamMemberId, today.getMonth() + 1, today.getFullYear(), sessionToken],
    queryFn: async () => {
      if (!sessionToken) return null;
      
      const { data, error } = await supabase.functions.invoke("get-staff-commission", {
        headers: { "x-staff-session": sessionToken },
        body: { 
          month: today.getMonth() + 1, 
          year: today.getFullYear() 
        }
      });
      
      if (error || data?.error) {
        console.error('Error fetching commission data:', error || data?.error);
        return null;
      }
      
      return data;
    },
    enabled: !!sessionToken && !!teamMemberId,
  });

  // Determine which data to display based on view mode
  const displayData = viewMode === "personal" ? personalData : teamData;
  const displayLoading = viewMode === "personal" ? isLoading : teamLoading;

  // Extract totals from the nested structure
  const premium = displayData?.totals?.premium || 0;
  const items = displayData?.totals?.items || 0;
  const points = displayData?.totals?.points || 0;
  const policies = displayData?.totals?.policies || 0;
  const households = displayData?.totals?.households || 0;

  // Extract gamification data (personal view only)
  const trends = viewMode === "personal" ? personalData?.trends : displayData?.trends;
  const streak = personalData?.streak;
  const myRank = personalData?.my_rank;
  const leaderboard = useMemo(() => {
    const data = viewMode === "personal" ? personalData?.leaderboard : teamData?.leaderboard;
    if (!data) return [];
    // Sort by items descending, add rank, and ensure policies/households have defaults
    return [...data]
      .sort((a, b) => b.items - a.items)
      .map((entry, index) => ({
        ...entry,
        policies: entry.policies ?? 0,
        households: entry.households ?? 0,
        rank: index + 1,
      }));
  }, [viewMode, personalData?.leaderboard, teamData?.leaderboard]);
  
  // Calculate projections for all metrics using business days
  const premiumProj = calculateProjection(premium, bizDaysElapsed, bizDaysTotal);
  const itemsProj = calculateProjection(items, bizDaysElapsed, bizDaysTotal);
  const pointsProj = calculateProjection(points, bizDaysElapsed, bizDaysTotal);
  const policiesProj = calculateProjection(policies, bizDaysElapsed, bizDaysTotal);
  const householdsProj = calculateProjection(households, bizDaysElapsed, bizDaysTotal);
  
  const dailyRate = bizDaysElapsed > 0 ? premium / bizDaysElapsed : 0;

  // Smart goal selection
  const goalConfig = useMemo(() => {
    // For team view, always use agency goal
    if (viewMode === "team") {
      const metric = goalData?.measurement || "premium";
      return {
        type: "agency" as const,
        target: goalData?.goal || 0,
        current: getMetricValue(teamData?.totals || null, metric),
        metric,
        label: goalData?.name || "Agency Goal",
        sublabel: null,
        footer: null,
        banner: null,
        showCelebration: false,
        formatValue: (v: number) => formatMetricValue(v, metric)
      };
    }

    // Priority 1: Personal goal
    if (goalData?.has_personal_goal && goalData?.goal) {
      const metric = goalData.measurement || "premium";
      return {
        type: "personal" as const,
        target: goalData.goal,
        current: getMetricValue(personalData?.totals || null, metric),
        metric,
        label: goalData.name || "Personal Goal",
        sublabel: null,
        footer: null,
        banner: null,
        showCelebration: false,
        formatValue: (v: number) => formatMetricValue(v, metric)
      };
    }
    
    // Priority 2: Commission plan tier
    if (commissionData?.plan && commissionData?.tiers?.length > 0) {
      const tierMetric = commissionData.plan.tier_metric || "premium";
      // Use commission data's current values for consistency
      const currentMetricValue = tierMetric === "premium"
        ? (commissionData.current_month_written_premium || getMetricValue(personalData?.totals || null, tierMetric))
        : tierMetric === "items"
          ? (commissionData.current_month_written_items || getMetricValue(personalData?.totals || null, tierMetric))
          : getMetricValue(personalData?.totals || null, tierMetric);
      
      const tierData = calculateTierGoal(commissionData.tiers, currentMetricValue);
      
      if (tierData) {
        // At max tier - celebration state
        if (tierData.atMaxTier) {
          return {
            type: "max_tier" as const,
            target: currentMetricValue,
            current: currentMetricValue,
            metric: tierMetric,
            label: `Top Tier: ${tierData.currentCommission}%`,
            sublabel: "Maximum tier achieved!",
            footer: null,
            banner: null,
            showCelebration: true,
            formatValue: (v: number) => formatMetricValue(v, tierMetric)
          };
        }
        
        // Below first tier
        if (tierData.belowFirstTier && tierData.nextCommission !== null) {
          return {
            type: "tier" as const,
            target: tierData.targetValue || 0,
            current: currentMetricValue,
            metric: tierMetric,
            label: `First Tier: ${tierData.nextCommission}%`,
            sublabel: "Current: 0%",
            footer: `${formatMetricValue(tierData.amountNeeded, tierMetric)} to unlock`,
            banner: null,
            showCelebration: false,
            formatValue: (v: number) => formatMetricValue(v, tierMetric)
          };
        }
        
        // Working toward next tier (normal case)
        if (tierData.nextTier && tierData.nextCommission !== null) {
          return {
            type: "tier" as const,
            target: tierData.targetValue || 0,
            current: currentMetricValue,
            metric: tierMetric,
            label: `Next: ${tierData.nextCommission}%`,
            sublabel: `Current: ${tierData.currentCommission}%`,
            footer: `${formatMetricValue(tierData.amountNeeded, tierMetric)} to unlock`,
            banner: null,
            showCelebration: false,
            formatValue: (v: number) => formatMetricValue(v, tierMetric)
          };
        }
      }
    }
    
    // Priority 3: Agency goal fallback
    if (goalData?.goal) {
      const metric = goalData.measurement || "premium";
      return {
        type: "agency" as const,
        target: goalData.goal,
        current: getMetricValue(personalData?.totals || null, metric),
        metric,
        label: goalData.name || "Agency Goal",
        sublabel: null,
        footer: null,
        banner: {
          type: "warning" as const,
          message: "No personal goal set. Progress is based on the agency goal."
        },
        showCelebration: false,
        formatValue: (v: number) => formatMetricValue(v, metric)
      };
    }
    
    // No goal at all
    return {
      type: "none" as const,
      target: 0,
      current: premium,
      metric: "premium",
      label: "No Goal",
      sublabel: null,
      footer: null,
      banner: {
        type: "info" as const,
        message: "No goal or commission plan configured. Ask your manager to set one up."
      },
      showCelebration: false,
      formatValue: (v: number) => `$${v.toLocaleString()}`
    };
  }, [viewMode, personalData?.totals, teamData?.totals, goalData, commissionData, premium]);

  // Transform commission data to TierProgress format for TierProgressCard
  const tierProgress = useMemo(() => {
    if (!commissionData?.plan || !commissionData?.tiers?.length) return null;

    const tierMetric = commissionData.plan.tier_metric || "items";
    const payoutType = commissionData.plan.payout_type || "flat_per_item";

    // Get current value based on tier metric
    const currentValue = tierMetric === "premium"
      ? (commissionData.current_month_written_premium || getMetricValue(personalData?.totals || null, tierMetric))
      : tierMetric === "items"
        ? (commissionData.current_month_written_items || getMetricValue(personalData?.totals || null, tierMetric))
        : getMetricValue(personalData?.totals || null, tierMetric);

    // Sort tiers by min_threshold
    const sortedTiers = [...commissionData.tiers].sort((a, b) =>
      Number(a.min_threshold) - Number(b.min_threshold)
    );

    // Find current and next tiers
    let currentTier = null;
    let currentTierIndex = -1;
    let nextTier = null;

    for (let i = 0; i < sortedTiers.length; i++) {
      const tier = sortedTiers[i];
      if (currentValue >= Number(tier.min_threshold)) {
        currentTier = tier;
        currentTierIndex = i;
      } else if (!nextTier) {
        nextTier = tier;
      }
    }

    // Calculate progress percent
    let progressPercent = 0;
    if (nextTier) {
      const rangeStart = currentTier ? Number(currentTier.min_threshold) : 0;
      const rangeEnd = Number(nextTier.min_threshold);
      const range = rangeEnd - rangeStart;
      if (range > 0) {
        progressPercent = Math.min(100, ((currentValue - rangeStart) / range) * 100);
      }
    } else if (currentTier) {
      // At max tier
      progressPercent = 100;
    }

    // Calculate bonus if hitting next tier
    const bonusIfHit = nextTier && currentTier
      ? (Number(nextTier.commission_value) - Number(currentTier.commission_value)) * currentValue
      : 0;

    return {
      current_tier: currentTier ? {
        name: currentTier.name || `Tier ${currentTierIndex + 1}`,
        rate: Number(currentTier.commission_value),
        min_threshold: Number(currentTier.min_threshold),
        tier_index: currentTierIndex,
      } : null,
      next_tier: nextTier ? {
        name: nextTier.name || `Tier ${currentTierIndex + 2}`,
        rate: Number(nextTier.commission_value),
        min_threshold: Number(nextTier.min_threshold),
        amount_needed: Number(nextTier.min_threshold) - currentValue,
        bonus_if_hit: bonusIfHit > 0 ? Math.round(bonusIfHit) : 0,
      } : null,
      current_value: currentValue,
      tier_metric: tierMetric,
      progress_percent: progressPercent,
      total_tiers: sortedTiers.length,
      payout_type: payoutType,
    };
  }, [commissionData, personalData?.totals]);

  if (isLoading || displayLoading) {
    return (
      <div className="sales-widget-glass rounded-3xl p-6">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="flex flex-col items-center gap-6">
          <Skeleton className="h-48 w-48 rounded-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sales-widget-glass rounded-3xl p-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-foreground">
            {viewMode === "personal" ? "My Sales" : "Team Sales"}
          </h3>
          {/* Gamification badges - personal view only */}
          {viewMode === "personal" && myRank && (
            <RankBadgeHeader rank={myRank.rank} totalProducers={myRank.total_producers} />
          )}
          {viewMode === "personal" && streak && streak.current > 0 && (
            <StreakBadge streak={streak.current} size="sm" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* View Toggle */}
          <div className="flex rounded-lg bg-muted p-1">
            <button
              onClick={() => setViewMode("personal")}
              className={cn(
                "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                viewMode === "personal" 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              My Numbers
            </button>
            <button
              onClick={() => setViewMode("team")}
              className={cn(
                "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                viewMode === "team" 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Team
            </button>
          </div>
          
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
            {format(today, "MMMM yyyy")}
          </span>
          {showViewAll && viewMode === "personal" && (
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/staff/sales?tab=upload')}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Upload Sale</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowAnalytics(true)}
                className="gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Analytics</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Banner for goal warnings */}
      {goalConfig.banner && viewMode === "personal" && (
        <Alert 
          variant={goalConfig.banner.type === "warning" ? "warning" : "default"} 
          className="mb-4"
        >
          {goalConfig.banner.type === "warning" ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <Info className="h-4 w-4" />
          )}
          <AlertDescription>{goalConfig.banner.message}</AlertDescription>
        </Alert>
      )}

      {/* Main Content: Ring + Orbs - 3 column layout on desktop */}
      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_auto_1fr] items-center justify-items-center gap-6 lg:gap-4">
        {/* Left Orbs - Stack vertically on desktop, align toward center */}
        <div className="flex flex-row flex-wrap lg:flex-col lg:items-end justify-center gap-3 w-full lg:w-auto order-2 lg:order-1">
          <StatOrb
            value={`$${premium.toLocaleString()}`}
            label="Premium"
            icon={DollarSign}
            color="green"
            animationDelay={0}
            projection={formatProjection(premiumProj, '$')}
            trend={trends?.premium !== null && trends?.premium !== undefined
              ? { value: Math.abs(trends.premium), direction: trends.premium >= 0 ? "up" : "down" }
              : undefined}
          />
          <StatOrb
            value={points}
            label="Points"
            icon={Trophy}
            color="orange"
            animationDelay={100}
            projection={pointsProj}
            trend={trends?.points !== null && trends?.points !== undefined
              ? { value: Math.abs(trends.points), direction: trends.points >= 0 ? "up" : "down" }
              : undefined}
          />
          <StatOrb
            value={households}
            label="Households"
            icon={Users}
            color="cyan"
            animationDelay={150}
            projection={householdsProj}
            trend={trends?.households !== null && trends?.households !== undefined
              ? { value: Math.abs(trends.households), direction: trends.households >= 0 ? "up" : "down" }
              : undefined}
          />
        </div>

        {/* Center Ring - Larger and prominent */}
        <div className="flex-shrink-0 order-1 lg:order-2">
          {goalConfig.target > 0 || goalConfig.showCelebration ? (
            <GoalConfetti current={goalConfig.current} target={goalConfig.target || goalConfig.current}>
              <GoalProgressRing
                current={goalConfig.current}
                target={goalConfig.target || goalConfig.current}
                label={goalConfig.label}
                sublabel={goalConfig.sublabel || undefined}
                footer={goalConfig.footer || undefined}
                size="lg"
                showPercentage
                animated
                showCelebration={goalConfig.showCelebration}
                formatValue={goalConfig.formatValue}
              />
            </GoalConfetti>
          ) : (
            <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
              <svg width={200} height={200} className="transform -rotate-90 opacity-30">
                <circle
                  cx={100}
                  cy={100}
                  r={88}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth={12}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-muted-foreground text-xs">No Goal Set</span>
                <span className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                  ${premium.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground mt-1">This Month</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Orbs - Stack vertically on desktop, align toward center */}
        <div className="flex flex-row flex-wrap lg:flex-col lg:items-start justify-center gap-3 w-full lg:w-auto order-3">
          <StatOrb
            value={items}
            label="Items"
            icon={Package}
            color="blue"
            animationDelay={200}
            projection={itemsProj}
            trend={trends?.items !== null && trends?.items !== undefined
              ? { value: Math.abs(trends.items), direction: trends.items >= 0 ? "up" : "down" }
              : undefined}
          />
          <StatOrb
            value={policies}
            label="Policies"
            icon={FileText}
            color="purple"
            animationDelay={300}
            projection={policiesProj}
            trend={trends?.policies !== null && trends?.policies !== undefined
              ? { value: Math.abs(trends.policies), direction: trends.policies >= 0 ? "up" : "down" }
              : undefined}
          />
        </div>
      </div>

      {/* Footer Stats */}
      <div className={cn(
        "mt-8 pt-4 border-t border-border/30",
        "grid grid-cols-2 gap-4 text-center"
      )}>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Biz Day {bizDaysElapsed} of {bizDaysTotal}
          </p>
          <p className="text-lg font-semibold text-foreground mt-1">
            ${Math.round(dailyRate).toLocaleString()}/day
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Projected</p>
          <p className="text-lg font-semibold text-foreground mt-1">
            {formatProjection(premiumProj, '$')}
          </p>
        </div>
      </div>

      {/* Tier Progress Card - only show in personal view when tier data available */}
      {viewMode === "personal" && tierProgress && tierProgress.total_tiers > 0 && (
        <div className="mt-6">
          <TierProgressCard
            tierProgress={tierProgress}
            payoutType={tierProgress.payout_type}
          />
        </div>
      )}

      {/* Mini Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border/30">
          <MiniLeaderboard
            entries={leaderboard}
            currentTeamMemberId={teamMemberId}
            metric="items"
            maxEntries={4}
          />
        </div>
      )}

      {/* Promo Goals Section - only show in personal view */}
      {viewMode === "personal" && (
        <div className="mt-6">
          <StaffPromoGoalsWidget sessionToken={sessionToken} />
        </div>
      )}

      {/* Analytics Slide-Over */}
      <Sheet open={showAnalytics} onOpenChange={setShowAnalytics}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-4xl overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>Sales Analytics</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <SalesBreakdownTabs 
              agencyId={agencyId} 
              showLeaderboard={true}
              staffSessionToken={sessionToken || undefined}
              canEditAllSales={false}
              currentTeamMemberId={teamMemberId}
              leadSources={leadSources}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
