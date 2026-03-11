import { normalizeProductType } from '@/lib/lqs-sales-parser';

export interface ExistingSaleIdentity {
  household_id?: string | null;
  product_type: string;
  policy_number: string | null;
}

export function isSamePolicyProduct(
  existing: ExistingSaleIdentity,
  policyNumber: string | null,
  productType: string,
): boolean {
  const normalizedPolicyNumber = (policyNumber || '').trim().toLowerCase();
  if (!normalizedPolicyNumber) return false;

  return (existing.policy_number || '').trim().toLowerCase() === normalizedPolicyNumber &&
    normalizeProductType(existing.product_type).toLowerCase() === normalizeProductType(productType).toLowerCase();
}

export function hasCrossHouseholdPolicyDuplicate(
  existingSales: ExistingSaleIdentity[],
  householdId: string,
  policyNumber: string | null,
  productType: string,
): boolean {
  return existingSales.some((existing) =>
    isSamePolicyProduct(existing, policyNumber, productType) &&
    existing.household_id !== householdId
  );
}
