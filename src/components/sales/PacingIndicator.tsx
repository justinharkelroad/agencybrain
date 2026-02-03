import { cn } from "@/lib/utils";
import { Target, CheckCircle2, AlertTriangle, TrendingUp, Flame } from "lucide-react";

interface PacingIndicatorProps {
  dailyTarget: number;
  currentDaily: number;
  amountNeeded: number;
  daysRemaining: number;
  streak?: number;
  measurement?: "premium" | "items" | "points" | "policies";
}

type PaceStatus = "ahead" | "on-track" | "behind";

function getPaceStatus(current: number, target: number): PaceStatus {
  const ratio = target > 0 ? current / target : 1;
  if (ratio >= 1.1) return "ahead";
  if (ratio >= 0.9) return "on-track";
  return "behind";
}

const statusConfig = {
  ahead: {
    icon: TrendingUp,
    label: "Ahead of Pace",
    bgClass: "bg-emerald-500/20",
    textClass: "text-emerald-600 dark:text-emerald-400",
    borderClass: "border-emerald-500/30",
  },
  "on-track": {
    icon: CheckCircle2,
    label: "On Track",
    bgClass: "bg-emerald-500/20",
    textClass: "text-emerald-600 dark:text-emerald-400",
    borderClass: "border-emerald-500/30",
  },
  behind: {
    icon: AlertTriangle,
    label: "Behind Pace",
    bgClass: "bg-amber-500/20",
    textClass: "text-amber-600 dark:text-amber-400",
    borderClass: "border-amber-500/30",
  },
};

export function PacingIndicator({
  dailyTarget,
  currentDaily,
  amountNeeded,
  daysRemaining,
  streak = 0,
  measurement = "premium",
}: PacingIndicatorProps) {
  const status = getPaceStatus(currentDaily, dailyTarget);
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  // Calculate needed per day
  const neededPerDay = Math.round(amountNeeded / Math.max(daysRemaining, 1));
  
  // Format value based on measurement type
  const formatValue = (value: number): string => {
    if (measurement === "premium") {
      return `$${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  };

  return (
    <div className="w-full">
      {/* Main pacing bar */}
      <div className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-4 py-3",
        "rounded-xl",
        "bg-black/5 dark:bg-white/5 backdrop-blur-sm",
        "border border-black/10 dark:border-white/10"
      )}>
        {/* Daily Pace Needed */}
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            <span className="text-muted-foreground">Daily Pace:</span>{" "}
            <span className="font-semibold text-foreground">
              {formatValue(neededPerDay)}
            </span>
            <span className="text-muted-foreground text-xs ml-1">needed/day</span>
          </span>
        </div>

        {/* Status Badge */}
        <div className={cn(
          "flex items-center gap-1.5 px-3 py-1 rounded-full",
          config.bgClass,
          config.borderClass,
          "border"
        )}>
          <StatusIcon className={cn("h-3.5 w-3.5", config.textClass)} />
          <span className={cn("text-xs font-medium", config.textClass)}>
            {config.label}
          </span>
        </div>

        {/* Streak */}
        {streak > 1 && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30">
            <Flame className="h-3.5 w-3.5 text-orange-400" />
            <span className="text-xs font-medium text-orange-400">
              {streak} day streak
            </span>
          </div>
        )}
      </div>

      {/* Days remaining note */}
      <div className="text-center mt-2">
        <span className="text-xs text-muted-foreground">
          {daysRemaining} business days remaining this month
        </span>
      </div>
    </div>
  );
}
