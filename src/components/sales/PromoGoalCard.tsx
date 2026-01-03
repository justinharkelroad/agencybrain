import { Trophy, DollarSign, Clock, Target, CheckCircle2, Calendar } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PromoGoalWithProgress } from "@/hooks/usePromoGoals";
import { format, parseISO } from "date-fns";

interface PromoGoalCardProps {
  goal: PromoGoalWithProgress;
  showAssigneeCount?: boolean;
}

export function PromoGoalCard({ goal, showAssigneeCount }: PromoGoalCardProps) {
  const percentComplete = goal.target_value > 0 
    ? Math.min(100, (goal.progress / goal.target_value) * 100) 
    : 0;

  const formatValue = (value: number): string => {
    if (goal.measurement === 'premium') {
      return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return value.toLocaleString();
  };

  const formatBonus = (cents: number): string => {
    return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const getStatusBadge = () => {
    if (goal.status === 'upcoming') {
      return (
        <Badge variant="secondary" className="text-xs">
          <Calendar className="h-3 w-3 mr-1" />
          Starts in {goal.daysRemaining} days
        </Badge>
      );
    }
    if (goal.status === 'ended') {
      return (
        <Badge variant={goal.isAchieved ? "default" : "secondary"} className="text-xs">
          {goal.isAchieved ? (
            <>
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Achieved!
            </>
          ) : (
            "Ended"
          )}
        </Badge>
      );
    }
    if (goal.isAchieved) {
      return (
        <Badge className="text-xs bg-green-500/20 text-green-600 border-green-500/30">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Goal Met!
        </Badge>
      );
    }
    return null;
  };

  const getSourceIcon = () => {
    if (goal.promo_source === 'sales') {
      return <span className="text-xs text-muted-foreground">📊 Sales</span>;
    }
    return <span className="text-xs text-muted-foreground">📋 Metrics</span>;
  };

  return (
    <div className={cn(
      "bg-card border border-border rounded-lg p-4 space-y-3 relative overflow-hidden",
      "border-l-4",
      goal.isAchieved ? "border-l-green-500" : "border-l-primary"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className={cn(
            "h-5 w-5",
            goal.isAchieved ? "text-green-500" : "text-primary"
          )} />
          <h4 className="font-semibold text-foreground">{goal.goal_name}</h4>
        </div>
        {getStatusBadge()}
      </div>

      {/* Description */}
      {goal.description && (
        <p className="text-sm text-muted-foreground">{goal.description}</p>
      )}

      {/* Progress */}
      {goal.status !== 'upcoming' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {formatValue(goal.progress)} / {formatValue(goal.target_value)}
            </span>
          </div>
          <Progress 
            value={percentComplete} 
            className={cn(
              "h-2",
              goal.isAchieved && "[&>div]:bg-green-500"
            )} 
          />
          <div className="text-right text-xs text-muted-foreground">
            {percentComplete.toFixed(0)}% complete
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <div className="flex items-center gap-3">
          {goal.bonus_amount_cents && goal.bonus_amount_cents > 0 && (
            <div className="flex items-center gap-1 text-sm">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="font-semibold text-green-600">
                {formatBonus(goal.bonus_amount_cents)} Bonus
              </span>
            </div>
          )}
          {getSourceIcon()}
        </div>
        
        <div className="flex items-center gap-2">
          {showAssigneeCount && goal.assignments?.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {goal.assignments.length} assigned
            </span>
          )}
          {goal.status === 'active' && goal.daysRemaining > 0 && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{goal.daysRemaining} day{goal.daysRemaining !== 1 ? 's' : ''} left</span>
            </div>
          )}
        </div>
      </div>

      {/* Product filter indicator */}
      {goal.product_type && (
        <div className="text-xs text-muted-foreground">
          Product: {goal.product_type.name}
        </div>
      )}
    </div>
  );
}

// Compact version for staff dashboard
export function PromoGoalCardCompact({ goal }: PromoGoalCardProps) {
  const percentComplete = goal.target_value > 0 
    ? Math.min(100, (goal.progress / goal.target_value) * 100) 
    : 0;

  const formatValue = (value: number): string => {
    if (goal.measurement === 'premium') {
      return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return value.toLocaleString();
  };

  const formatBonus = (cents: number): string => {
    return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  if (goal.status === 'upcoming') {
    return (
      <div className="bg-muted/30 rounded-lg p-3 border-l-4 border-l-muted-foreground">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{goal.goal_name}</span>
          <Badge variant="secondary" className="text-xs ml-auto">
            Starts in {goal.daysRemaining} days
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-muted/30 rounded-lg p-3 border-l-4",
      goal.isAchieved ? "border-l-green-500" : "border-l-primary"
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Target className={cn(
            "h-4 w-4",
            goal.isAchieved ? "text-green-500" : "text-primary"
          )} />
          <span className="font-medium text-sm">{goal.goal_name}</span>
        </div>
        {goal.isAchieved ? (
          <Badge className="text-xs bg-green-500/20 text-green-600 border-green-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Done!
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">
            {goal.daysRemaining} day{goal.daysRemaining !== 1 ? 's' : ''} left
          </span>
        )}
      </div>
      
      <Progress 
        value={percentComplete} 
        className={cn(
          "h-1.5 mb-2",
          goal.isAchieved && "[&>div]:bg-green-500"
        )} 
      />
      
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {formatValue(goal.progress)} / {formatValue(goal.target_value)}
        </span>
        {goal.bonus_amount_cents && goal.bonus_amount_cents > 0 && (
          <span className="text-green-600 font-medium">
            💰 {formatBonus(goal.bonus_amount_cents)}
          </span>
        )}
      </div>
    </div>
  );
}
