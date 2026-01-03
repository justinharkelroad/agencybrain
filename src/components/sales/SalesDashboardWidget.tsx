import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Link } from "react-router-dom";
import { ArrowRight, DollarSign, Package, FileText, Trophy, Loader2, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, startOfDay, subDays } from "date-fns";
import { GoalProgressRing } from "./GoalProgressRing";
import { StatOrb } from "./StatOrb";
import { PacingIndicator } from "./PacingIndicator";

interface SalesDashboardWidgetProps {
  agencyId: string | null;
}

// Calculate business days in a month
function getBusinessDaysInMonth(date: Date): number {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  const days = eachDayOfInterval({ start, end });
  return days.filter(d => !isWeekend(d)).length;
}

// Calculate business days elapsed
function getBusinessDaysElapsed(date: Date): number {
  const start = startOfMonth(date);
  const today = new Date();
  const end = today > date ? endOfMonth(date) : today;
  if (end < start) return 0;
  const days = eachDayOfInterval({ start, end });
  return days.filter(d => !isWeekend(d)).length;
}

// Calculate remaining business days
function getBusinessDaysRemaining(date: Date): number {
  const today = new Date();
  const end = endOfMonth(date);
  if (today > end) return 0;
  const days = eachDayOfInterval({ start: today, end });
  return days.filter(d => !isWeekend(d)).length;
}

export function SalesDashboardWidget({ agencyId }: SalesDashboardWidgetProps) {
  const { user, isAgencyOwner, isAdmin } = useAuth();
  const today = new Date();
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");
  const monthLabel = format(today, "MMMM yyyy");
  const todayStr = format(startOfDay(today), "yyyy-MM-dd");
  const weekStart = format(subDays(today, 6), "yyyy-MM-dd");

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
        salesCount: data?.length || 0,
        todayPremium,
        weekPremium,
      };
    },
    enabled: !!agencyId,
  });

  // Fetch monthly goal (for premium)
  const { data: goalData } = useQuery({
    queryKey: ["sales-goal-widget", agencyId, teamMemberId, isStaff],
    queryFn: async () => {
      if (!agencyId) return null;

      let query = supabase
        .from("sales_goals")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("measurement", "premium")
        .eq("time_period", "monthly")
        .eq("is_active", true);

      // For staff, look for their personal goal or agency-wide goal
      if (isStaff && teamMemberId) {
        query = query.or(`team_member_id.eq.${teamMemberId},team_member_id.is.null`);
      } else {
        query = query.is("team_member_id", null);
      }

      const { data, error } = await query.order("team_member_id", { ascending: false, nullsFirst: false }).limit(1);
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!agencyId,
  });

  if (!agencyId) return null;

  const stats = salesData || { totalPremium: 0, totalItems: 0, totalPoints: 0, totalPolicies: 0, todayPremium: 0, weekPremium: 0 };
  const hasGoal = !!goalData;
  const monthlyGoal = goalData?.target_value || 0;
  
  // Calculate pacing
  const businessDaysInMonth = getBusinessDaysInMonth(today);
  const businessDaysElapsed = getBusinessDaysElapsed(today);
  const businessDaysRemaining = getBusinessDaysRemaining(today);
  
  const dailyTarget = businessDaysInMonth > 0 ? monthlyGoal / businessDaysInMonth : 0;
  const expectedToDate = dailyTarget * businessDaysElapsed;
  const stillNeed = Math.max(0, monthlyGoal - stats.totalPremium);
  
  // Projected month-end (based on current pace)
  const projectedMonthEnd = businessDaysElapsed > 0 
    ? (stats.totalPremium / businessDaysElapsed) * businessDaysInMonth 
    : 0;

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
        <Link 
          to="/sales" 
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          View All 
          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Main Content: Ring + Orbs */}
          <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
            {/* Left Orbs */}
            <div className="flex flex-row lg:flex-col gap-4">
              <StatOrb
                value={`$${Math.round(stats.totalPremium / 1000)}k`}
                label="Premium"
                icon={DollarSign}
                color="green"
                animationDelay={0}
              />
              <StatOrb
                value={stats.totalPoints}
                label="Points"
                icon={Trophy}
                color="orange"
                animationDelay={100}
              />
            </div>

            {/* Center Ring */}
            <div className="flex-shrink-0">
              {hasGoal ? (
                <GoalProgressRing
                  current={stats.totalPremium}
                  target={monthlyGoal}
                  size="lg"
                  animated={true}
                />
              ) : (
                <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>
                  {/* No goal state */}
                  <svg width={240} height={240} className="transform -rotate-90 opacity-30">
                    <circle
                      cx={120}
                      cy={120}
                      r={108}
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

            {/* Right Orbs */}
            <div className="flex flex-row lg:flex-col gap-4">
              <StatOrb
                value={stats.totalItems}
                label="Items"
                icon={Package}
                color="blue"
                animationDelay={200}
              />
              <StatOrb
                value={stats.totalPolicies}
                label="Policies"
                icon={FileText}
                color="purple"
                animationDelay={300}
              />
            </div>
          </div>

          {/* Pacing Indicator (only if goal exists) */}
          {hasGoal && (
            <PacingIndicator
              dailyTarget={dailyTarget}
              currentDaily={businessDaysElapsed > 0 ? stats.totalPremium / businessDaysElapsed : 0}
              amountNeeded={stillNeed}
              daysRemaining={businessDaysRemaining}
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
                projectedMonthEnd >= monthlyGoal ? "text-emerald-500" : "text-foreground"
              )}>
                ${Math.round(projectedMonthEnd).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">Projected</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
