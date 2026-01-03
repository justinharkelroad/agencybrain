import { LucideIcon, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatOrbProps {
  value: number | string;
  label: string;
  icon: LucideIcon;
  color: "green" | "blue" | "orange" | "purple" | "cyan";
  trend?: { value: number; direction: "up" | "down" };
  onClick?: () => void;
  animationDelay?: number;
  projection?: number | string | null;
}

const orbColors = {
  green: { 
    icon: "text-emerald-400", 
  },
  blue: { 
    icon: "text-blue-400", 
  },
  orange: { 
    icon: "text-amber-400", 
  },
  purple: { 
    icon: "text-violet-400", 
  },
  cyan: {
    icon: "text-cyan-400",
  },
};

export function StatOrb({ 
  value, 
  label, 
  icon: Icon, 
  color, 
  trend, 
  onClick,
  animationDelay = 0,
  projection 
}: StatOrbProps) {
  const colorConfig = orbColors[color];
  
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative group",
        "bg-card border border-border",
        "rounded-2xl p-4 min-w-[100px]",
        "flex flex-col items-center justify-center gap-1",
        "transition-all duration-300 ease-out",
        "hover:bg-accent/50",
        "animate-orb-fade-in",
        onClick && "cursor-pointer"
      )}
      style={{
        animationDelay: `${animationDelay}ms`,
      }}
    >
      {/* Icon */}
      <Icon className={cn("h-5 w-5", colorConfig.icon)} />
      
      {/* Value */}
      <span className="text-2xl font-bold text-foreground leading-none">
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      
      {/* Projection */}
      {projection !== undefined && projection !== null && (
        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
          <TrendingUp className="h-3 w-3" />
          {typeof projection === "number" ? projection.toLocaleString() : projection}
        </span>
      )}
      
      {/* Label */}
      <span className="text-xs text-muted-foreground">
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
