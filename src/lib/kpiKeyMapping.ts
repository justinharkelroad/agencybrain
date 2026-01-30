/**
 * KPI Key Mapping Utility
 * 
 * This module provides bidirectional mapping between:
 * - Display/UI keys (used in kpis table, scorecard_rules): items_sold, quoted_households
 * - Database column names (in metrics_daily): sold_items, quoted_count
 * - Legacy keys (policies_quoted, items_quoted)
 * 
 * The database view vw_metrics_with_team and RPC get_dashboard_daily now alias
 * columns to standard UI keys, but this utility serves as a safety net fallback.
 */

// Standard UI key - the canonical key we want to use everywhere
export const STANDARD_KEYS = {
  QUOTED: 'quoted_households',
  SOLD: 'items_sold',
} as const;

// All possible aliases for quoted metrics -> try these in order
const QUOTED_ALIASES = ['quoted_households', 'quoted_count', 'policies_quoted', 'items_quoted'];

// All possible aliases for sold metrics -> try these in order  
const SOLD_ALIASES = ['items_sold', 'sold_items'];

// Map any key to its list of fallback aliases to try
const KEY_ALIASES: Record<string, string[]> = {
  // Quoted variations
  quoted_households: QUOTED_ALIASES,
  quoted_count: QUOTED_ALIASES,
  policies_quoted: QUOTED_ALIASES,
  items_quoted: QUOTED_ALIASES,
  
  // Sold variations
  items_sold: SOLD_ALIASES,
  sold_items: SOLD_ALIASES,
};

// Map UI keys to database column names
export const KPI_KEY_TO_COLUMN: Record<string, string> = {
  // Standard UI keys -> database columns
  items_sold: 'sold_items',
  quoted_households: 'quoted_count',
  policies_quoted: 'quoted_count',   // Alias - some agencies use this key for quoted households
  items_quoted: 'quoted_count',      // Alias - some agencies use this key for quoted households
  
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
  
  // Legacy keys -> standard
  policies_quoted: 'quoted_households',
  items_quoted: 'quoted_households',
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
 * Normalize a metric key to its standard UI format
 * Converts legacy keys to canonical keys:
 * - policies_quoted, items_quoted, quoted_count -> quoted_households
 * - sold_items -> items_sold
 */
export function normalizeMetricKey(key: string): string {
  return COLUMN_TO_KPI_KEY[key] || key;
}

/**
 * Normalize an array of metric keys to standard UI format
 * Useful for cleaning up scorecard_rules.ring_metrics or selected_metrics
 */
export function normalizeMetricKeys(keys: string[]): string[] {
  return keys.map(normalizeMetricKey);
}

/**
 * Get a value from a data object using either the kpi key or any of its aliases
 * Provides graceful fallback for data that might use different key formats
 * 
 * IMPORTANT: This tries multiple possible field names to find the value,
 * handling cases where scorecard_rules uses legacy keys but data uses standard keys
 */
export function getMetricValue(data: Record<string, any>, kpiKey: string): number {
  // For custom KPIs, check custom_kpis JSONB first
  if (kpiKey.startsWith('custom_') && data.custom_kpis) {
    const customValue = data.custom_kpis[kpiKey];
    if (customValue !== undefined && customValue !== null) {
      return Number(customValue) || 0;
    }
    // If not found in custom_kpis, continue to standard fallback checks
  }

  // Get the list of aliases to try for this key
  const aliases = KEY_ALIASES[kpiKey];

  if (aliases) {
    // Try each alias in order until we find a value
    for (const alias of aliases) {
      if (data[alias] !== undefined && data[alias] !== null) {
        return Number(data[alias]) || 0;
      }
    }
  }

  // No aliases defined, try direct access (but don't return 0 yet - check custom_kpis first)
  const directValue = data[kpiKey];
  if (directValue !== undefined && directValue !== null && Number(directValue) !== 0) {
    return Number(directValue);
  }

  // Fallback to database column name (legacy data)
  const column = toColumn(kpiKey);
  const columnValue = data[column];
  if (column !== kpiKey && columnValue !== undefined && columnValue !== null && Number(columnValue) !== 0) {
    return Number(columnValue);
  }

  // Final fallback: check custom_kpis for ANY key
  // (handles forms that store standard metrics as custom KPIs)
  if (data.custom_kpis && data.custom_kpis[kpiKey] !== undefined && data.custom_kpis[kpiKey] !== null) {
    return Number(data.custom_kpis[kpiKey]) || 0;
  }

  return 0;
}
