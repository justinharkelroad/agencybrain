import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface RankBadgeProps {
  rank: number;
  totalProducers?: number;
  size?: "sm" | "md" | "lg";
  showTotal?: boolean;
  className?: string;
}

const rankConfig = {
  1: {
    emoji: "🥇",
    label: "#1",
    bgColor: "bg-gradient-to-r from-yellow-500/20 to-amber-500/20",
    borderColor: "border-yellow-500/50",
    textColor: "text-yellow-500",
    glowColor: "shadow-yellow-500/20",
  },
  2: {
    emoji: "🥈",
    label: "#2",
    bgColor: "bg-gradient-to-r from-slate-500/20 dark:from-slate-400/20 to-slate-400/20 dark:to-slate-300/20",
    borderColor: "border-slate-500/50 dark:border-slate-400/50",
    textColor: "text-slate-600 dark:text-slate-400",
    glowColor: "shadow-slate-500/20 dark:shadow-slate-400/20",
  },
  3: {
    emoji: "🥉",
    label: "#3",
    bgColor: "bg-gradient-to-r from-orange-600/20 to-amber-700/20",
    borderColor: "border-orange-600/50",
    textColor: "text-orange-500",
    glowColor: "shadow-orange-500/20",
  },
};

const sizeConfig = {
  sm: {
    container: "px-2 py-0.5 text-xs gap-1",
    emoji: "text-sm",
  },
  md: {
    container: "px-3 py-1 text-sm gap-1.5",
    emoji: "text-base",
  },
  lg: {
    container: "px-4 py-1.5 text-base gap-2",
    emoji: "text-lg",
  },
};

export function RankBadge({
  rank,
  totalProducers,
  size = "md",
  showTotal = false,
  className,
}: RankBadgeProps) {
  const isTopThree = rank >= 1 && rank <= 3;
  const config = isTopThree ? rankConfig[rank as 1 | 2 | 3] : null;
  const sizes = sizeConfig[size];

  // For ranks outside top 3
  if (!isTopThree) {
    return (
      <div
        className={cn(
          "inline-flex items-center rounded-full border",
          "bg-muted/50 border-border text-muted-foreground",
          sizes.container,
          className
        )}
      >
        <span className="font-semibold">#{rank}</span>
        {showTotal && totalProducers && (
          <span className="opacity-70">of {totalProducers}</span>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className={cn(
        "inline-flex items-center rounded-full border",
        config.bgColor,
        config.borderColor,
        "shadow-lg",
        config.glowColor,
        sizes.container,
        className
      )}
    >
      <motion.span
        initial={{ rotate: -10 }}
        animate={{ rotate: [0, -5, 5, 0] }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className={sizes.emoji}
      >
        {config.emoji}
      </motion.span>
      <span className={cn("font-bold", config.textColor)}>
        {config.label}
        {showTotal && totalProducers && (
          <span className="font-normal opacity-70 ml-1">of {totalProducers}</span>
        )}
      </span>
    </motion.div>
  );
}

// Variant for showing rank in header with "IN AGENCY" text
export function RankBadgeHeader({
  rank,
  totalProducers,
  className,
}: Omit<RankBadgeProps, "size" | "showTotal">) {
  const isTopThree = rank >= 1 && rank <= 3;
  const config = isTopThree ? rankConfig[rank as 1 | 2 | 3] : null;

  if (!isTopThree) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full",
          "bg-muted/50 border border-border text-muted-foreground text-sm",
          className
        )}
      >
        <span className="font-semibold">#{rank}</span>
        {totalProducers && <span className="opacity-70">of {totalProducers}</span>}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border",
        config.bgColor,
        config.borderColor,
        "shadow-lg",
        config.glowColor,
        className
      )}
    >
      <motion.span
        initial={{ rotate: -10 }}
        animate={{ rotate: [0, -5, 5, 0] }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        {config.emoji}
      </motion.span>
      <span className={cn("font-bold text-sm", config.textColor)}>
        {config.label} IN AGENCY
      </span>
    </motion.div>
  );
}
