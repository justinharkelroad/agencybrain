import { RING_COLORS, RING_LABELS } from "./colors";

export default function RingLegend({ metrics }: { metrics: string[] }) {
  if (metrics.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm mb-4 p-3 bg-muted/30 rounded-lg">
      <span className="font-medium text-muted-foreground">Legend:</span>
      {metrics.map((metricKey) => (
        <div key={metricKey} className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ background: RING_COLORS[metricKey] || "#9ca3af" }}
          />
          <span className="text-foreground">{RING_LABELS[metricKey] ?? metricKey}</span>
        </div>
      ))}
    </div>
  );
}