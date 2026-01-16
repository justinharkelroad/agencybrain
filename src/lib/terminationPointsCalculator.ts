// Termination Points Calculator
// Calculates points lost based on policy type and item count
// Uses exact Allstate PPI values

// Point values per policy type
const POINTS_BY_TYPE: Record<PolicyType, number> = {
  auto: 10,
  homeowners: 20,
  condo: 20,
  landlords: 20,
  dwelling_fire: 20,
  manufactured_home: 20,
  renters: 5,
  umbrella: 5,
  boat: 5,
  motorcycle: 10,
  unknown: 10, // Default to auto
};

// Allstate line codes for policy type detection
const LINE_CODES = {
  AUTO: ['010', '011', '012', '013', '014', '015', '016', '017', '018', '019'],
  HOMEOWNERS: ['070'],
  LANDLORDS: ['072'],
  RENTERS: ['073'],
  CONDO: ['074'],
  DWELLING_FIRE: ['075'],
  UMBRELLA: ['090'],
  BOAT: ['080'],
  MOTORCYCLE: ['020', '021'],
  MANUFACTURED_HOME: ['071', '076'],
} as const;

// All granular policy types
export type PolicyType = 
  | 'auto' 
  | 'homeowners' 
  | 'condo' 
  | 'landlords' 
  | 'dwelling_fire'
  | 'manufactured_home'
  | 'renters' 
  | 'umbrella' 
  | 'boat'
  | 'motorcycle'
  | 'unknown';

// Display order for UI
export const POLICY_TYPE_ORDER: PolicyType[] = [
  'auto',
  'homeowners',
  'condo',
  'landlords',
  'dwelling_fire',
  'manufactured_home',
  'renters',
  'umbrella',
  'boat',
  'motorcycle',
  'unknown',
];

/**
 * Detect specific policy type from product name or line code
 */
export function detectPolicyType(
  productName: string | null,
  lineCode: string | null
): PolicyType {
  // First try line code for accuracy
  if (lineCode) {
    const code = lineCode.trim();
    if (LINE_CODES.AUTO.includes(code as any)) return 'auto';
    if (LINE_CODES.HOMEOWNERS.includes(code as any)) return 'homeowners';
    if (LINE_CODES.LANDLORDS.includes(code as any)) return 'landlords';
    if (LINE_CODES.RENTERS.includes(code as any)) return 'renters';
    if (LINE_CODES.CONDO.includes(code as any)) return 'condo';
    if (LINE_CODES.DWELLING_FIRE.includes(code as any)) return 'dwelling_fire';
    if (LINE_CODES.UMBRELLA.includes(code as any)) return 'umbrella';
    if (LINE_CODES.BOAT.includes(code as any)) return 'boat';
    if (LINE_CODES.MOTORCYCLE.includes(code as any)) return 'motorcycle';
    if (LINE_CODES.MANUFACTURED_HOME.includes(code as any)) return 'manufactured_home';
  }

  // Fall back to product name
  if (productName) {
    const lowerName = productName.toLowerCase();

    // Specific types first (more specific matches)
    if (lowerName.includes('renter')) return 'renters';
    if (lowerName.includes('umbrella')) return 'umbrella';
    if (lowerName.includes('boat') || lowerName.includes('watercraft')) return 'boat';
    if (lowerName.includes('motorcycle') || lowerName.includes('cycle')) return 'motorcycle';
    if (lowerName.includes('condo')) return 'condo';
    if (lowerName.includes('landlord')) return 'landlords';
    if (lowerName.includes('manufactured') || lowerName.includes('mobile home')) return 'manufactured_home';
    if (lowerName.includes('dwelling') || lowerName.includes('fire')) return 'dwelling_fire';
    
    // General types
    if (lowerName.includes('homeowner') || lowerName.includes('home owner')) return 'homeowners';
    if (lowerName.includes('auto') || lowerName.includes('vehicle') || lowerName.includes('car')) return 'auto';
  }

  return 'unknown';
}

/**
 * Get points per item for a given policy type
 */
export function getPointsPerItem(policyType: PolicyType): number {
  return POINTS_BY_TYPE[policyType];
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
 * Stats for a single policy type
 */
export interface PolicyTypeStats {
  pointsLost: number;
  itemsLost: number;
  policiesLost: number;
  premiumLostCents: number;
}

/**
 * Calculate aggregate termination stats
 */
export interface TerminationStats {
  totalPointsLost: number;
  totalItemsLost: number;
  totalPoliciesLost: number;
  totalPremiumLostCents: number;
  byType: Record<PolicyType, PolicyTypeStats>;
}

export interface TerminationPolicy {
  product_name: string | null;
  line_code: string | null;
  items_count: number | null;
  premium_new_cents: number | null;
  is_cancel_rewrite: boolean | null;
}

/**
 * Create empty stats for a policy type
 */
function createEmptyTypeStats(): PolicyTypeStats {
  return {
    pointsLost: 0,
    itemsLost: 0,
    policiesLost: 0,
    premiumLostCents: 0,
  };
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
    byType: {
      auto: createEmptyTypeStats(),
      homeowners: createEmptyTypeStats(),
      condo: createEmptyTypeStats(),
      landlords: createEmptyTypeStats(),
      dwelling_fire: createEmptyTypeStats(),
      manufactured_home: createEmptyTypeStats(),
      renters: createEmptyTypeStats(),
      umbrella: createEmptyTypeStats(),
      boat: createEmptyTypeStats(),
      motorcycle: createEmptyTypeStats(),
      unknown: createEmptyTypeStats(),
    },
  };

  for (const policy of policies) {
    const itemsCount = policy.items_count ?? 1;
    const policyType = detectPolicyType(policy.product_name, policy.line_code);
    const pointsLost = calculatePointsLost(
      policy.product_name,
      policy.line_code,
      itemsCount
    );
    const premiumLost = policy.premium_new_cents ?? 0;

    // Update totals
    stats.totalPointsLost += pointsLost;
    stats.totalItemsLost += itemsCount;
    stats.totalPoliciesLost += 1;
    stats.totalPremiumLostCents += premiumLost;

    // Update by-type breakdown
    stats.byType[policyType].pointsLost += pointsLost;
    stats.byType[policyType].itemsLost += itemsCount;
    stats.byType[policyType].policiesLost += 1;
    stats.byType[policyType].premiumLostCents += premiumLost;
  }

  return stats;
}

/**
 * Get a human-readable label for policy type
 */
export function getPolicyTypeLabel(policyType: PolicyType): string {
  const labels: Record<PolicyType, string> = {
    auto: 'Auto',
    homeowners: 'Homeowners',
    condo: 'Condo',
    landlords: 'Landlords',
    dwelling_fire: 'Dwelling Fire',
    manufactured_home: 'Manufactured Home',
    renters: 'Renters',
    umbrella: 'Umbrella',
    boat: 'Boat',
    motorcycle: 'Motorcycle',
    unknown: 'Other',
  };
  return labels[policyType];
}

/**
 * Get active types (types with data) sorted by items lost
 */
export function getActiveTypesWithStats(stats: TerminationStats): Array<{
  type: PolicyType;
  label: string;
  stats: PolicyTypeStats;
  pointsPerItem: number;
}> {
  return POLICY_TYPE_ORDER
    .filter(type => stats.byType[type].itemsLost > 0)
    .map(type => ({
      type,
      label: getPolicyTypeLabel(type),
      stats: stats.byType[type],
      pointsPerItem: POINTS_BY_TYPE[type],
    }))
    .sort((a, b) => b.stats.itemsLost - a.stats.itemsLost);
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
