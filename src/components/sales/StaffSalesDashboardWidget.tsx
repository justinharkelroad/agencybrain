import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart3, DollarSign, Package, FileText, Trophy,
  Loader2, Target, Users, Upload
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, startOfDay, subDays } from "date-fns";
import { GoalProgressRing } from "./GoalProgressRing";
import { StatOrb } from "./StatOrb";
import { PacingIndicator } from "./PacingIndicator";
import { TierProgressCard } from "./TierProgressCard";
import { RankBadgeHeader } from "./RankBadge";
import { StreakBadge } from "./StreakBadge";
import { MiniLeaderboard } from "./MiniLeaderboard";
import { HeroStat } from "./HeroStat";
import { ViewToggle, ViewMode } from "./ViewToggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SalesBreakdownTabs } from "./SalesBreakdownTabs";
import {
  getBusinessDaysInMonth,
  getBusinessDaysElapsed,
  getBusinessDaysRemaining,
  calculateProjection,
  formatProjection
} from "@/utils/businessDays";

interface StaffSalesDashboardWidgetProps {
  staffSessionToken: string;
  agencyId: string;
}

type MeasurementType = "premium" | "items" | "points" | "policies";

const MEASUREMENT_LABELS: Record<MeasurementType, string> = {
  premium: "Premium",
  items: "Items",
  points: "Points",
  policies: "Policies",
};

export function StaffSalesDashboardWidget({
  staffSessionToken,
  agencyId
}: StaffSalesDashboardWidgetProps) {
  const navigate = useNavigate();
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("personal");

  const today = new Date();
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");
  const monthLabel = format(today, "MMMM yyyy");
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const todayStr = format(startOfDay(today), "yyyy-MM-dd");
  const weekStart = format(subDays(today, 6), "yyyy-MM-dd");

  // Business days calculations
  const bizDaysTotal = getBusinessDaysInMonth(today);
  const bizDaysElapsed = getBusinessDaysElapsed(today);
  const bizDaysRemaining = getBusinessDaysRemaining(today);

  // Fetch sales data from edge function
  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ["staff-sales-dashboard", staffSessionToken, monthStart, monthEnd, viewMode],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get_staff_sales", {
        headers: { "x-staff-session": staffSessionToken },
        body: {
          date_start: monthStart,
          date_end: monthEnd,
          include_leaderboard: true,
          scope: viewMode === "personal" ? "personal" : "team",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
  });

  // Fetch commission/tier data
  const { data: commissionData, isLoading: commissionLoading } = useQuery({
    queryKey: ["staff-commission-dashboard", staffSessionToken, currentMonth, currentYear],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-staff-commission", {
        headers: { "x-staff-session": staffSessionToken },
        body: { month: currentMonth, year: currentYear },
      });

      if (error) throw error;
      return data;
    },
  });

  // Fetch personal goal
  const { data: goalData } = useQuery({
    queryKey: ["staff-goal-dashboard", staffSessionToken, salesData?.team_member_id],
    queryFn: async () => {
      if (!salesData?.team_member_id) return null;

      const { data, error } = await supabase.functions.invoke("get_staff_goal", {
        headers: { "x-staff-session": staffSessionToken },
        body: { team_member_id: salesData.team_member_id },
      });

      if (error) throw error;
      return data;
    },
    enabled: !!salesData?.team_member_id,
  });

  // Calculate today's and this week's sales
  const todayWeekStats = useMemo(() => {
    if (!salesData?.personal_sales) return { todayPremium: 0, weekPremium: 0 };

    const todaySales = salesData.personal_sales.filter(
      (s: any) => s.sale_date === todayStr
    );
    const weekSales = salesData.personal_sales.filter(
      (s: any) => s.sale_date >= weekStart
    );

    return {
      todayPremium: todaySales.reduce(
        (sum: number, s: any) => sum + (s.total_premium || 0),
        0
      ),
      weekPremium: weekSales.reduce(
        (sum: number, s: any) => sum + (s.total_premium || 0),
        0
      ),
    };
  }, [salesData?.personal_sales, todayStr, weekStart]);

  // Sort leaderboard by items
  const sortedLeaderboard = useMemo(() => {
    if (!salesData?.leaderboard) return [];
    return [...salesData.leaderboard].sort((a: any, b: any) => b.items - a.items);
  }, [salesData?.leaderboard]);

  const isLoading = salesLoading || commissionLoading;

  if (isLoading) {
    return (
      <div className="sales-widget-glass p-6">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const totals = salesData?.totals || { premium: 0, items: 0, points: 0, policies: 0, households: 0 };
  const trends = salesData?.trends || { premium: null, items: null, points: null, policies: null, households: null };
  const streak = salesData?.streak || { current: 0, longest: 0, last_sale_date: null };
  const myRank = salesData?.my_rank;
  const tierProgress = commissionData?.tier_progress;
  const teamMemberId = salesData?.team_member_id;

  const hasGoal = goalData?.goal && goalData.goal > 0;
  const monthlyGoal = goalData?.goal || 0;
  const goalMeasurement = (goalData?.measurement as MeasurementType) || "premium";

  const getCurrentValue = (measurement: MeasurementType): number => {
    switch (measurement) {
      case "premium": return totals.premium;
      case "items": return totals.items;
      case "points": return totals.points;
      case "policies": return totals.policies;
      default: return totals.premium;
    }
  };

  const currentValue = getCurrentValue(goalMeasurement);
  const dailyTarget = bizDaysTotal > 0 ? monthlyGoal / bizDaysTotal : 0;
  const stillNeed = Math.max(0, monthlyGoal - currentValue);

  // Projections
  const premiumProj = calculateProjection(totals.premium, bizDaysElapsed, bizDaysTotal);
  const itemsProj = calculateProjection(totals.items, bizDaysElapsed, bizDaysTotal);
  const pointsProj = calculateProjection(totals.points, bizDaysElapsed, bizDaysTotal);
  const policiesProj = calculateProjection(totals.policies, bizDaysElapsed, bizDaysTotal);
  const householdsProj = calculateProjection(totals.households, bizDaysElapsed, bizDaysTotal);

  const formatGoalValue = (value: number, measurement: MeasurementType): string => {
    if (measurement === "premium") {
      return `$${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  };

  const isPersonalView = viewMode === "personal";

  return (
    <div className="sales-widget-glass p-6 space-y-5">
      {/* Header with Rank & Streak */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {isPersonalView ? "Your Sales Performance" : "Agency Sales Performance"}
            </h2>
            <p className="text-sm text-muted-foreground">{monthLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {isPersonalView && myRank && (
            <RankBadgeHeader rank={myRank.rank} totalProducers={myRank.total_producers} />
          )}
          {isPersonalView && streak.current > 0 && (
            <StreakBadge streak={streak.current} size="sm" />
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <ViewToggle value={viewMode} onChange={setViewMode} />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/staff/sales?tab=upload')}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Upload</span>
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
      </div>

      {/* Analytics Sheet */}
      <Sheet open={showAnalytics} onOpenChange={setShowAnalytics}>
        <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Sales Analytics</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <SalesBreakdownTabs
              agencyId={agencyId}
              showLeaderboard={true}
              canEditAllSales={false}
              currentTeamMemberId={teamMemberId}
              staffSessionToken={staffSessionToken}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Tier Progress (Personal view only) */}
      {isPersonalView && tierProgress && (
        <TierProgressCard
          tierProgress={tierProgress}
          payoutType={commissionData?.plan?.payout_type}
        />
      )}

      {/* Hero Stat - Points with trend */}
      <HeroStat
        value={totals.points}
        label="Points"
        trend={trends.points}
        size="lg"
      />

      {/* Goal Ring */}
      <div className="flex justify-center">
        {hasGoal ? (
          <GoalProgressRing
            current={currentValue}
            target={monthlyGoal}
            size="lg"
            animated={true}
            label={MEASUREMENT_LABELS[goalMeasurement]}
            formatValue={(v) => formatGoalValue(v, goalMeasurement)}
          />
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
              <Target className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-lg font-semibold text-foreground">No Goal Set</span>
              <Link
                to="/staff/sales?tab=goals"
                className="text-sm text-primary hover:underline mt-1"
              >
                Set a Goal →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Stat Orbs with Trends */}
      <div className="flex flex-wrap justify-center gap-3">
        <StatOrb
          value={totals.items}
          label="Items"
          icon={Package}
          color="blue"
          animationDelay={0}
          projection={itemsProj}
          trend={trends.items !== null ? { value: Math.abs(trends.items), direction: trends.items >= 0 ? "up" : "down" } : undefined}
        />
        <StatOrb
          value={`$${Math.round(totals.premium / 1000)}k`}
          label="Premium"
          icon={DollarSign}
          color="green"
          animationDelay={100}
          projection={formatProjection(premiumProj, '$')}
          trend={trends.premium !== null ? { value: Math.abs(trends.premium), direction: trends.premium >= 0 ? "up" : "down" } : undefined}
        />
        <StatOrb
          value={totals.policies}
          label="Policies"
          icon={FileText}
          color="purple"
          animationDelay={200}
          projection={policiesProj}
          trend={trends.policies !== null ? { value: Math.abs(trends.policies), direction: trends.policies >= 0 ? "up" : "down" } : undefined}
        />
        <StatOrb
          value={totals.households}
          label="Households"
          icon={Users}
          color="cyan"
          animationDelay={300}
          projection={householdsProj}
          trend={trends.households !== null ? { value: Math.abs(trends.households), direction: trends.households >= 0 ? "up" : "down" } : undefined}
        />
      </div>

      {/* Pacing Indicator */}
      {hasGoal && (
        <PacingIndicator
          dailyTarget={dailyTarget}
          currentDaily={bizDaysElapsed > 0 ? currentValue / bizDaysElapsed : 0}
          amountNeeded={stillNeed}
          daysRemaining={bizDaysRemaining}
          measurement={goalMeasurement}
        />
      )}

      {/* Mini Leaderboard */}
      {sortedLeaderboard.length > 0 && (
        <div className="pt-3 border-t border-white/10">
          <MiniLeaderboard
            entries={sortedLeaderboard}
            currentTeamMemberId={teamMemberId}
            metric="items"
            maxEntries={4}
          />
        </div>
      )}

      {/* Footer Stats */}
      <div className={cn(
        "grid grid-cols-3 gap-4 pt-4",
        "border-t border-white/10 dark:border-white/5"
      )}>
        <div className="text-center">
          <div className="text-lg font-semibold text-foreground">
            ${todayWeekStats.todayPremium.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">Today</div>
        </div>
        <div className="text-center border-x border-white/10 dark:border-white/5">
          <div className="text-lg font-semibold text-foreground">
            ${todayWeekStats.weekPremium.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">This Week</div>
        </div>
        <div className="text-center">
          <div className={cn(
            "text-lg font-semibold",
            premiumProj !== null && premiumProj >= monthlyGoal ? "text-emerald-500" : "text-foreground"
          )}>
            {formatProjection(premiumProj, '$')}
          </div>
          <div className="text-xs text-muted-foreground">
            Projected (Day {bizDaysElapsed}/{bizDaysTotal})
          </div>
        </div>
      </div>
    </div>
  );
}
