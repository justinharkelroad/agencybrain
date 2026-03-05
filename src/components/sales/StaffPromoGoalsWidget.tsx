import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Loader2, CheckCircle2, Clock } from "lucide-react";
import { GoalProgressRing } from "./GoalProgressRing";
import { supabase } from "@/integrations/supabase/client";
import { PromoGoalWithProgress } from "@/hooks/usePromoGoals";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SectionHelpTip } from "@/components/ui/section-help-tip";

const PANEL = "panel-highlight rounded-xl border border-border/50 bg-gradient-to-br from-card/80 to-card/40";

interface StaffPromoGoalsWidgetProps {
  sessionToken: string | null;
}

interface PromoGoalEdgeRow {
  id: string;
  goal_name: string;
  description: string | null;
  measurement: string;
  target_value: number;
  bonus_amount_cents: number | null;
  start_date: string;
  end_date: string;
  promo_source: string | null;
  product_type_id: string | null;
  kpi_slug: string | null;
  goal_focus: string | null;
  count_business_days: boolean;
  product_type: string | null;
  progress: number;
  status: string;
  daysRemaining: number;
  isAchieved: boolean;
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
      return ((data?.promos || []) as PromoGoalEdgeRow[]).map((promo) => ({
        id: promo.id,
        agency_id: '',
        is_active: true,
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
        count_business_days: promo.count_business_days,
        product_type: promo.product_type,
        progress: promo.progress,
        assignments: [],
        status: promo.status as 'upcoming' | 'active' | 'ended',
        daysRemaining: promo.daysRemaining,
        isAchieved: promo.isAchieved,
      }));
    },
    enabled: !!sessionToken,
  });

  if (isLoading) {
    return (
      <Card className={PANEL}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            Active Promos
            <SectionHelpTip
              title="Active Promos"
              body="Shows active incentive goals, current progress, and remaining time so staff can prioritize actions tied to bonus outcomes."
            />
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
    <Card className={PANEL}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          Active Promos
          <SectionHelpTip
            title="Active Promos"
            body="Shows active incentive goals, current progress, and remaining time so staff can prioritize actions tied to bonus outcomes."
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {promos.map(goal => (
          <PromoGoalCardWithRing key={goal.id} goal={goal} />
        ))}
      </CardContent>
    </Card>
  );
}

function PromoGoalCardWithRing({ goal }: { goal: PromoGoalWithProgress }) {
  const formatValue = (value: number): string => {
    if (goal.measurement === 'premium') {
      return `$${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  };

  const formatBonus = (cents: number): string => {
    return `$${(cents / 100).toLocaleString()}`;
  };

  if (goal.status === 'upcoming') {
    return (
      <div className="bg-muted/30 rounded-lg p-3 border-l-4 border-l-muted-foreground">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{goal.goal_name}</span>
          <Badge variant="secondary" className="text-xs ml-auto">
            Starts in {goal.daysRemaining} {goal.count_business_days ? 'business ' : ''}days
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "panel-highlight rounded-xl border border-border/50 bg-gradient-to-br from-card/80 to-card/40 p-3 border-l-4",
      goal.isAchieved ? "border-l-green-500" : "border-l-primary"
    )}>
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
        {/* Activity Ring */}
        <div className="flex-shrink-0">
          <GoalProgressRing
            current={goal.progress}
            target={goal.target_value}
            size="xs"
            showPercentage
            animated
            formatValue={formatValue}
          />
        </div>

        {/* Goal Info */}
        <div className="flex-1 min-w-0 space-y-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <span className="font-medium text-sm truncate">{goal.goal_name}</span>
            {goal.isAchieved && (
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            {formatValue(goal.progress)} / {formatValue(goal.target_value)} {goal.measurement}
          </div>

          <div className="flex items-center justify-center sm:justify-start gap-3 text-xs flex-wrap">
            {!goal.isAchieved && goal.daysRemaining > 0 && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                {goal.daysRemaining} {goal.count_business_days ? 'business ' : ''}day{goal.daysRemaining !== 1 ? 's' : ''} left
              </span>
            )}
            {goal.bonus_amount_cents && goal.bonus_amount_cents > 0 && (
              <span className="text-emerald-500 font-medium">
                💰 {formatBonus(goal.bonus_amount_cents)} bonus
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
