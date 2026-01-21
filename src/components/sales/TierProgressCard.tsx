import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Target, TrendingUp, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface TierProgress {
  current_tier: {
    name: string;
    rate: number;
    min_threshold: number;
    tier_index: number;
  } | null;
  next_tier: {
    name: string;
    rate: number;
    min_threshold: number;
    amount_needed: number;
    bonus_if_hit: number;
  } | null;
  current_value: number;
  tier_metric: string;
  progress_percent: number;
  total_tiers: number;
}

interface TierProgressCardProps {
  tierProgress: TierProgress | null;
  payoutType?: string;
  className?: string;
}

function formatRate(rate: number, payoutType: string): string {
  if (payoutType === "percentage") {
    return `${rate}%`;
  }
  return `$${rate}`;
}

function formatMetricLabel(metric: string): string {
  switch (metric) {
    case "items":
      return "items";
    case "premium":
      return "premium";
    case "policies":
      return "policies";
    case "households":
      return "households";
    default:
      return metric;
  }
}

function formatMetricValue(value: number, metric: string): string {
  if (metric === "premium") {
    return `$${value.toLocaleString()}`;
  }
  return value.toLocaleString();
}

export function TierProgressCard({
  tierProgress,
  payoutType = "flat_per_item",
  className,
}: TierProgressCardProps) {
  if (!tierProgress || tierProgress.total_tiers === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border/50 bg-card/50 p-4",
          className
        )}
      >
        <div className="text-center text-muted-foreground text-sm">
          No compensation plan assigned
        </div>
      </div>
    );
  }

  const { current_tier, next_tier, current_value, tier_metric, progress_percent, total_tiers } = tierProgress;
  const isAtTopTier = !next_tier && current_tier;
  const metricLabel = formatMetricLabel(tier_metric);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "rounded-xl border border-border/50 bg-gradient-to-br from-card/80 to-card/40 p-4 space-y-3",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-sm">Tier Progress</span>
        </div>
        {current_tier && (
          <div className="text-xs text-muted-foreground">
            Tier {current_tier.tier_index + 1} of {total_tiers}
          </div>
        )}
      </div>

      {/* Current Tier */}
      {current_tier ? (
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              Current
            </div>
            <div className="font-bold text-lg text-foreground">
              {current_tier.name}
              <span className="ml-2 text-primary">
                @ {formatRate(current_tier.rate, payoutType)}/{tier_metric === "premium" ? "item" : "item"}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-foreground">
              {formatMetricValue(current_value, tier_metric)}
            </div>
            <div className="text-xs text-muted-foreground">{metricLabel}</div>
          </div>
        </div>
      ) : (
        <div className="text-center py-2">
          <div className="text-sm text-muted-foreground">
            Get to {formatMetricValue(next_tier?.min_threshold || 0, tier_metric)} {metricLabel} to start earning!
          </div>
        </div>
      )}

      {/* Progress to Next Tier */}
      {next_tier && (
        <>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                Progress to {next_tier.name}
              </span>
              <span className="font-medium">
                {formatMetricValue(current_value, tier_metric)} / {formatMetricValue(next_tier.min_threshold, tier_metric)}
              </span>
            </div>
            <Progress value={progress_percent} className="h-2" />
          </div>

          {/* Next Tier Incentive */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className={cn(
              "rounded-lg p-3",
              "bg-gradient-to-r from-primary/10 to-primary/5",
              "border border-primary/20"
            )}
          >
            <div className="flex items-start gap-2">
              <Target className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">
                  <span className="text-primary font-bold">
                    {formatMetricValue(next_tier.amount_needed, tier_metric)}
                  </span>{" "}
                  more {metricLabel} to{" "}
                  <span className="font-bold">{next_tier.name}</span>{" "}
                  @ {formatRate(next_tier.rate, payoutType)}/item
                </div>
                {next_tier.bonus_if_hit > 0 && (
                  <div className="flex items-center gap-1 text-xs text-primary">
                    <Zap className="h-3 w-3" />
                    <span>
                      +${next_tier.bonus_if_hit.toLocaleString()} potential bonus
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* At Top Tier Message */}
      {isAtTopTier && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn(
            "rounded-lg p-3 text-center",
            "bg-gradient-to-r from-emerald-500/10 to-green-500/10",
            "border border-emerald-500/20"
          )}
        >
          <div className="flex items-center justify-center gap-2 text-emerald-500">
            <span className="text-lg">🏆</span>
            <span className="font-semibold">You're at the top tier!</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Keep crushing it at {formatRate(current_tier.rate, payoutType)}/item
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// Compact version for inline display
export function TierProgressInline({
  tierProgress,
  payoutType = "flat_per_item",
  className,
}: TierProgressCardProps) {
  if (!tierProgress || !tierProgress.next_tier) {
    return null;
  }

  const { next_tier, tier_metric } = tierProgress;
  const metricLabel = formatMetricLabel(tier_metric);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-primary",
        className
      )}
    >
      <Target className="h-3 w-3" />
      <span>
        {formatMetricValue(next_tier.amount_needed, tier_metric)} more {metricLabel} to {next_tier.name}
      </span>
    </div>
  );
}
