import { cn } from "@/lib/utils";

export type MetricType = "items" | "premium" | "points" | "policies" | "households";

interface MetricToggleProps {
  value: MetricType;
  onChange: (value: MetricType) => void;
  availableMetrics?: MetricType[];
}

const METRIC_LABELS: Record<MetricType, string> = {
  items: "Items",
  premium: "Premium",
  points: "Points",
  policies: "Policies",
  households: "Households",
};

export function MetricToggle({ 
  value, 
  onChange, 
  availableMetrics = ["items", "premium", "points", "policies", "households"] 
}: MetricToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
      {availableMetrics.map((metric) => (
        <button
          key={metric}
          onClick={() => onChange(metric)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
            value === metric
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {METRIC_LABELS[metric]}
        </button>
      ))}
    </div>
  );
}
