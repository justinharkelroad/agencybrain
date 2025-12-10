/**
 * KPI Key Mapping Utility
 * 
 * This module provides bidirectional mapping between:
 * - Display/UI keys (used in kpis table, scorecard_rules): items_sold, quoted_households
 * - Database column names (in metrics_daily): sold_items, quoted_count
 * 
 * The database view vw_metrics_with_team and RPC get_dashboard_daily now alias
 * columns to standard UI keys, but this utility serves as a safety net fallback.
 */

// Map UI keys to database column names
export const KPI_KEY_TO_COLUMN: Record<string, string> = {
  // Standard UI keys -> database columns
  items_sold: 'sold_items',
  quoted_households: 'quoted_count',
  
  // Keys that map to themselves (no translation needed)
  outbound_calls: 'outbound_calls',
  talk_minutes: 'talk_minutes',
  cross_sells_uncovered: 'cross_sells_uncovered',
  mini_reviews: 'mini_reviews',
  sold_policies: 'sold_policies',
  sold_premium_cents: 'sold_premium_cents',
  
  // Legacy keys (for backward compatibility)
  sold_items: 'sold_items',
  quoted_count: 'quoted_count',
};

// Map database column names to standard UI keys
export const COLUMN_TO_KPI_KEY: Record<string, string> = {
  // Database columns -> standard UI keys
  sold_items: 'items_sold',
  quoted_count: 'quoted_households',
  
  // Columns that map to themselves
  outbound_calls: 'outbound_calls',
  talk_minutes: 'talk_minutes',
  cross_sells_uncovered: 'cross_sells_uncovered',
  mini_reviews: 'mini_reviews',
  sold_policies: 'sold_policies',
  sold_premium_cents: 'sold_premium_cents',
  
  // Already standard keys
  items_sold: 'items_sold',
  quoted_households: 'quoted_households',
};

/**
 * Convert a KPI key to its database column name
 * Use when accessing raw metrics_daily data
 */
export function toColumn(kpiKey: string): string {
  return KPI_KEY_TO_COLUMN[kpiKey] || kpiKey;
}

/**
 * Convert a database column name to its standard UI key
 * Use when displaying data or storing in configuration
 */
export function toKpiKey(column: string): string {
  return COLUMN_TO_KPI_KEY[column] || column;
}

/**
 * Normalize an array of metric keys to standard UI format
 * Useful for cleaning up scorecard_rules.ring_metrics or selected_metrics
 */
export function normalizeMetricKeys(keys: string[]): string[] {
  return keys.map(toKpiKey);
}

/**
 * Get a value from a data object using either the kpi key or column name
 * Provides graceful fallback for data that might use either format
 */
export function getMetricValue(data: Record<string, any>, kpiKey: string): number {
  // First try the standard UI key (what RPC now returns)
  if (data[kpiKey] !== undefined) {
    return Number(data[kpiKey]) || 0;
  }
  
  // Fallback to database column name (legacy data)
  const column = toColumn(kpiKey);
  if (data[column] !== undefined) {
    return Number(data[column]) || 0;
  }
  
  return 0;
}
