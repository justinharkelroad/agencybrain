import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, DollarSign, Package, FileText, Trophy, Loader2, Target, Users, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, startOfDay, subDays } from "date-fns";
import { GoalProgressRing } from "./GoalProgressRing";
import { StatOrb } from "./StatOrb";
import { PacingIndicator } from "./PacingIndicator";
import { AdminPromoGoalsWidget } from "./AdminPromoGoalsWidget";
import { SalesBreakdownTabs } from "./SalesBreakdownTabs";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  getBusinessDaysInMonth, 
  getBusinessDaysElapsed, 
  getBusinessDaysRemaining,
  calculateProjection,
  formatProjection 
} from "@/utils/businessDays";

interface SalesDashboardWidgetProps {
  agencyId: string | null;
}

type MeasurementType = "premium" | "items" | "points" | "policies";

const MEASUREMENT_LABELS: Record<MeasurementType, string> = {
  premium: "Premium",
  items: "Items",
  points: "Points",
  policies: "Policies",
};

export function SalesDashboardWidget({ agencyId }: SalesDashboardWidgetProps) {
  const navigate = useNavigate();
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const { user, isAgencyOwner, isAdmin } = useAuth();
  const today = new Date();
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");
  const monthLabel = format(today, "MMMM yyyy");
  const todayStr = format(startOfDay(today), "yyyy-MM-dd");
  const weekStart = format(subDays(today, 6), "yyyy-MM-dd");

  // Business days calculations
  const bizDaysTotal = getBusinessDaysInMonth(today);
  const bizDaysElapsed = getBusinessDaysElapsed(today);
  const bizDaysRemaining = getBusinessDaysRemaining(today);

  // Fetch team_member_id for staff users
  const { data: staffData } = useQuery({
    queryKey: ["staff-user-team-member", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("staff_users")
        .select("team_member_id")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && !isAgencyOwner && !isAdmin,
  });

  const teamMemberId = staffData?.team_member_id;
  const isStaff = !isAgencyOwner && !isAdmin && !!teamMemberId;

  // Fetch sales data for current month
  const { data: salesData, isLoading } = useQuery({
    queryKey: ["sales-dashboard-widget", agencyId, monthStart, monthEnd, isStaff, teamMemberId],
    queryFn: async () => {
      if (!agencyId) return null;

      let query = supabase
        .from("sales")
        .select(`
          id,
          sale_date,
          customer_name,
          total_premium,
          total_items,
          total_points,
          sale_policies(id)
        `)
        .eq("agency_id", agencyId)
        .gte("sale_date", monthStart)
        .lte("sale_date", monthEnd);

      // Staff only sees their own sales
      if (isStaff && teamMemberId) {
        query = query.eq("team_member_id", teamMemberId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const totalPremium = data?.reduce((sum, s) => sum + (s.total_premium || 0), 0) || 0;
      const totalItems = data?.reduce((sum, s) => sum + (s.total_items || 0), 0) || 0;
      const totalPoints = data?.reduce((sum, s) => sum + (s.total_points || 0), 0) || 0;
      const totalPolicies = data?.reduce((sum, s) => sum + (s.sale_policies?.length || 0), 0) || 0;
      
      // Count unique households (distinct customer names)
      const uniqueCustomers = new Set(data?.map(s => s.customer_name?.toLowerCase().trim()).filter(Boolean));
      const totalHouseholds = uniqueCustomers.size;

      // Calculate today's sales
      const todaySales = data?.filter(s => s.sale_date === todayStr) || [];
      const todayPremium = todaySales.reduce((sum, s) => sum + (s.total_premium || 0), 0);

      // Calculate this week's sales
      const weekSales = data?.filter(s => s.sale_date >= weekStart) || [];
      const weekPremium = weekSales.reduce((sum, s) => sum + (s.total_premium || 0), 0);

      return {
        totalPremium,
        totalItems,
        totalPoints,
        totalPolicies,
        totalHouseholds,
        salesCount: data?.length || 0,
        todayPremium,
        weekPremium,
      };
    },
    enabled: !!agencyId,
  });

  // Fetch ALL monthly goals (not just premium)
  const { data: goalsData } = useQuery({
    queryKey: ["sales-goals-widget-all", agencyId, teamMemberId, isStaff],
    queryFn: async () => {
      if (!agencyId) return [];

      let query = supabase
        .from("sales_goals")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("goal_type", "standard")
        .eq("time_period", "monthly")
        .eq("is_active", true);

      // For staff, look for their personal goal or agency-wide goal
      if (isStaff && teamMemberId) {
        query = query.or(`team_member_id.eq.${teamMemberId},team_member_id.is.null`);
      } else {
        query = query.is("team_member_id", null);
      }

      const { data, error } = await query.order("rank", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!agencyId,
  });

  // Set default selected goal when goals load
  const goals = goalsData || [];
  const activeGoal = selectedGoalId 
    ? goals.find(g => g.id === selectedGoalId) 
    : goals[0];

  if (!agencyId) return null;

  const stats = salesData || { totalPremium: 0, totalItems: 0, totalPoints: 0, totalPolicies: 0, totalHouseholds: 0, todayPremium: 0, weekPremium: 0 };
  const hasGoal = !!activeGoal;
  const monthlyGoal = activeGoal?.target_value || 0;
  const goalMeasurement = (activeGoal?.measurement as MeasurementType) || "premium";
  
  // Get current value based on measurement type
  const getCurrentValue = (measurement: MeasurementType): number => {
    switch (measurement) {
      case "premium": return stats.totalPremium;
      case "items": return stats.totalItems;
      case "points": return stats.totalPoints;
      case "policies": return stats.totalPolicies;
      default: return stats.totalPremium;
    }
  };

  const currentValue = getCurrentValue(goalMeasurement);
  
  // Calculate pacing using business days
  const dailyTarget = bizDaysTotal > 0 ? monthlyGoal / bizDaysTotal : 0;
  const stillNeed = Math.max(0, monthlyGoal - currentValue);
  
  // Calculate projections for all metrics
  const premiumProj = calculateProjection(stats.totalPremium, bizDaysElapsed, bizDaysTotal);
  const itemsProj = calculateProjection(stats.totalItems, bizDaysElapsed, bizDaysTotal);
  const pointsProj = calculateProjection(stats.totalPoints, bizDaysElapsed, bizDaysTotal);
  const policiesProj = calculateProjection(stats.totalPolicies, bizDaysElapsed, bizDaysTotal);
  const householdsProj = calculateProjection(stats.totalHouseholds, bizDaysElapsed, bizDaysTotal);

  // Format value based on measurement type
  const formatGoalValue = (value: number, measurement: MeasurementType): string => {
    if (measurement === "premium") {
      return `$${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  };

  return (
    <div className="sales-widget-glass p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Sales Performance</h2>
            <p className="text-sm text-muted-foreground">{monthLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/sales?tab=upload')}
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
      </div>

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
              canEditAllSales={isAgencyOwner || isAdmin}
              currentTeamMemberId={teamMemberId || undefined}
            />
          </div>
        </SheetContent>
      </Sheet>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Goal Selector - only show if multiple goals exist */}
          {goals.length > 1 && (
            <div className="flex justify-center">
              <Select
                value={selectedGoalId || goals[0]?.id || ""}
                onValueChange={setSelectedGoalId}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select goal" />
                </SelectTrigger>
                <SelectContent>
                  {goals.map((goal) => (
                    <SelectItem key={goal.id} value={goal.id}>
                      {MEASUREMENT_LABELS[goal.measurement as MeasurementType] || goal.measurement} Goal
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Main Content: Ring + Orbs - 3 column layout on desktop */}
          <div className="flex flex-col lg:grid lg:grid-cols-[1fr_auto_1fr] items-center justify-items-center gap-6 lg:gap-4">
            {/* Left Orbs - Stack vertically on desktop, align toward center */}
            <div className="flex flex-row flex-wrap lg:flex-col lg:items-end justify-center gap-3 w-full lg:w-auto order-2 lg:order-1">
              <StatOrb
                value={`$${Math.round(stats.totalPremium / 1000)}k`}
                label="Premium"
                icon={DollarSign}
                color="green"
                animationDelay={0}
                projection={formatProjection(premiumProj, '$')}
              />
              <StatOrb
                value={stats.totalPoints}
                label="Points"
                icon={Trophy}
                color="orange"
                animationDelay={100}
                projection={pointsProj}
              />
              <StatOrb
                value={stats.totalHouseholds}
                label="Households"
                icon={Users}
                color="cyan"
                animationDelay={150}
                projection={householdsProj}
              />
            </div>

            {/* Center Ring - Larger and prominent */}
            <div className="flex-shrink-0 order-1 lg:order-2">
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
                  {/* No goal state */}
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
                      to="/sales?tab=goals" 
                      className="text-sm text-primary hover:underline mt-1"
                    >
                      Set a Goal →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Right Orbs - Stack vertically on desktop, align toward center */}
            <div className="flex flex-row flex-wrap lg:flex-col lg:items-start justify-center gap-3 w-full lg:w-auto order-3">
              <StatOrb
                value={stats.totalItems}
                label="Items"
                icon={Package}
                color="blue"
                animationDelay={200}
                projection={itemsProj}
              />
              <StatOrb
                value={stats.totalPolicies}
                label="Policies"
                icon={FileText}
                color="purple"
                animationDelay={300}
                projection={policiesProj}
              />
            </div>
          </div>

          {/* Pacing Indicator (only if goal exists) */}
          {hasGoal && (
            <PacingIndicator
              dailyTarget={dailyTarget}
              currentDaily={bizDaysElapsed > 0 ? currentValue / bizDaysElapsed : 0}
              amountNeeded={stillNeed}
              daysRemaining={bizDaysRemaining}
              measurement={goalMeasurement}
            />
          )}

          {/* Footer Stats Row */}
          <div className={cn(
            "grid grid-cols-3 gap-4 pt-4",
            "border-t border-white/10 dark:border-white/5"
          )}>
            <div className="text-center">
              <div className="text-lg font-semibold text-foreground">
                ${stats.todayPremium.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">Today</div>
            </div>
            <div className="text-center border-x border-white/10 dark:border-white/5">
              <div className="text-lg font-semibold text-foreground">
                ${stats.weekPremium.toLocaleString()}
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
                Projected (Biz Day {bizDaysElapsed}/{bizDaysTotal})
              </div>
            </div>
          </div>

          {/* Admin Promo Goals Section */}
          {(isAgencyOwner || isAdmin) && (
            <div className="pt-4 border-t border-white/10 dark:border-white/5">
              <AdminPromoGoalsWidget agencyId={agencyId} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
