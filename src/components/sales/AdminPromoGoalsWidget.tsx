import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gift, Loader2, ArrowRight, Users, CheckCircle2, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { GoalProgressRing } from "./GoalProgressRing";
import { cn, parseDateLocal, todayLocal } from "@/lib/utils";

interface AdminPromoGoalsWidgetProps {
  agencyId: string | null;
}

interface StaffProgress {
  teamMemberId: string;
  teamMemberName: string;
  progress: number;
  isAchieved: boolean;
}

interface PromoWithProgress {
  id: string;
  goal_name: string;
  bonus_amount_cents: number | null;
  target_value: number;
  measurement: string;
  product_type_id: string | null;
  promo_source: string;
  kpi_slug: string | null;
  start_date: string;
  end_date: string;
  status: 'active' | 'upcoming' | 'ended';
  daysRemaining: number;
  staffProgress: StaffProgress[];
  isAgencyWide?: boolean;
}

export function AdminPromoGoalsWidget({ agencyId }: AdminPromoGoalsWidgetProps) {
  const { data: promos = [], isLoading } = useQuery({
    queryKey: ["admin-promo-goals-widget", agencyId],
    queryFn: async (): Promise<PromoWithProgress[]> => {
      if (!agencyId) return [];

      // Fetch promo goals for the agency with assignments
      const { data: goals, error: goalsError } = await supabase
        .from("sales_goals")
        .select(`
          id,
          goal_name,
          bonus_amount_cents,
          target_value,
          measurement,
          product_type_id,
          promo_source,
          kpi_slug,
          start_date,
          end_date,
          sales_goal_assignments(
            team_member_id,
            team_member:team_members(name)
          )
        `)
        .eq("agency_id", agencyId)
        .eq("goal_type", "promo")
        .eq("is_active", true);

      if (goalsError) throw goalsError;

      const today = todayLocal();

      // Process each goal and calculate progress per staff member OR agency-wide
      const promosWithProgress: PromoWithProgress[] = [];

      for (const goal of goals || []) {
        const startDate = parseDateLocal(goal.start_date);
        const endDate = parseDateLocal(goal.end_date);

        let status: 'active' | 'upcoming' | 'ended' = 'active';
        if (today < startDate) {
          status = 'upcoming';
        } else if (today > endDate) {
          status = 'ended';
        }

        // Skip ended promos
        if (status === 'ended') continue;

        const daysRemaining =
          status === 'active'
            ? Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) + 1)
            : Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        const isAgencyWide = !goal.sales_goal_assignments || goal.sales_goal_assignments.length === 0;
        
        // Calculate progress for each assigned staff member OR agency-wide
        const staffProgress: StaffProgress[] = [];

        if (isAgencyWide) {
          // Agency-wide promo: calculate aggregate progress
          let progress = 0;
          if (status === 'active') {
            if (goal.promo_source === 'sales') {
              progress = await calculateAgencyWideSalesProgress(
                goal.measurement,
                goal.product_type_id,
                agencyId,
                goal.start_date,
                goal.end_date
              );
            } else if (goal.promo_source === 'metrics') {
              progress = await calculateAgencyWideMetricsProgress(
                goal.kpi_slug,
                agencyId,
                goal.start_date,
                goal.end_date
              );
            }
          }
          staffProgress.push({
            teamMemberId: 'agency-wide',
            teamMemberName: 'Entire Agency',
            progress,
            isAchieved: progress >= goal.target_value,
          });
        } else {
          // Individual assignments
          for (const assignment of goal.sales_goal_assignments || []) {
            const teamMemberId = assignment.team_member_id;
            const teamMemberName = (assignment.team_member as any)?.name || 'Unknown';

            let progress = 0;

            if (status === 'active') {
              // Calculate actual progress
              if (goal.promo_source === 'sales') {
                progress = await calculateSalesProgress(
                  goal.measurement,
                  goal.product_type_id,
                  teamMemberId,
                  agencyId,
                  goal.start_date,
                  goal.end_date
                );
              } else if (goal.promo_source === 'metrics') {
                progress = await calculateMetricsProgress(
                  goal.kpi_slug,
                  teamMemberId,
                  agencyId,
                  goal.start_date,
                  goal.end_date
                );
              }
            }

            staffProgress.push({
              teamMemberId,
              teamMemberName,
              progress,
              isAchieved: progress >= goal.target_value,
            });
          }
        }

        promosWithProgress.push({
          id: goal.id,
          goal_name: goal.goal_name,
          bonus_amount_cents: goal.bonus_amount_cents,
          target_value: goal.target_value,
          measurement: goal.measurement,
          product_type_id: goal.product_type_id,
          promo_source: goal.promo_source,
          kpi_slug: goal.kpi_slug,
          start_date: goal.start_date,
          end_date: goal.end_date,
          status,
          daysRemaining,
          staffProgress,
          isAgencyWide,
        });
      }

      return promosWithProgress;
    },
    enabled: !!agencyId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            Active Promos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (promos.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Gift className="h-4 w-4 text-primary" />
          Active Promos
        </CardTitle>
        <Link 
          to="/sales?tab=goals" 
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          Manage 
          <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {promos.map((promo) => (
          <PromoCard key={promo.id} promo={promo} />
        ))}
      </CardContent>
    </Card>
  );
}

function PromoCard({ promo }: { promo: PromoWithProgress }) {
  const achievedCount = promo.staffProgress.filter(s => s.isAchieved).length;
  const totalAssigned = promo.staffProgress.length;

  const formatValue = (value: number): string => {
    if (promo.measurement === 'premium') {
      return `$${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{promo.goal_name}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {promo.isAgencyWide ? "Entire Agency" : `${totalAssigned} assigned`}
            </span>
            {promo.status === 'active' && (
              <span className="flex items-center gap-1 text-amber-500">
                <Clock className="h-3 w-3" />
                {promo.daysRemaining} days left
              </span>
            )}
            {promo.status === 'upcoming' && (
              <span className="text-blue-500">
                Starts in {promo.daysRemaining} days
              </span>
            )}
          </div>
        </div>
        {promo.bonus_amount_cents && promo.bonus_amount_cents > 0 && (
          <div className="text-sm font-semibold text-emerald-500 whitespace-nowrap">
            ${(promo.bonus_amount_cents / 100).toLocaleString()}
          </div>
        )}
      </div>

      {/* Staff Progress */}
      {promo.status === 'active' && promo.staffProgress.length > 0 && (
        <div className="space-y-2">
          {promo.staffProgress.map((staff) => {
            const percent = promo.target_value > 0 
              ? Math.min(100, (staff.progress / promo.target_value) * 100) 
              : 0;

            return (
              <div 
                key={staff.teamMemberId}
                className="flex items-center gap-3 p-2 rounded-md bg-background/50"
              >
                <GoalProgressRing
                  current={staff.progress}
                  target={promo.target_value}
                  size="sm"
                  showPercentage={false}
                  animated
                  formatValue={formatValue}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {staff.teamMemberName}
                    </span>
                    {staff.isAchieved && (
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatValue(staff.progress)} / {formatValue(promo.target_value)}
                  </div>
                </div>
                <div className={cn(
                  "text-sm font-medium",
                  staff.isAchieved ? "text-green-500" : "text-muted-foreground"
                )}>
                  {percent.toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary - only show for individual assignments, not agency-wide */}
      {promo.status === 'active' && totalAssigned > 0 && !promo.isAgencyWide && (
        <div className="text-xs text-muted-foreground pt-1 border-t border-border/50">
          {achievedCount} of {totalAssigned} achieved
        </div>
      )}
    </div>
  );
}

// Helper functions to calculate progress
async function calculateSalesProgress(
  measurement: string,
  productTypeId: string | null,
  teamMemberId: string,
  agencyId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  if (measurement === 'premium') {
    const { data, error } = await supabase
      .from("sales")
      .select("total_premium")
      .eq("team_member_id", teamMemberId)
      .eq("agency_id", agencyId)
      .gte("sale_date", startDate)
      .lte("sale_date", endDate);

    if (error) throw error;
    return data?.reduce((sum, s) => sum + (s.total_premium || 0), 0) || 0;
  }

  if (measurement === 'items') {
    const { data, error } = await supabase
      .from("sales")
      .select("total_items")
      .eq("team_member_id", teamMemberId)
      .eq("agency_id", agencyId)
      .gte("sale_date", startDate)
      .lte("sale_date", endDate);

    if (error) throw error;
    return data?.reduce((sum, s) => sum + (s.total_items || 0), 0) || 0;
  }

  if (measurement === 'points') {
    const { data, error } = await supabase
      .from("sales")
      .select("total_points")
      .eq("team_member_id", teamMemberId)
      .eq("agency_id", agencyId)
      .gte("sale_date", startDate)
      .lte("sale_date", endDate);

    if (error) throw error;
    return data?.reduce((sum, s) => sum + (s.total_points || 0), 0) || 0;
  }

  if (measurement === 'policies') {
    let query = supabase
      .from("sale_policies")
      .select("id, sale:sales!inner(team_member_id, agency_id, sale_date)")
      .eq("sale.team_member_id", teamMemberId)
      .eq("sale.agency_id", agencyId)
      .gte("sale.sale_date", startDate)
      .lte("sale.sale_date", endDate);

    // Apply product type filter if specified
    if (productTypeId) {
      query = query.eq("product_type_id", productTypeId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data?.length || 0;
  }

  if (measurement === 'households') {
    const { data, error } = await supabase
      .from("sales")
      .select("customer_name")
      .eq("team_member_id", teamMemberId)
      .eq("agency_id", agencyId)
      .gte("sale_date", startDate)
      .lte("sale_date", endDate);

    if (error) throw error;
    const uniqueHouseholds = new Set(data?.map(s => s.customer_name) || []);
    return uniqueHouseholds.size;
  }

  return 0;
}

async function calculateMetricsProgress(
  kpiSlug: string | null,
  teamMemberId: string,
  agencyId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  if (!kpiSlug) return 0;

  const columnMap: Record<string, string> = {
    'outbound_calls': 'outbound_calls',
    'talk_minutes': 'talk_minutes',
    'quoted_count': 'quoted_count',
    'quoted_households': 'quoted_count',
    'sold_items': 'sold_items',
    'items_sold': 'sold_items',
    'sold_policies': 'sold_policies',
    'cross_sells_uncovered': 'cross_sells_uncovered',
    'mini_reviews': 'mini_reviews',
  };

  const column = columnMap[kpiSlug];
  if (!column) return 0;

  const { data, error } = await supabase
    .from("metrics_daily")
    .select(column)
    .eq("team_member_id", teamMemberId)
    .eq("agency_id", agencyId)
    .gte("date", startDate)
    .lte("date", endDate);

  if (error) throw error;

  return data?.reduce((sum, row) => sum + ((row as any)[column] || 0), 0) || 0;
}

// Agency-wide calculation functions (no team_member filter)
async function calculateAgencyWideSalesProgress(
  measurement: string,
  productTypeId: string | null,
  agencyId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  if (measurement === 'premium') {
    const { data, error } = await supabase
      .from("sales")
      .select("total_premium")
      .eq("agency_id", agencyId)
      .gte("sale_date", startDate)
      .lte("sale_date", endDate);

    if (error) throw error;
    return data?.reduce((sum, s) => sum + (s.total_premium || 0), 0) || 0;
  }

  if (measurement === 'items') {
    const { data, error } = await supabase
      .from("sales")
      .select("total_items")
      .eq("agency_id", agencyId)
      .gte("sale_date", startDate)
      .lte("sale_date", endDate);

    if (error) throw error;
    return data?.reduce((sum, s) => sum + (s.total_items || 0), 0) || 0;
  }

  if (measurement === 'points') {
    const { data, error } = await supabase
      .from("sales")
      .select("total_points")
      .eq("agency_id", agencyId)
      .gte("sale_date", startDate)
      .lte("sale_date", endDate);

    if (error) throw error;
    return data?.reduce((sum, s) => sum + (s.total_points || 0), 0) || 0;
  }

  if (measurement === 'policies') {
    let query = supabase
      .from("sale_policies")
      .select("id, sale:sales!inner(agency_id, sale_date)")
      .eq("sale.agency_id", agencyId)
      .gte("sale.sale_date", startDate)
      .lte("sale.sale_date", endDate);

    if (productTypeId) {
      query = query.eq("product_type_id", productTypeId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data?.length || 0;
  }

  if (measurement === 'households') {
    const { data, error } = await supabase
      .from("sales")
      .select("customer_name")
      .eq("agency_id", agencyId)
      .gte("sale_date", startDate)
      .lte("sale_date", endDate);

    if (error) throw error;
    const uniqueHouseholds = new Set(data?.map(s => s.customer_name) || []);
    return uniqueHouseholds.size;
  }

  return 0;
}

async function calculateAgencyWideMetricsProgress(
  kpiSlug: string | null,
  agencyId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  if (!kpiSlug) return 0;

  const columnMap: Record<string, string> = {
    'outbound_calls': 'outbound_calls',
    'talk_minutes': 'talk_minutes',
    'quoted_count': 'quoted_count',
    'quoted_households': 'quoted_count',
    'sold_items': 'sold_items',
    'items_sold': 'sold_items',
    'sold_policies': 'sold_policies',
    'cross_sells_uncovered': 'cross_sells_uncovered',
    'mini_reviews': 'mini_reviews',
  };

  const column = columnMap[kpiSlug];
  if (!column) return 0;

  const { data, error } = await supabase
    .from("metrics_daily")
    .select(column)
    .eq("agency_id", agencyId)
    .gte("date", startDate)
    .lte("date", endDate);

  if (error) throw error;

  return data?.reduce((sum, row) => sum + ((row as any)[column] || 0), 0) || 0;
}
