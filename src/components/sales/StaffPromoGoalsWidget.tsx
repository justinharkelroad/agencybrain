import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Loader2 } from "lucide-react";
import { PromoGoalCardCompact } from "./PromoGoalCard";
import { supabase } from "@/integrations/supabase/client";
import { PromoGoalWithProgress } from "@/hooks/usePromoGoals";

interface StaffPromoGoalsWidgetProps {
  sessionToken: string | null;
}

export function StaffPromoGoalsWidget({ sessionToken }: StaffPromoGoalsWidgetProps) {
  const { data: promos = [], isLoading } = useQuery({
    queryKey: ["staff-promo-goals", sessionToken],
    queryFn: async (): Promise<PromoGoalWithProgress[]> => {
      if (!sessionToken) return [];

      const { data, error } = await supabase.functions.invoke('get_staff_promo_goals', {
        headers: { 'x-staff-session': sessionToken },
      });

      if (error) {
        console.error('[StaffPromoGoalsWidget] Edge function error:', error);
        throw error;
      }

      if (data?.error) {
        console.error('[StaffPromoGoalsWidget] Response error:', data.error);
        throw new Error(data.error);
      }

      // Transform response to match PromoGoalWithProgress interface
      return (data?.promos || []).map((promo: any) => ({
        id: promo.id,
        goal_name: promo.goal_name,
        description: promo.description,
        measurement: promo.measurement,
        target_value: promo.target_value,
        bonus_amount_cents: promo.bonus_amount_cents,
        start_date: promo.start_date,
        end_date: promo.end_date,
        promo_source: promo.promo_source,
        product_type_id: promo.product_type_id,
        kpi_slug: promo.kpi_slug,
        goal_focus: promo.goal_focus,
        product_type: promo.product_type,
        progress: promo.progress,
        status: promo.status,
        daysRemaining: promo.daysRemaining,
        isAchieved: promo.isAchieved,
      }));
    },
    enabled: !!sessionToken,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
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
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          Active Promos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {promos.map(goal => (
          <PromoGoalCardCompact key={goal.id} goal={goal} />
        ))}
      </CardContent>
    </Card>
  );
}
