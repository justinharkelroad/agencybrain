import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Loader2, ArrowRight, Users, Gift } from "lucide-react";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";

interface AdminPromoGoalsWidgetProps {
  agencyId: string | null;
}

interface PromoSummary {
  id: string;
  goal_name: string;
  bonus_amount_cents: number | null;
  target_value: number;
  start_date: string;
  end_date: string;
  assignedCount: number;
  achievedCount: number;
  status: 'active' | 'upcoming' | 'ended';
  daysRemaining: number;
}

export function AdminPromoGoalsWidget({ agencyId }: AdminPromoGoalsWidgetProps) {
  const { data: promos = [], isLoading } = useQuery({
    queryKey: ["admin-promo-goals-widget", agencyId],
    queryFn: async (): Promise<PromoSummary[]> => {
      if (!agencyId) return [];

      // Fetch promo goals for the agency
      const { data: goals, error: goalsError } = await supabase
        .from("sales_goals")
        .select(`
          id,
          goal_name,
          bonus_amount_cents,
          target_value,
          start_date,
          end_date,
          sales_goal_assignments(team_member_id)
        `)
        .eq("agency_id", agencyId)
        .eq("goal_type", "promo")
        .eq("is_active", true);

      if (goalsError) throw goalsError;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return (goals || []).map((goal) => {
        const startDate = new Date(goal.start_date);
        const endDate = new Date(goal.end_date);

        let status: 'active' | 'upcoming' | 'ended' = 'active';
        if (today < startDate) {
          status = 'upcoming';
        } else if (today > endDate) {
          status = 'ended';
        }

        const daysRemaining =
          status === 'active'
            ? Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) + 1)
            : status === 'upcoming'
            ? Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            : 0;

        return {
          id: goal.id,
          goal_name: goal.goal_name,
          bonus_amount_cents: goal.bonus_amount_cents,
          target_value: goal.target_value,
          start_date: goal.start_date,
          end_date: goal.end_date,
          assignedCount: goal.sales_goal_assignments?.length || 0,
          achievedCount: 0, // Would need progress calculation per member
          status,
          daysRemaining,
        };
      }).filter(p => p.status === 'active' || p.status === 'upcoming');
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
    return null; // Don't show widget if no active promos
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
      <CardContent className="space-y-3">
        {promos.map((promo) => (
          <div 
            key={promo.id}
            className="p-3 rounded-lg bg-muted/50 border border-border/50"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{promo.goal_name}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {promo.assignedCount} assigned
                  </span>
                  {promo.status === 'active' && (
                    <span className="text-amber-500">
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
              {promo.bonus_amount_cents && (
                <div className="text-sm font-semibold text-emerald-500 whitespace-nowrap">
                  ${(promo.bonus_amount_cents / 100).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
