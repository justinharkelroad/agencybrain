import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Loader2 } from "lucide-react";
import { PromoGoalCardCompact } from "./PromoGoalCard";
import { 
  useTeamMemberPromoGoals, 
  usePromoGoalProgress,
  PromoGoalWithProgress 
} from "@/hooks/usePromoGoals";

interface StaffPromoGoalsWidgetProps {
  agencyId: string | null;
  teamMemberId: string | null;
}

export function StaffPromoGoalsWidget({ agencyId, teamMemberId }: StaffPromoGoalsWidgetProps) {
  const { data: promoGoals = [], isLoading: goalsLoading } = useTeamMemberPromoGoals(agencyId, teamMemberId);
  
  // Filter to only show active and upcoming goals
  const relevantGoals = promoGoals.filter(g => g.status === 'active' || g.status === 'upcoming');
  
  const { data: goalsWithProgress = [], isLoading: progressLoading } = usePromoGoalProgress(
    relevantGoals,
    teamMemberId,
    agencyId
  );

  const isLoading = goalsLoading || progressLoading;
  
  // Use goals with progress if available, otherwise use base goals
  const displayGoals: PromoGoalWithProgress[] = goalsWithProgress.length > 0 
    ? goalsWithProgress 
    : relevantGoals;

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

  if (displayGoals.length === 0) {
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
        {displayGoals.map(goal => (
          <PromoGoalCardCompact key={goal.id} goal={goal} />
        ))}
      </CardContent>
    </Card>
  );
}
