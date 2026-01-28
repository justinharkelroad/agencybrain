import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";

interface StreakBadgeProps {
  streak: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: {
    container: "px-2 py-0.5 text-xs gap-1",
    icon: "h-3 w-3",
  },
  md: {
    container: "px-3 py-1 text-sm gap-1.5",
    icon: "h-4 w-4",
  },
  lg: {
    container: "px-4 py-1.5 text-base gap-2",
    icon: "h-5 w-5",
  },
};

// Get color intensity based on streak length
function getStreakColor(streak: number): {
  bg: string;
  border: string;
  text: string;
  glow: string;
} {
  if (streak >= 30) {
    // Epic streak - purple/violet
    return {
      bg: "bg-gradient-to-r from-violet-500/20 to-purple-500/20",
      border: "border-violet-500/50",
      text: "text-violet-600 dark:text-violet-400",
      glow: "shadow-violet-500/30",
    };
  }
  if (streak >= 14) {
    // Hot streak - red/orange
    return {
      bg: "bg-gradient-to-r from-red-500/20 to-orange-500/20",
      border: "border-red-500/50",
      text: "text-red-600 dark:text-red-400",
      glow: "shadow-red-500/30",
    };
  }
  if (streak >= 7) {
    // Good streak - orange
    return {
      bg: "bg-gradient-to-r from-orange-500/20 to-amber-500/20",
      border: "border-orange-500/50",
      text: "text-orange-600 dark:text-orange-400",
      glow: "shadow-orange-500/20",
    };
  }
  if (streak >= 3) {
    // Building streak - yellow
    return {
      bg: "bg-gradient-to-r from-yellow-500/20 to-amber-500/20",
      border: "border-yellow-500/50",
      text: "text-yellow-600 dark:text-yellow-400",
      glow: "shadow-yellow-500/20",
    };
  }
  // Starting streak - muted
  return {
    bg: "bg-muted/50",
    border: "border-border",
    text: "text-muted-foreground",
    glow: "",
  };
}

export function StreakBadge({
  streak,
  size = "md",
  showLabel = true,
  className,
}: StreakBadgeProps) {
  if (streak <= 0) return null;

  const sizes = sizeConfig[size];
  const colors = getStreakColor(streak);
  const isHotStreak = streak >= 7;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className={cn(
        "inline-flex items-center rounded-full border",
        colors.bg,
        colors.border,
        isHotStreak && "shadow-lg",
        colors.glow,
        sizes.container,
        className
      )}
    >
      <motion.div
        animate={
          isHotStreak
            ? {
                scale: [1, 1.1, 1],
                rotate: [0, -3, 3, 0],
              }
            : {}
        }
        transition={{
          duration: 1.5,
          repeat: Infinity,
          repeatType: "reverse",
        }}
      >
        <Flame className={cn(sizes.icon, colors.text, "fill-current")} />
      </motion.div>
      <span className={cn("font-bold", colors.text)}>
        {streak}
        {showLabel && <span className="font-normal ml-0.5">-day streak</span>}
      </span>
    </motion.div>
  );
}

// Compact version for header
export function StreakBadgeCompact({
  streak,
  className,
}: Pick<StreakBadgeProps, "streak" | "className">) {
  if (streak <= 0) return null;

  const colors = getStreakColor(streak);
  const isHotStreak = streak >= 7;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        "inline-flex items-center gap-1 text-sm",
        colors.text,
        className
      )}
    >
      <motion.div
        animate={
          isHotStreak
            ? {
                scale: [1, 1.15, 1],
              }
            : {}
        }
        transition={{
          duration: 1,
          repeat: Infinity,
          repeatType: "reverse",
        }}
      >
        <Flame className="h-4 w-4 fill-current" />
      </motion.div>
      <span className="font-semibold">{streak}</span>
    </motion.div>
  );
}
