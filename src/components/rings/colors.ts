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