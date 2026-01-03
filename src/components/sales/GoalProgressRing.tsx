import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface GoalProgressRingProps {
  current: number;
  target: number;
  label?: string;
  size?: "xs" | "sm" | "md" | "lg";
  showPercentage?: boolean;
  animated?: boolean;
  formatValue?: (value: number) => string;
}

const sizeConfig = {
  xs: { dimension: 80, strokeWidth: 4, fontSize: { percent: 14, value: 10, label: 8 } },
  sm: { dimension: 100, strokeWidth: 5, fontSize: { percent: 16, value: 11, label: 9 } },
  md: { dimension: 160, strokeWidth: 8, fontSize: { percent: 28, value: 14, label: 11 } },
  lg: { dimension: 200, strokeWidth: 10, fontSize: { percent: 40, value: 18, label: 13 } },
};

function getGlowColor(percent: number): string {
  if (percent >= 80) return "rgba(16, 185, 129, 0.4)";
  if (percent >= 50) return "rgba(245, 158, 11, 0.3)";
  return "rgba(239, 68, 68, 0.3)";
}

function getGradientId(percent: number): string {
  if (percent >= 80) return "ring-gradient-green";
  if (percent >= 50) return "ring-gradient-yellow";
  return "ring-gradient-red";
}

export function GoalProgressRing({
  current,
  target,
  label = "GOAL",
  size = "lg",
  showPercentage = true,
  animated = true,
  formatValue = (v) => v.toLocaleString(),
}: GoalProgressRingProps) {
  const [animatedPercent, setAnimatedPercent] = useState(0);
  const config = sizeConfig[size];
  const percent = target > 0 ? Math.min(100, (current / target) * 100) : 0;

  useEffect(() => {
    if (!animated) {
      setAnimatedPercent(percent);
      return;
    }

    // Animate from 0 to target percent
    const duration = 1500;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedPercent(percent * eased);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [percent, animated]);

  const radius = (config.dimension - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedPercent / 100) * circumference;
  const glowColor = getGlowColor(percent);
  const gradientId = getGradientId(percent);
  const isComplete = percent >= 100;

  return (
    <div 
      className={cn(
        "relative flex items-center justify-center",
        isComplete && "animate-pulse-glow"
      )}
      style={{
        width: config.dimension,
        height: config.dimension,
        ["--glow-color" as string]: glowColor,
      }}
    >
      <svg
        width={config.dimension}
        height={config.dimension}
        className="transform -rotate-90"
        style={{
          filter: `drop-shadow(0 0 20px ${glowColor})`,
        }}
      >
        {/* Gradient definitions */}
        <defs>
          <linearGradient id="ring-gradient-red" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#EF4444" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <linearGradient id="ring-gradient-yellow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#84CC16" />
          </linearGradient>
          <linearGradient id="ring-gradient-green" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>

        {/* Background ring */}
        <circle
          cx={config.dimension / 2}
          cy={config.dimension / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={config.strokeWidth}
        />

        {/* Progress ring */}
        <circle
          cx={config.dimension / 2}
          cy={config.dimension / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-300"
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {showPercentage && (
          <span
            className="font-bold text-foreground leading-none"
            style={{ fontSize: config.fontSize.percent }}
          >
            {Math.round(animatedPercent)}%
          </span>
        )}
        <span
          className="font-semibold text-foreground/90 mt-1"
          style={{ fontSize: config.fontSize.value }}
        >
          {formatValue(current)}
        </span>
        <span
          className="text-muted-foreground mt-0.5"
          style={{ fontSize: config.fontSize.label }}
        >
          of {formatValue(target)} {label}
        </span>
      </div>
    </div>
  );
}
