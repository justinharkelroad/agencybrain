import { RING_LABELS, getRingColor } from "./colors";

interface RingLegendProps {
  metrics: string[];
  kpiLabels?: Record<string, string>; // Database labels override hardcoded
}

export default function RingLegend({ metrics, kpiLabels }: RingLegendProps) {
  if (metrics.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm mb-4 p-3 bg-muted/30 rounded-lg">
      <span className="font-medium text-muted-foreground">Legend:</span>
      {metrics.map((metricKey) => (
        <div key={metricKey} className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ background: getRingColor(metricKey) }}
          />
          <span className="text-foreground">
            {kpiLabels?.[metricKey] || RING_LABELS[metricKey] || metricKey}
          </span>
        </div>
      ))}
    </div>
  );
}