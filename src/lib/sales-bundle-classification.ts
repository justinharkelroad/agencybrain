import { classifyBundle } from "@/lib/bundle-classifier";

export type BundleTypeLabel = "Preferred" | "Standard" | "Monoline";

export function buildCustomerKey(
  customerName: string | null | undefined,
  customerZip?: string | null | undefined,
): string {
  const normalizedName = (customerName || "").toLowerCase().trim();
  if (!normalizedName) return "";
  const normalizedZip = (customerZip || "").trim();
  return normalizedZip ? `${normalizedName}|${normalizedZip}` : normalizedName;
}

export function classifyBundleType(productNames: Iterable<string | null | undefined>): BundleTypeLabel {
  return classifyBundle({
    productNames: Array.from(productNames || []),
  }).bundleType;
}

type SaleLike = {
  customer_name?: string | null;
  customer_zip?: string | null;
  sale_policies?: Array<{ policy_type_name?: string | null; policy_type?: string | null }> | null;
};

export function buildCustomerBundleMap(sales: SaleLike[]): Map<string, BundleTypeLabel> {
  const productMap = new Map<string, Set<string>>();

  for (const sale of sales) {
    const customerKey = buildCustomerKey(sale.customer_name, sale.customer_zip);
    if (!customerKey) continue;

    if (!productMap.has(customerKey)) {
      productMap.set(customerKey, new Set());
    }

    const customerProducts = productMap.get(customerKey)!;
    for (const policy of sale.sale_policies || []) {
      customerProducts.add(policy.policy_type_name || policy.policy_type || "");
    }
  }

  const bundleMap = new Map<string, BundleTypeLabel>();
  for (const [customerKey, products] of productMap.entries()) {
    bundleMap.set(customerKey, classifyBundleType(products));
  }
  return bundleMap;
}
