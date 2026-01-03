import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, differenceInDays, getDaysInMonth } from "date-fns";
import { DollarSign, Package, FileText, Trophy, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { Link } from "react-router-dom";
import { GoalProgressRing } from "@/components/sales/GoalProgressRing";
import { StatOrb } from "@/components/sales/StatOrb";
import { cn } from "@/lib/utils";

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
}

export function StaffSalesSummary({ agencyId, teamMemberId, showViewAll = false }: StaffSalesSummaryProps) {
  const { sessionToken } = useStaffAuth();
  const today = new Date();
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");
  const daysElapsed = differenceInDays(today, startOfMonth(today)) + 1;
  const totalDays = getDaysInMonth(today);

  const { data, isLoading } = useQuery({
    queryKey: ["staff-sales-summary", agencyId, teamMemberId, monthStart, monthEnd, sessionToken],
    queryFn: async (): Promise<SalesTotals> => {
      if (sessionToken) {
        const { data, error } = await supabase.functions.invoke('get_staff_sales', {
          headers: { 'x-staff-session': sessionToken },
          body: { 
            date_start: monthStart, 
            date_end: monthEnd,
            include_leaderboard: false 
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

        return data.totals || { premium: 0, items: 0, points: 0, policies: 0 };
      }

      const { data: salesData, error } = await supabase
        .from("sales")
        .select(`
          id,
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

      const totals = (salesData || []).reduce(
        (acc, sale) => ({
          premium: acc.premium + (sale.total_premium || 0),
          items: acc.items + (sale.total_items || 0),
          points: acc.points + (sale.total_points || 0),
          policies: acc.policies + ((sale.sale_policies as any[])?.length || 0),
        }),
        { premium: 0, items: 0, points: 0, policies: 0 }
      );

      return totals;
    },
    enabled: !!agencyId && !!teamMemberId,
  });

  // Fetch personal or agency goal from sales_goals table
  const { data: goalData } = useQuery({
    queryKey: ["staff-sales-goal", agencyId, teamMemberId],
    queryFn: async () => {
      // First check for personal goal (assigned to this team member)
      const { data: personalGoal } = await supabase
        .from("sales_goals")
        .select("target_value, goal_name")
        .eq("agency_id", agencyId)
        .eq("team_member_id", teamMemberId)
        .eq("measurement", "premium")
        .eq("is_active", true)
        .maybeSingle();

      if (personalGoal?.target_value) {
        return { goal: personalGoal.target_value, type: "personal", name: personalGoal.goal_name };
      }

      // Fallback to agency goal (no team_member_id)
      const { data: agencyGoal } = await supabase
        .from("sales_goals")
        .select("target_value, goal_name")
        .eq("agency_id", agencyId)
        .is("team_member_id", null)
        .eq("measurement", "premium")
        .eq("is_active", true)
        .maybeSingle();

      return { goal: agencyGoal?.target_value || 0, type: "agency", name: agencyGoal?.goal_name };
    },
    enabled: !!agencyId && !!teamMemberId,
  });

  const premium = data?.premium || 0;
  const goal = goalData?.goal || 0;
  const projectedMonthEnd = daysElapsed > 0 ? Math.round((premium / daysElapsed) * totalDays) : 0;

  if (isLoading) {
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
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">My Sales</h3>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
            {format(today, "MMMM yyyy")}
          </span>
          {showViewAll && (
            <Link 
              to="/staff/sales" 
              className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 group"
            >
              View All 
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
        {/* Left Orbs */}
        <div className="flex flex-row lg:flex-col gap-4">
          <StatOrb
            value={`$${premium.toLocaleString()}`}
            label="Premium"
            icon={DollarSign}
            color="green"
            animationDelay={0}
          />
          <StatOrb
            value={data?.points || 0}
            label="Points"
            icon={Trophy}
            color="orange"
            animationDelay={200}
          />
        </div>

        {/* Center Ring */}
        <div className="flex-shrink-0">
          {goal > 0 ? (
            <GoalProgressRing
              current={premium}
              target={goal}
              label={goalData?.type === "personal" ? "Personal Goal" : "Agency Goal"}
              size="lg"
              showPercentage
              animated
            />
          ) : (
            <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>
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
                <span className="text-muted-foreground text-sm">No Goal Set</span>
                <span className="text-3xl font-bold text-foreground mt-1">
                  ${premium.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground mt-1">This Month</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Orbs */}
        <div className="flex flex-row lg:flex-col gap-4">
          <StatOrb
            value={data?.items || 0}
            label="Items"
            icon={Package}
            color="blue"
            animationDelay={100}
          />
          <StatOrb
            value={data?.policies || 0}
            label="Policies"
            icon={FileText}
            color="purple"
            animationDelay={300}
          />
        </div>
      </div>

      {/* Footer Stats */}
      <div className={cn(
        "mt-8 pt-4 border-t border-border/30",
        "grid grid-cols-2 gap-4 text-center"
      )}>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Day {daysElapsed} of {totalDays}</p>
          <p className="text-lg font-semibold text-foreground mt-1">
            ${Math.round(premium / daysElapsed).toLocaleString()}/day
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Projected</p>
          <p className="text-lg font-semibold text-foreground mt-1">
            ${projectedMonthEnd.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
