import { classifyBundle, type ExistingProductFlag } from "@/lib/bundle-classifier";
import { normalizeExistingCustomerProducts } from "@/lib/existing-customer-products";

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
  existing_customer_products?: Array<string | null | undefined> | null;
  sale_policies?: Array<{
    product_type_id?: string | null;
    policy_type_name?: string | null;
    policy_type?: string | {
      name?: string | null;
      product_type?: {
        name?: string | null;
      } | null;
    } | null;
    linked_product_type_name?: string | null;
    canonical_name?: string | null;
  }> | null;
};

function resolvePolicyProductName(
  policy: NonNullable<SaleLike["sale_policies"]>[number],
  canonicalNameByPolicyTypeId?: Map<string, string>,
): string {
  if (policy.linked_product_type_name) return policy.linked_product_type_name;
  if (policy.canonical_name) return policy.canonical_name;

  if (policy.product_type_id) {
    const mapped = canonicalNameByPolicyTypeId?.get(policy.product_type_id);
    if (mapped) return mapped;
  }

  if (policy.policy_type && typeof policy.policy_type === "object") {
    return policy.policy_type.product_type?.name || policy.policy_type.name || policy.policy_type_name || "";
  }

  return (typeof policy.policy_type === "string" ? policy.policy_type : policy.policy_type_name) || "";
}

export function buildCustomerBundleMap(
  sales: SaleLike[],
  canonicalNameByPolicyTypeId?: Map<string, string>,
): Map<string, BundleTypeLabel> {
  const productMap = new Map<string, Set<string>>();
  const existingProductMap = new Map<string, Set<ExistingProductFlag>>();

  for (const sale of sales) {
    const customerKey = buildCustomerKey(sale.customer_name, sale.customer_zip);
    if (!customerKey) continue;

    if (!productMap.has(customerKey)) {
      productMap.set(customerKey, new Set());
    }

    const customerProducts = productMap.get(customerKey)!;
    for (const policy of sale.sale_policies || []) {
      const resolvedName = resolvePolicyProductName(policy, canonicalNameByPolicyTypeId);
      if (resolvedName) customerProducts.add(resolvedName);
    }

    if (!existingProductMap.has(customerKey)) {
      existingProductMap.set(customerKey, new Set());
    }

    const existingProducts = existingProductMap.get(customerKey)!;
    for (const existing of normalizeExistingCustomerProducts(sale.existing_customer_products || [])) {
      existingProducts.add(existing);
    }
  }

  const bundleMap = new Map<string, BundleTypeLabel>();
  for (const [customerKey, products] of productMap.entries()) {
    bundleMap.set(customerKey, classifyBundle({
      productNames: Array.from(products),
      existingProducts: Array.from(existingProductMap.get(customerKey) || []),
    }).bundleType);
  }
  return bundleMap;
}
