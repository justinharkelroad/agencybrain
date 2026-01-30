export const RING_COLORS: Record<string, string> = {
  outbound_calls: "#ef4444",     // red
  talk_minutes: "#3b82f6",       // blue
  // OLD keys (backward compatibility)
  quoted_count: "#f59e0b",       // orange
  sold_items: "#22c55e",         // green
  // NEW standardized keys
  quoted_households: "#f59e0b",  // orange (same as quoted_count)
  items_sold: "#22c55e",         // green (same as sold_items)
  sold_policies: "#22c55e",      // green
  sold_premium: "#22c55e",       // green
  cross_sells_uncovered: "#a855f7", // purple
  mini_reviews: "#10b981"        // emerald
};

// Colors for custom KPIs (cycled through for variety)
const CUSTOM_KPI_COLORS = [
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
  "#ec4899", // pink
  "#14b8a6", // teal
  "#eab308", // yellow
  "#6366f1", // indigo
  "#84cc16", // lime
];

/**
 * Get ring color for a metric key
 * For custom KPIs, generates a consistent color based on the key
 */
export function getRingColor(metricKey: string): string {
  // Check static mapping first
  if (RING_COLORS[metricKey]) {
    return RING_COLORS[metricKey];
  }

  // For custom KPIs, generate a consistent color based on the key hash
  if (metricKey.startsWith('custom_')) {
    // Use the numeric part of the key to pick a color consistently
    const numPart = metricKey.replace(/\D/g, '');
    const index = numPart ? parseInt(numPart.slice(-2)) % CUSTOM_KPI_COLORS.length : 0;
    return CUSTOM_KPI_COLORS[index];
  }

  // Default grey
  return "#9ca3af";
}

export const RING_LABELS: Record<string, string> = {
  outbound_calls: "Calls",
  talk_minutes: "Minutes", 
  // OLD keys (backward compatibility)
  quoted_count: "Quoted",
  sold_items: "Sold (Items)",
  // NEW standardized keys
  quoted_households: "Quoted Households",
  items_sold: "Items Sold",
  sold_policies: "Sold (Policies)",
  sold_premium: "Sold (Premium)",
  cross_sells_uncovered: "Cross-sells",
  mini_reviews: "Mini-reviews"
};