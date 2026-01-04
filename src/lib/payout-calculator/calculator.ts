// Core payout calculation logic

import { CompPlan, CompPlanTier } from "@/hooks/useCompPlans";
import { SubProducerMetrics } from "@/lib/allstate-analyzer/sub-producer-analyzer";
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
 * Calculate commission based on payout type and tier
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
  let bonusAmount = 0;
  
  // Calculate based on payout type (matching UI values)
  switch (plan.payout_type) {
    case 'percent_of_premium':
      // Commission value is a percentage of net premium
      baseCommission = performance.netPremium * (commissionValue / 100);
      break;
    case 'flat_per_item':
      // Commission value is a flat amount per issued item
      baseCommission = performance.issuedItems * commissionValue;
      break;
    case 'flat_per_policy':
      // Commission value is a flat amount per issued policy
      baseCommission = performance.issuedPolicies * commissionValue;
      break;
    case 'flat_per_household':
      // Commission value is a flat amount per household
      baseCommission = performance.writtenHouseholds * commissionValue;
      break;
    default:
      // Default to percentage of net premium
      baseCommission = performance.netPremium * (commissionValue / 100);
  }
  
  // Apply chargeback rule
  if (plan.chargeback_rule === 'full' && performance.chargebackPremium > 0) {
    // Chargebacks are already reflected in netPremium for percentage
    // For flat rate payouts, deduct based on chargeback count
    if (plan.payout_type !== 'percent_of_premium') {
      const chargebackDeduction = performance.chargebackCount * commissionValue;
      baseCommission = Math.max(0, baseCommission - chargebackDeduction);
    }
  }
  
  const totalPayout = baseCommission + bonusAmount;
  
  return { baseCommission, bonusAmount, totalPayout };
}

/**
 * Convert SubProducerMetrics to SubProducerPerformance
 */
export function convertToPerformance(
  metrics: SubProducerMetrics,
  teamMemberId: string | null,
  teamMemberName: string | null
): SubProducerPerformance {
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
    
    // Chargebacks
    chargebackPremium: metrics.premiumChargebacks,
    chargebackCount: metrics.chargebackCount,
    
    // Net
    netPremium: metrics.netPremium,
    netItems: metrics.creditCount - metrics.chargebackCount,
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
    
    // Chargebacks
    chargebackPremium: performance.chargebackPremium,
    chargebackCount: performance.chargebackCount,
    
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
    
    status: 'draft',
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
    
    // Convert metrics to performance
    const performance = convertToPerformance(metrics, teamMember.id, teamMember.name);
    
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
      
      const payout = calculateMemberPayout(performance, plan, periodMonth, periodYear);
      payouts.push(payout);
    }
  }
  
  return { payouts, warnings };
}
