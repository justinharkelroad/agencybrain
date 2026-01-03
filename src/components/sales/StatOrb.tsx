import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatOrbProps {
  value: number | string;
  label: string;
  icon: LucideIcon;
  color: "green" | "blue" | "orange" | "purple";
  trend?: { value: number; direction: "up" | "down" };
  onClick?: () => void;
  animationDelay?: number;
}

const orbColors = {
  green: { 
    icon: "text-emerald-400", 
    glow: "rgba(16, 185, 129, 0.15)",
    border: "border-emerald-500/20",
    gradient: "from-emerald-500/10 to-transparent"
  },
  blue: { 
    icon: "text-blue-400", 
    glow: "rgba(59, 130, 246, 0.15)",
    border: "border-blue-500/20",
    gradient: "from-blue-500/10 to-transparent"
  },
  orange: { 
    icon: "text-amber-400", 
    glow: "rgba(245, 158, 11, 0.15)",
    border: "border-amber-500/20",
    gradient: "from-amber-500/10 to-transparent"
  },
  purple: { 
    icon: "text-violet-400", 
    glow: "rgba(139, 92, 246, 0.15)",
    border: "border-violet-500/20",
    gradient: "from-violet-500/10 to-transparent"
  },
};

export function StatOrb({ 
  value, 
  label, 
  icon: Icon, 
  color, 
  trend, 
  onClick,
  animationDelay = 0 
}: StatOrbProps) {
  const colorConfig = orbColors[color];
  
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative group",
        "backdrop-blur-xl bg-white/5 dark:bg-white/5",
        "border rounded-2xl",
        colorConfig.border,
        "p-4 min-w-[100px]",
        "flex flex-col items-center justify-center gap-1",
        "transition-all duration-300 ease-out",
        "hover:scale-[1.02] hover:bg-white/10 dark:hover:bg-white/10",
        "animate-orb-fade-in",
        onClick && "cursor-pointer"
      )}
      style={{
        boxShadow: `0 8px 32px ${colorConfig.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.1)`,
        animationDelay: `${animationDelay}ms`,
      }}
    >
      {/* Background gradient */}
      <div className={cn(
        "absolute inset-0 rounded-2xl bg-gradient-to-b opacity-50",
        colorConfig.gradient
      )} />
      
      {/* Icon */}
      <Icon className={cn("h-5 w-5 relative z-10", colorConfig.icon)} />
      
      {/* Value */}
      <span className="text-2xl font-bold text-foreground relative z-10 leading-none">
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      
      {/* Label */}
      <span className="text-xs text-muted-foreground relative z-10">
        {label}
      </span>
      
      {/* Trend badge */}
      {trend && (
        <div 
          className={cn(
            "absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium",
            trend.direction === "up" 
              ? "bg-emerald-500/20 text-emerald-400" 
              : "bg-red-500/20 text-red-400"
          )}
        >
          {trend.direction === "up" ? "↑" : "↓"}{trend.value}%
        </div>
      )}
    </div>
  );
}
