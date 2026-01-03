import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
    <ToggleGroup 
      type="single" 
      value={value} 
      onValueChange={(v) => v && onChange(v as MetricType)}
      className="justify-start"
    >
      {availableMetrics.map((metric) => (
        <ToggleGroupItem 
          key={metric} 
          value={metric} 
          aria-label={`Show ${METRIC_LABELS[metric]}`}
          className="text-xs px-3"
        >
          {METRIC_LABELS[metric]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
