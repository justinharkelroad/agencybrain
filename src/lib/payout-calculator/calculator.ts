// Core payout calculation logic

import { CompPlan, CompPlanTier } from "@/hooks/useCompPlans";
import { SubProducerMetrics, SubProducerTransaction } from "@/lib/allstate-analyzer/sub-producer-analyzer";
import { PayoutCalculation, TierMatch, SubProducerPerformance } from "./types";

interface TeamMember {
  id: string;
  name: string;
  sub_producer_code: string | null;
}

interface Assignment {
  team_member_id: string;
  comp_plan_id: string;
}

/**
 * Parse a date string that could be in various formats
 */
function parseTransactionDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  try {
    const parts = String(dateStr).split('/');
    if (parts.length === 2) {
      // MM/YYYY format
      const month = parseInt(parts[0], 10) - 1;
      const year = parseInt(parts[1], 10);
      return new Date(year, month, 1);
    } else if (parts.length === 3) {
      // MM/DD/YYYY format
      const month = parseInt(parts[0], 10) - 1;
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    // Try direct parsing
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * Filter chargebacks based on the 3-month rule (90 days)
 * Only includes chargebacks where the policy was in force for less than 90 days
 */
export function filterChargebacksByThreeMonthRule(
  chargebackTransactions: SubProducerTransaction[],
  statementMonth: number,
  statementYear: number
): {
  eligibleChargebacks: SubProducerTransaction[];
  excludedChargebacks: SubProducerTransaction[];
  eligiblePremium: number;
  excludedPremium: number;
} {
  // Use the statement date as reference for calculating days in force
  const statementDate = new Date(statementYear, statementMonth - 1, 28); // End of statement month
  
  const eligibleChargebacks: SubProducerTransaction[] = [];
  const excludedChargebacks: SubProducerTransaction[] = [];
  
  for (const cb of chargebackTransactions) {
    const effectiveDate = parseTransactionDate(cb.origPolicyEffDate);
    
    if (!effectiveDate) {
      // If we can't parse the date, include the chargeback (conservative approach)
      eligibleChargebacks.push(cb);
      continue;
    }
    
    // Calculate days in force
    const daysInForce = Math.floor(
      (statementDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysInForce < 90) {
      // Policy cancelled within 90 days - chargeback applies
      eligibleChargebacks.push(cb);
    } else {
      // Policy was in force > 90 days - chargeback excluded
      excludedChargebacks.push(cb);
    }
  }
  
  const eligiblePremium = eligibleChargebacks.reduce((sum, cb) => sum + Math.abs(cb.premium), 0);
  const excludedPremium = excludedChargebacks.reduce((sum, cb) => sum + Math.abs(cb.premium), 0);
  
  return {
    eligibleChargebacks,
    excludedChargebacks,
    eligiblePremium,
    excludedPremium,
  };
}

/**
 * Find the tier that matches the given metric value
 */
export function findMatchingTier(
  tiers: CompPlanTier[],
  metricValue: number
): TierMatch | null {
  if (!tiers || tiers.length === 0) return null;
  
  // Sort tiers by threshold descending to find highest qualifying tier
  const sortedTiers = [...tiers].sort((a, b) => b.min_threshold - a.min_threshold);
  
  for (const tier of sortedTiers) {
    if (metricValue >= tier.min_threshold) {
      return {
        tierId: tier.id,
        minThreshold: tier.min_threshold,
        commissionValue: tier.commission_value,
        metricValue,
      };
    }
  }
  
  return null;
}

/**
 * Get the metric value based on the tier metric type
 */
export function getMetricValue(
  performance: SubProducerPerformance,
  tierMetric: string
): number {
  switch (tierMetric) {
    case 'premium':
      return performance.writtenPremium;
    case 'items':
      return performance.writtenItems;
    case 'policies':
      return performance.writtenPolicies;
    case 'households':
      return performance.writtenHouseholds;
    case 'points':
      return performance.writtenPoints;
    default:
      return performance.writtenPremium;
  }
}

/**
 * Calculate commission based on payout type, tier, and chargeback rule
 */
export function calculateCommission(
  performance: SubProducerPerformance,
  plan: CompPlan,
  tierMatch: TierMatch | null
): { baseCommission: number; bonusAmount: number; totalPayout: number } {
  if (!tierMatch) {
    return { baseCommission: 0, bonusAmount: 0, totalPayout: 0 };
  }
  
  const { commissionValue } = tierMatch;
  let baseCommission = 0;
  const bonusAmount = 0;
  
  // Determine which chargeback amount to use based on rule
  let effectiveChargebackPremium = 0;
  let effectiveChargebackCount = 0;
  
  switch (plan.chargeback_rule) {
    case 'none':
      // No chargebacks deducted
      effectiveChargebackPremium = 0;
      effectiveChargebackCount = 0;
      break;
    case 'three_month':
      // Only count chargebacks where policy was in force < 90 days
      effectiveChargebackPremium = performance.eligibleChargebackPremium;
      effectiveChargebackCount = performance.eligibleChargebackCount;
      break;
    case 'full':
    default:
      // All chargebacks apply
      effectiveChargebackPremium = performance.chargebackPremium;
      effectiveChargebackCount = performance.chargebackCount;
      break;
  }
  
  // Calculate effective net premium for commission calculation
  const effectiveNetPremium = performance.issuedPremium - effectiveChargebackPremium;
  
  // Calculate based on payout type
  switch (plan.payout_type) {
    case 'percent_of_premium':
      // Commission value is a percentage of effective net premium
      baseCommission = effectiveNetPremium * (commissionValue / 100);
      break;
    case 'flat_per_item':
      // Commission value is a flat amount per issued item minus chargebacks
      baseCommission = (performance.issuedItems - effectiveChargebackCount) * commissionValue;
      break;
    case 'flat_per_policy':
      // Commission value is a flat amount per issued policy minus chargebacks
      baseCommission = (performance.issuedPolicies - effectiveChargebackCount) * commissionValue;
      break;
    case 'flat_per_household':
      // Commission value is a flat amount per household
      baseCommission = performance.writtenHouseholds * commissionValue;
      break;
    default:
      // Default to percentage of effective net premium
      baseCommission = effectiveNetPremium * (commissionValue / 100);
  }
  
  // Ensure non-negative
  baseCommission = Math.max(0, baseCommission);
  
  const totalPayout = baseCommission + bonusAmount;
  
  return { baseCommission, bonusAmount, totalPayout };
}

/**
 * Convert SubProducerMetrics to SubProducerPerformance
 * Includes 3-month rule filtering when applicable
 */
export function convertToPerformance(
  metrics: SubProducerMetrics,
  teamMemberId: string | null,
  teamMemberName: string | null,
  chargebackRule: string,
  periodMonth: number,
  periodYear: number
): SubProducerPerformance {
  // Apply 3-month rule filtering if applicable
  let eligibleChargebackPremium = metrics.premiumChargebacks;
  let eligibleChargebackCount = metrics.chargebackCount;
  let excludedChargebackCount = 0;
  
  if (chargebackRule === 'three_month' && metrics.chargebackTransactions?.length > 0) {
    const filtered = filterChargebacksByThreeMonthRule(
      metrics.chargebackTransactions,
      periodMonth,
      periodYear
    );
    eligibleChargebackPremium = filtered.eligiblePremium;
    eligibleChargebackCount = filtered.eligibleChargebacks.length;
    excludedChargebackCount = filtered.excludedChargebacks.length;
  } else if (chargebackRule === 'none') {
    eligibleChargebackPremium = 0;
    eligibleChargebackCount = 0;
    excludedChargebackCount = metrics.chargebackCount;
  }
  
  return {
    subProdCode: metrics.code,
    teamMemberId,
    teamMemberName,
    
    // Written metrics - using premium written as base
    writtenPremium: metrics.premiumWritten,
    writtenItems: metrics.itemsIssued,
    writtenPolicies: metrics.policiesIssued,
    writtenHouseholds: metrics.creditCount, // Using credit count as household proxy
    writtenPoints: metrics.creditCount, // Points can be customized
    
    // Issued metrics (same as written for first-term)
    issuedPremium: metrics.premiumWritten,
    issuedItems: metrics.itemsIssued,
    issuedPolicies: metrics.policiesIssued,
    issuedPoints: metrics.creditCount,
    
    // All chargebacks
    chargebackPremium: metrics.premiumChargebacks,
    chargebackCount: metrics.chargebackCount,
    
    // 3-month rule filtered chargebacks
    eligibleChargebackPremium,
    eligibleChargebackCount,
    excludedChargebackCount,
    
    // Net (based on all chargebacks - display purposes)
    netPremium: metrics.netPremium,
    netItems: metrics.creditCount - metrics.chargebackCount,
    
    // Raw data for detail views
    creditInsureds: metrics.creditInsureds || [],
    chargebackInsureds: metrics.chargebackInsureds || [],
    creditTransactions: metrics.creditTransactions || [],
    chargebackTransactions: metrics.chargebackTransactions || [],
  };
}

/**
 * Calculate payout for a single team member
 */
export function calculateMemberPayout(
  performance: SubProducerPerformance,
  plan: CompPlan,
  periodMonth: number,
  periodYear: number
): PayoutCalculation {
  // Get the metric value for tier matching
  const metricValue = getMetricValue(performance, plan.tier_metric);
  
  // Find matching tier
  const tierMatch = findMatchingTier(plan.tiers, metricValue);
  
  // Calculate commission
  const { baseCommission, bonusAmount, totalPayout } = calculateCommission(
    performance,
    plan,
    tierMatch
  );
  
  return {
    teamMemberId: performance.teamMemberId || '',
    teamMemberName: performance.teamMemberName || performance.subProdCode,
    compPlanId: plan.id,
    compPlanName: plan.name,
    periodMonth,
    periodYear,
    
    // Written metrics
    writtenPremium: performance.writtenPremium,
    writtenItems: performance.writtenItems,
    writtenPolicies: performance.writtenPolicies,
    writtenHouseholds: performance.writtenHouseholds,
    writtenPoints: performance.writtenPoints,
    
    // Issued metrics
    issuedPremium: performance.issuedPremium,
    issuedItems: performance.issuedItems,
    issuedPolicies: performance.issuedPolicies,
    issuedPoints: performance.issuedPoints,
    
    // Chargebacks (all)
    chargebackPremium: performance.chargebackPremium,
    chargebackCount: performance.chargebackCount,
    
    // 3-Month Rule tracking
    eligibleChargebackPremium: performance.eligibleChargebackPremium,
    eligibleChargebackCount: performance.eligibleChargebackCount,
    excludedChargebackCount: performance.excludedChargebackCount,
    chargebackRule: plan.chargeback_rule,
    
    // Net
    netPremium: performance.netPremium,
    netItems: performance.netItems,
    
    // Tier
    tierMatch,
    tierThresholdMet: tierMatch?.minThreshold || 0,
    tierCommissionValue: tierMatch?.commissionValue || 0,
    
    // Commission
    baseCommission,
    bonusAmount,
    totalPayout,
    
    // Rollover (written - issued for future months)
    rolloverPremium: 0, // Calculated separately if needed
    
    // Status
    status: 'draft',
    
    // Raw data for detail views
    creditInsureds: performance.creditInsureds,
    chargebackInsureds: performance.chargebackInsureds,
  };
}

/**
 * Calculate payouts for all assigned team members
 */
export function calculateAllPayouts(
  subProducerData: SubProducerMetrics[] | undefined | null,
  plans: CompPlan[],
  assignments: Assignment[],
  teamMembers: TeamMember[],
  periodMonth: number,
  periodYear: number
): { payouts: PayoutCalculation[]; warnings: string[] } {
  // Guard against missing data
  if (!subProducerData || !Array.isArray(subProducerData)) {
    console.warn('calculateAllPayouts: subProducerData is not available');
    return { payouts: [], warnings: ['No sub-producer data provided'] };
  }
  
  const payouts: PayoutCalculation[] = [];
  const warnings: string[] = [];
  
  // Create lookup maps
  const memberByCode = new Map<string, TeamMember>();
  const memberById = new Map<string, TeamMember>();
  teamMembers.forEach(tm => {
    if (tm.sub_producer_code) {
      memberByCode.set(tm.sub_producer_code.trim(), tm);
    }
    memberById.set(tm.id, tm);
  });
  
  const planById = new Map<string, CompPlan>();
  plans.forEach(p => planById.set(p.id, p));
  
  // Group assignments by team member
  const assignmentsByMember = new Map<string, string[]>();
  assignments.forEach(a => {
    const existing = assignmentsByMember.get(a.team_member_id) || [];
    existing.push(a.comp_plan_id);
    assignmentsByMember.set(a.team_member_id, existing);
  });
  
  // Process each sub-producer's data
  for (const metrics of subProducerData) {
    const code = metrics.code.trim();
    const teamMember = memberByCode.get(code);
    
    if (!teamMember) {
      warnings.push(`No team member found for sub-producer code: ${code}`);
      continue;
    }
    
    const memberPlanIds = assignmentsByMember.get(teamMember.id);
    if (!memberPlanIds || memberPlanIds.length === 0) {
      warnings.push(`No compensation plan assigned to: ${teamMember.name}`);
      continue;
    }
    
    // Calculate payout for each assigned plan
    for (const planId of memberPlanIds) {
      const plan = planById.get(planId);
      if (!plan) {
        warnings.push(`Plan not found: ${planId}`);
        continue;
      }
      
      if (!plan.is_active) {
        warnings.push(`Plan "${plan.name}" is inactive, skipping`);
        continue;
      }
      
      // Convert metrics to performance with plan's chargeback rule
      const performance = convertToPerformance(
        metrics, 
        teamMember.id, 
        teamMember.name,
        plan.chargeback_rule,
        periodMonth,
        periodYear
      );
      
      const payout = calculateMemberPayout(performance, plan, periodMonth, periodYear);
      payouts.push(payout);
    }
  }
  
  return { payouts, warnings };
}
