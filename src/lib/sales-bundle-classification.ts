const EXCLUDED_PRODUCTS = new Set(["motor club"]);

const HOME_PRODUCT_NAMES = new Set([
  "homeowners",
  "north light homeowners",
  "condo",
  "north light condo",
  "renters",
  "landlords",
]);

export type BundleTypeLabel = "Preferred" | "Standard" | "Monoline";

function normalizeProductName(name: string | null | undefined): string {
  return (name || "").toLowerCase().trim();
}

function isStandardAutoProduct(name: string): boolean {
  return name === "standard auto" || name === "auto" || name.startsWith("010 -") || name.startsWith("010-");
}

function isHomeProduct(name: string): boolean {
  return HOME_PRODUCT_NAMES.has(name) || name.startsWith("070 -") || name.startsWith("070-") || name.startsWith("074 -") || name.startsWith("074-") || name.startsWith("078 -") || name.startsWith("078-");
}

export function classifyBundleType(productNames: Iterable<string | null | undefined>): BundleTypeLabel {
  const normalized = new Set<string>();

  for (const rawName of productNames) {
    const name = normalizeProductName(rawName);
    if (!name || EXCLUDED_PRODUCTS.has(name)) continue;
    normalized.add(name);
  }

  const hasAuto = [...normalized].some(isStandardAutoProduct);
  const hasHome = [...normalized].some(isHomeProduct);

  if (hasAuto && hasHome) return "Preferred";
  if (normalized.size >= 2) return "Standard";
  return "Monoline";
}

type SaleLike = {
  customer_name?: string | null;
  sale_policies?: Array<{ policy_type_name?: string | null; policy_type?: string | null }> | null;
};

export function buildCustomerBundleMap(sales: SaleLike[]): Map<string, BundleTypeLabel> {
  const productMap = new Map<string, Set<string>>();

  for (const sale of sales) {
    const customerKey = (sale.customer_name || "").toLowerCase().trim();
    if (!customerKey) continue;

    if (!productMap.has(customerKey)) {
      productMap.set(customerKey, new Set());
    }

    const customerProducts = productMap.get(customerKey)!;
    for (const policy of sale.sale_policies || []) {
      const name = normalizeProductName(policy.policy_type_name || policy.policy_type);
      if (!name || EXCLUDED_PRODUCTS.has(name)) continue;
      customerProducts.add(name);
    }
  }

  const bundleMap = new Map<string, BundleTypeLabel>();
  for (const [customerKey, products] of productMap.entries()) {
    bundleMap.set(customerKey, classifyBundleType(products));
  }
  return bundleMap;
}
