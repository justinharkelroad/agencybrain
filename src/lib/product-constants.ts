// Products excluded from ALL performance metrics (counts, premiums, items, points)
// NOTE: These products can still be entered/logged, they just don't count toward metrics
// NOTE: This does NOT apply to Compensation Analyzer - comp calculations include all products
export const EXCLUDED_PRODUCTS = ['Motor Club'] as const;

export type ExcludedProduct = (typeof EXCLUDED_PRODUCTS)[number];

/**
 * Check if a product type should be excluded from performance metrics
 */
export function isExcludedProduct(productType: string | null | undefined): boolean {
  if (!productType) return false;
  return EXCLUDED_PRODUCTS.some(
    excluded => excluded.toLowerCase() === productType.toLowerCase()
  );
}

/**
 * Filter an array of quotes to only include countable ones (for LQS metrics)
 */
export function filterCountableQuotes<T extends { product_type: string }>(quotes: T[]): T[] {
  return quotes.filter(q => !isExcludedProduct(q.product_type));
}

/**
 * Filter an array of sales to only include countable ones
 */
export function filterCountableSales<T extends { product_type: string }>(sales: T[]): T[] {
  return sales.filter(s => !isExcludedProduct(s.product_type));
}

/**
 * Filter an array of sale policies to only include countable ones
 * Works with sale_policies (policy_type_name) and other tables (policy_type)
 */
export function filterCountablePolicies<T extends { 
  policy_type?: string | null;
  policy_type_name?: string | null;
}>(policies: T[]): T[] {
  return policies.filter(p => {
    const policyType = p.policy_type_name || p.policy_type;
    return !isExcludedProduct(policyType);
  });
}

/**
 * Check if a sale has any excluded policies
 * Useful for determining if metrics need recalculation
 */
export function hasExcludedPolicy<T extends { 
  policy_type?: string | null;
  policy_type_name?: string | null;
}>(policies: T[]): boolean {
  return policies.some(p => {
    const policyType = p.policy_type_name || p.policy_type;
    return isExcludedProduct(policyType);
  });
}

/**
 * Calculate countable totals from an array of policies
 * Returns only metrics from non-excluded products
 */
export function calculateCountableTotals<T extends { 
  policy_type?: string | null;
  policy_type_name?: string | null;
  total_premium?: number | null;
  total_items?: number | null;
  total_points?: number | null;
}>(policies: T[]): { premium: number; items: number; points: number; policyCount: number } {
  const countable = filterCountablePolicies(policies);
  return {
    premium: countable.reduce((sum, p) => sum + (p.total_premium || 0), 0),
    items: countable.reduce((sum, p) => sum + (p.total_items || 0), 0),
    points: countable.reduce((sum, p) => sum + (p.total_points || 0), 0),
    policyCount: countable.length,
  };
}
