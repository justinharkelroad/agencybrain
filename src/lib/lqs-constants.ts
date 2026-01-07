// Products excluded from all LQS metrics, counts, and premium totals
export const LQS_EXCLUDED_PRODUCTS = ['Motor Club'] as const;

export function isExcludedProduct(productType: string): boolean {
  return LQS_EXCLUDED_PRODUCTS.some(
    excluded => excluded.toLowerCase() === productType.toLowerCase()
  );
}

// Helper to filter quotes for metrics
export function filterCountableQuotes<T extends { product_type: string }>(quotes: T[]): T[] {
  return quotes.filter(q => !isExcludedProduct(q.product_type));
}

// Helper to filter sales for metrics
export function filterCountableSales<T extends { product_type: string }>(sales: T[]): T[] {
  return sales.filter(s => !isExcludedProduct(s.product_type));
}
