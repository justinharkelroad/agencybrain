import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, DollarSign, Package, FileText, Trophy, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";

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

      return {
        totalPremium,
        totalItems,
        totalPoints,
        totalPolicies,
        salesCount: data?.length || 0,
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

  const stats = salesData || { totalPremium: 0, totalItems: 0, totalPoints: 0, totalPolicies: 0 };
  const hasGoal = !!goalData;
  const monthlyGoal = goalData?.target_value || 0;
  
  // Calculate pacing
  const businessDaysInMonth = getBusinessDaysInMonth(today);
  const businessDaysElapsed = getBusinessDaysElapsed(today);
  const businessDaysRemaining = getBusinessDaysRemaining(today);
  
  const dailyTarget = businessDaysInMonth > 0 ? monthlyGoal / businessDaysInMonth : 0;
  const todaysGoal = dailyTarget * businessDaysElapsed;
  const stillNeed = Math.max(0, todaysGoal - stats.totalPremium);
  const progressPercent = monthlyGoal > 0 ? Math.min(100, (stats.totalPremium / monthlyGoal) * 100) : 0;

  return (
    <Card className="border-border/10 bg-muted/20">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Sales - {monthLabel}
        </CardTitle>
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
          <Link to="/sales" className="flex items-center gap-1">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-background/50 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-primary">
                  <DollarSign className="h-5 w-5" />
                  {stats.totalPremium.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <div className="text-sm text-muted-foreground">Premium</div>
              </div>
              <div className="bg-background/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-foreground">{stats.totalItems}</div>
                <div className="text-sm text-muted-foreground">Items</div>
              </div>
              <div className="bg-background/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-foreground">{stats.totalPolicies}</div>
                <div className="text-sm text-muted-foreground">Policies</div>
              </div>
              <div className="bg-background/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-foreground">{stats.totalPoints}</div>
                <div className="text-sm text-muted-foreground">Points</div>
              </div>
            </div>

            {/* Pacing Section (only if goal exists) */}
            {hasGoal && (
              <div className="bg-background/30 rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="text-muted-foreground">Today's Goal:</span>{" "}
                    <span className="font-medium">${todaysGoal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">Still Need:</span>{" "}
                    <span className={cn("font-medium", stillNeed > 0 ? "text-amber-500" : "text-green-500")}>
                      ${stillNeed.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </span>
                  <span className="font-medium">{progressPercent.toFixed(0)}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <div className="text-xs text-muted-foreground text-center">
                  {businessDaysRemaining} business days remaining in month
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
