import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useRef, useState } from "react";

type RingMetric = { 
  key: string; 
  label: string; 
  progress: number; 
  color: string;
  actual?: number;
  target?: number;
};

function usePrefersReducedMotion() {
  const m = typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
  const [reduced, setReduced] = useState(!!m?.matches);
  
  useEffect(() => {
    if (!m) return;
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    m.addEventListener?.("change", listener);
    return () => m.removeEventListener?.("change", listener);
  }, [m]);
  
  return reduced;
}

function Ring({ 
  progress, 
  color, 
  size = 120, 
  duration = 900,
  actual,
  targetValue
}: { 
  progress: number; 
  color: string; 
  size?: number; 
  duration?: number; 
  actual?: number;
  targetValue?: number;
}) {
  const r = size / 2 - 10;
  const circumference = 2 * Math.PI * r;
  const target = Math.max(0, Math.min(progress, 1)) * circumference; // cap at 100%
  const [dashArray, setDashArray] = useState(0);
  const reduced = usePrefersReducedMotion();
  const circleRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    // Only animate if the target value actually changed
    if (reduced) {
      setDashArray(target);
      return;
    }

    // Prevent unnecessary animations by checking if target actually changed
    const currentDashArray = dashArray;
    if (Math.abs(currentDashArray - target) < 0.01) {
      return; // No significant change, skip animation
    }

    // Start from current position and animate to target
    const id = requestAnimationFrame(() => {
      // Apply CSS transition
      if (circleRef.current) {
        circleRef.current.style.transition = `stroke-dasharray ${duration}ms ease-out`;
      }
      setDashArray(target);
    });

    return () => cancelAnimationFrame(id);
  }, [target, reduced, duration]);

  return (
    <div className="relative">
      <svg width={size} height={size} className="rotate-[-90deg]">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="hsl(var(--border))"
          strokeOpacity="0.25"
          strokeWidth="12"
          fill="none"
        />
        {/* Progress ring */}
        <circle
          ref={circleRef}
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth="12"
          strokeDasharray={`${dashArray} ${circumference}`}
          strokeLinecap="round"
          fill="none"
          className={progress >= 1 ? "drop-shadow-md" : ""}
        />
      </svg>
      {/* Number display inside the ring */}
      {actual !== undefined && (
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ fontSize: `${size * 0.2}px`, lineHeight: 1 }}
        >
          <span 
            className="font-bold tabular-nums"
            style={{ color }}
          >
            {actual}
          </span>
        </div>
      )}
    </div>
  );
}

export default function MemberRingsCard({ 
  name, 
  date, 
  metrics,
  memberId,
  onMemberClick
}: { 
  name: string; 
  date: string; 
  metrics: RingMetric[];
  memberId?: string;
  onMemberClick?: (memberId: string) => void;
}) {
  const handleClick = () => {
    if (memberId && onMemberClick) {
      onMemberClick(memberId);
    }
  };
  return (
    <Card 
      className={`w-full max-w-sm transition-opacity duration-200 ${
        memberId && onMemberClick ? 'cursor-pointer hover:opacity-90' : ''
      }`}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-foreground truncate">{name}</div>
          <div className="text-xs text-muted-foreground">{date}</div>
        </div>
        <div className="grid grid-cols-2 gap-6 place-items-center">
          {metrics.map((metric) => (
            <div key={metric.key} className="flex flex-col items-center">
              <Ring 
                progress={metric.progress} 
                color={metric.color} 
                actual={metric.actual}
                targetValue={metric.target}
              />
              <div className="text-xs text-center text-muted-foreground mt-1 font-medium">
                {metric.label}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}