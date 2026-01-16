// Termination Points Calculator
// Calculates points lost based on policy type and item count
// Uses PPI values: Auto=10, Home=20, SPL=5

// Point values per item type
const AUTO_POINTS_PER_ITEM = 10;
const HOME_POINTS_PER_ITEM = 20;
const DEFAULT_SPL_POINTS_PER_ITEM = 5;

// Allstate line codes for policy type detection
const LINE_CODES = {
  AUTO: ['010', '011', '012', '013', '014', '015', '016', '017', '018', '019'],
  HOMEOWNERS: ['070'],
  LANDLORDS: ['072'],
  RENTERS: ['073'],
  CONDO: ['074'],
  DWELLING_FIRE: ['075'],
  UMBRELLA: ['090'],
} as const;

export type PolicyType = 'auto' | 'home' | 'spl' | 'unknown';

/**
 * Detect policy type from product name or line code
 */
export function detectPolicyType(
  productName: string | null,
  lineCode: string | null
): PolicyType {
  // First try line code
  if (lineCode) {
    const code = lineCode.trim();
    if (LINE_CODES.AUTO.includes(code as any)) return 'auto';
    if (LINE_CODES.HOMEOWNERS.includes(code as any)) return 'home';
    if (LINE_CODES.LANDLORDS.includes(code as any)) return 'home';
    if (LINE_CODES.RENTERS.includes(code as any)) return 'spl';
    if (LINE_CODES.CONDO.includes(code as any)) return 'home';
    if (LINE_CODES.DWELLING_FIRE.includes(code as any)) return 'home';
    if (LINE_CODES.UMBRELLA.includes(code as any)) return 'spl';
  }

  // Fall back to product name
  if (productName) {
    const lowerName = productName.toLowerCase();

    // Auto detection
    if (lowerName.includes('auto')) return 'auto';
    if (lowerName.includes('vehicle')) return 'auto';
    if (lowerName.includes('car')) return 'auto';

    // Home detection
    if (lowerName.includes('homeowner')) return 'home';
    if (lowerName.includes('landlord')) return 'home';
    if (lowerName.includes('condo')) return 'home';
    if (lowerName.includes('dwelling')) return 'home';

    // SPL detection
    if (lowerName.includes('renter')) return 'spl';
    if (lowerName.includes('umbrella')) return 'spl';
    if (lowerName.includes('personal liability')) return 'spl';
  }

  return 'unknown';
}

/**
 * Get points per item for a given policy type
 */
export function getPointsPerItem(policyType: PolicyType): number {
  switch (policyType) {
    case 'auto':
      return AUTO_POINTS_PER_ITEM;
    case 'home':
      return HOME_POINTS_PER_ITEM;
    case 'spl':
      return DEFAULT_SPL_POINTS_PER_ITEM;
    case 'unknown':
      // Default to auto points for unknown types
      return AUTO_POINTS_PER_ITEM;
  }
}

/**
 * Calculate points lost for a single policy
 */
export function calculatePointsLost(
  productName: string | null,
  lineCode: string | null,
  itemsCount: number
): number {
  const policyType = detectPolicyType(productName, lineCode);
  const pointsPerItem = getPointsPerItem(policyType);
  return itemsCount * pointsPerItem;
}

/**
 * Calculate aggregate termination stats
 */
export interface TerminationStats {
  totalPointsLost: number;
  totalItemsLost: number;
  totalPoliciesLost: number;
  totalPremiumLostCents: number;
  autoPointsLost: number;
  homePointsLost: number;
  splPointsLost: number;
  autoItemsLost: number;
  homeItemsLost: number;
  splItemsLost: number;
}

export interface TerminationPolicy {
  product_name: string | null;
  line_code: string | null;
  items_count: number | null;
  premium_new_cents: number | null;
  is_cancel_rewrite: boolean | null;
}

/**
 * Calculate aggregate stats from a list of terminated policies
 */
export function calculateTerminationStats(
  policies: TerminationPolicy[]
): TerminationStats {
  const stats: TerminationStats = {
    totalPointsLost: 0,
    totalItemsLost: 0,
    totalPoliciesLost: 0,
    totalPremiumLostCents: 0,
    autoPointsLost: 0,
    homePointsLost: 0,
    splPointsLost: 0,
    autoItemsLost: 0,
    homeItemsLost: 0,
    splItemsLost: 0,
  };

  for (const policy of policies) {
    const itemsCount = policy.items_count ?? 1;
    const policyType = detectPolicyType(policy.product_name, policy.line_code);
    const pointsLost = calculatePointsLost(
      policy.product_name,
      policy.line_code,
      itemsCount
    );

    stats.totalPointsLost += pointsLost;
    stats.totalItemsLost += itemsCount;
    stats.totalPoliciesLost += 1;
    stats.totalPremiumLostCents += policy.premium_new_cents ?? 0;

    switch (policyType) {
      case 'auto':
        stats.autoPointsLost += pointsLost;
        stats.autoItemsLost += itemsCount;
        break;
      case 'home':
        stats.homePointsLost += pointsLost;
        stats.homeItemsLost += itemsCount;
        break;
      case 'spl':
        stats.splPointsLost += pointsLost;
        stats.splItemsLost += itemsCount;
        break;
    }
  }

  return stats;
}

/**
 * Get a human-readable label for policy type
 */
export function getPolicyTypeLabel(policyType: PolicyType): string {
  switch (policyType) {
    case 'auto':
      return 'Auto';
    case 'home':
      return 'Home';
    case 'spl':
      return 'SPL';
    case 'unknown':
      return 'Other';
  }
}

/**
 * Format cents to currency string
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Format large numbers with K/M suffix
 */
export function formatCompactNumber(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}
