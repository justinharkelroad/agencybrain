export function normalizePolicyType(value: string): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const POLICY_TYPE_ALIASES: string[][] = [
  ["auto", "alpac", "vehicle", "car"],
  ["home", "homeowner", "homeowners", "house"],
  ["renters", "renter", "tenant"],
  ["condo", "condominium"],
  ["umbrella", "pup"],
  ["life", "termlife", "wholelife"],
  ["landlord", "dwelling", "rentaldwelling"],
  ["motorcycle", "motorbike", "mc"],
  ["boat", "watercraft"],
];

function inSameAliasGroup(a: string, b: string): boolean {
  return POLICY_TYPE_ALIASES.some((group) => group.includes(a) && group.includes(b));
}

export function policyTypeMatchesFilter(policyType: string, selectedFilters: string[]): boolean {
  if (!selectedFilters || selectedFilters.length === 0) return true;

  const normalizedType = normalizePolicyType(policyType);
  if (!normalizedType) return false;

  return selectedFilters.some((filter) => {
    const normalizedFilter = normalizePolicyType(filter);
    if (!normalizedFilter) return false;

    if (normalizedType === normalizedFilter) return true;
    if (normalizedType.includes(normalizedFilter) || normalizedFilter.includes(normalizedType)) return true;
    if (inSameAliasGroup(normalizedType, normalizedFilter)) return true;

    return false;
  });
}
