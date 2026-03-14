import { cn } from "@/lib/utils";

interface DebriefScoreRingProps {
  total: number;
  max: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function DebriefScoreRing({ total, max, size = "lg", className }: DebriefScoreRingProps) {
  const pct = max > 0 ? Math.min(total / max, 1) : 0;
  const circumference = 2 * Math.PI * 15.5;
  const strokeDasharray = `${pct * circumference} ${circumference}`;

  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32",
  };

  const textClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  };

  // Color based on score percentage
  const getColor = () => {
    if (pct >= 0.8) return "text-emerald-400";
    if (pct >= 0.5) return "text-amber-400";
    return "text-blue-400";
  };

  const getStrokeColor = () => {
    if (pct >= 0.8) return "#34d399";
    if (pct >= 0.5) return "#fbbf24";
    return "#60a5fa";
  };

  return (
    <div className={cn("relative inline-flex items-center justify-center", sizeClasses[size], className)}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          className="stroke-foreground/10"
          strokeWidth="2.5"
        />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke={getStrokeColor()}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-bold", textClasses[size], getColor())}>{total}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">/ {max}</span>
      </div>
    </div>
  );
}
