/**
 * KPI utility functions for consistent handling across the application.
 * These utilities ensure defensive deduplication to prevent duplicate KPIs
 * from appearing in dropdowns or lists, even if database queries return duplicates.
 */

/**
 * Deduplicates an array of KPIs by their slug, keeping the first occurrence.
 * This is a defensive measure to prevent duplicate KPIs from appearing in UI
 * even if the database function returns duplicates (e.g., due to role mismatches).
 * 
 * @param kpis - Array of objects with a 'slug' property
 * @returns Deduplicated array with only the first occurrence of each slug
 */
export function deduplicateKpisBySlug<T extends { slug: string }>(kpis: T[]): T[] {
  const seen = new Set<string>();
  return kpis.filter(kpi => {
    if (seen.has(kpi.slug)) return false;
    seen.add(kpi.slug);
    return true;
  });
}

/**
 * Deduplicates an array of KPIs by their kpi_id, keeping the first occurrence.
 * Use this when you need to deduplicate by ID rather than slug.
 * 
 * @param kpis - Array of objects with a 'kpi_id' property
 * @returns Deduplicated array with only the first occurrence of each kpi_id
 */
export function deduplicateKpisById<T extends { kpi_id: string }>(kpis: T[]): T[] {
  const seen = new Set<string>();
  return kpis.filter(kpi => {
    if (seen.has(kpi.kpi_id)) return false;
    seen.add(kpi.kpi_id);
    return true;
  });
}
