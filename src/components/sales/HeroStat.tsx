import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

interface HeroStatProps {
  value: number | string;
  label: string;
  trend?: number | null;
  prefix?: string;
  suffix?: string;
  size?: "md" | "lg" | "xl";
  className?: string;
}

const sizeConfig = {
  md: {
    value: "text-3xl sm:text-4xl",
    label: "text-sm",
    trend: "text-sm",
  },
  lg: {
    value: "text-4xl sm:text-5xl",
    label: "text-base",
    trend: "text-base",
  },
  xl: {
    value: "text-5xl sm:text-6xl",
    label: "text-lg",
    trend: "text-lg",
  },
};

export function HeroStat({
  value,
  label,
  trend,
  prefix,
  suffix,
  size = "lg",
  className,
}: HeroStatProps) {
  const sizes = sizeConfig[size];
  const hasTrend = trend !== null && trend !== undefined;
  const isPositive = trend !== null && trend !== undefined && trend >= 0;

  const formattedValue =
    typeof value === "number" ? value.toLocaleString() : value;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn("text-center", className)}
    >
      {/* Star decorations */}
      <div className="flex items-center justify-center gap-2 mb-1">
        <span className="text-yellow-500 text-lg">★</span>
        <div className="flex items-baseline gap-1">
          {prefix && (
            <span className={cn(sizes.value, "font-bold text-foreground/70")}>
              {prefix}
            </span>
          )}
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className={cn(sizes.value, "font-bold text-foreground")}
          >
            {formattedValue}
          </motion.span>
          {suffix && (
            <span className={cn(sizes.value, "font-bold text-foreground/70")}>
              {suffix}
            </span>
          )}
        </div>
        <span className="text-yellow-500 text-lg">★</span>
      </div>

      {/* Label */}
      <div className={cn(sizes.label, "font-semibold text-muted-foreground uppercase tracking-wider")}>
        {label}
      </div>

      {/* Trend indicator */}
      {hasTrend && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "flex items-center justify-center gap-1 mt-1",
            sizes.trend,
            isPositive ? "text-emerald-500" : "text-red-500"
          )}
        >
          {isPositive ? (
            <TrendingUp className="h-4 w-4" />
          ) : (
            <TrendingDown className="h-4 w-4" />
          )}
          <span className="font-medium">
            {isPositive ? "+" : ""}
            {Math.abs(trend).toFixed(1)}% vs last month
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

// Compact variant without stars
export function HeroStatCompact({
  value,
  label,
  trend,
  prefix,
  className,
}: Omit<HeroStatProps, "size" | "suffix">) {
  const hasTrend = trend !== null && trend !== undefined;
  const isPositive = trend !== null && trend !== undefined && trend >= 0;

  const formattedValue =
    typeof value === "number" ? value.toLocaleString() : value;

  return (
    <div className={cn("text-center", className)}>
      <div className="flex items-baseline justify-center gap-1">
        {prefix && (
          <span className="text-2xl font-bold text-foreground/70">{prefix}</span>
        )}
        <span className="text-3xl sm:text-4xl font-bold text-foreground">
          {formattedValue}
        </span>
      </div>
      <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      {hasTrend && (
        <div
          className={cn(
            "flex items-center justify-center gap-0.5 text-xs mt-0.5",
            isPositive ? "text-emerald-500" : "text-red-500"
          )}
        >
          {isPositive ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          <span>
            {isPositive ? "+" : ""}
            {Math.abs(trend).toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}
