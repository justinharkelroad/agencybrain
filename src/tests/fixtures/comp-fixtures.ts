import type { CompPlan, CompPlanTier } from "@/hooks/useCompPlans";
import type {
  BundleTypeBreakdown,
  InsuredAggregate,
  ProductBreakdown,
  SubProducerMetrics,
  SubProducerTransaction,
} from "@/lib/allstate-analyzer/sub-producer-analyzer";
import type { SelfGenMetrics } from "@/lib/payout-calculator/self-gen";

function makeTier(id: string, min_threshold: number, commission_value: number, sort_order: number): CompPlanTier {
  return { id, min_threshold, commission_value, sort_order };
}

export function makePlan(overrides: Partial<CompPlan> = {}): CompPlan {
  return {
    id: "plan-fixture",
    agency_id: "test-agency",
    name: "Fixture Plan",
    description: "Fixture compensation plan",
    payout_type: "percent_of_premium",
    tier_metric: "premium",
    tier_metric_source: "written",
    chargeback_rule: "none",
    brokered_flat_rate: null,
    brokered_payout_type: "flat_per_item",
    brokered_counts_toward_tier: false,
    include_brokered_in_bundling: false,
    policy_type_filter: null,
    is_active: true,
    created_at: null,
    updated_at: null,
    tiers: [
      makeTier("tier-1", 0, 5, 0),
      makeTier("tier-2", 10000, 7, 1),
      makeTier("tier-3", 20000, 10, 2),
    ],
    brokered_tiers: [],
    assigned_count: 0,
    bundle_configs: null,
    product_rates: null,
    point_values: null,
    bundling_multipliers: null,
    commission_modifiers: null,
    ...overrides,
  };
}

export function makeTransaction(overrides: Partial<SubProducerTransaction> = {}): SubProducerTransaction {
  return {
    policyNumber: "POL-1",
    insuredName: "Fixture Insured",
    product: "Standard Auto",
    transType: "Cancellation Of New Issued Transaction - First Term",
    businessType: "New Business",
    premium: -500,
    commission: -50,
    origPolicyEffDate: "10/2025",
    isAuto: true,
    bundleType: "standard",
    ...overrides,
  };
}

export function makeMetrics(overrides: Partial<SubProducerMetrics> = {}): SubProducerMetrics {
  const creditInsureds: InsuredAggregate[] = overrides.creditInsureds || [
    {
      insuredName: "Fixture Insured",
      netPremium: 10000,
      netCommission: 1000,
      transactionCount: 1,
    },
  ];
  const chargebackInsureds: InsuredAggregate[] = overrides.chargebackInsureds || [];
  const creditTransactions = overrides.creditTransactions || [
    makeTransaction({
      policyNumber: "NEW-1",
      transType: "New Business",
      premium: 10000,
      commission: 1000,
      bundleType: "standard",
    }),
  ];
  const chargebackTransactions = overrides.chargebackTransactions || [];
  const byBundleType: BundleTypeBreakdown[] = overrides.byBundleType || [
    {
      bundleType: "standard",
      premiumWritten: 10000,
      premiumChargebacks: 0,
      netPremium: 10000,
      itemsIssued: 1,
      creditCount: 1,
      chargebackCount: 0,
    },
  ];
  const byProduct: ProductBreakdown[] = overrides.byProduct || [
    {
      product: "Standard Auto",
      premiumWritten: 10000,
      premiumChargebacks: 0,
      netPremium: 10000,
      itemsIssued: 1,
      creditCount: 1,
      chargebackCount: 0,
    },
  ];

  return {
    code: "515",
    displayName: "Fixture Producer",
    premiumWritten: 10000,
    premiumChargebacks: 0,
    netPremium: 10000,
    creditCount: 1,
    chargebackCount: chargebackTransactions.length,
    policiesIssued: 1,
    itemsIssued: 1,
    commissionEarned: 1000,
    commissionChargebacks: 0,
    netCommission: 1000,
    effectiveRate: 10,
    creditInsureds,
    chargebackInsureds,
    creditTransactions,
    chargebackTransactions,
    reinstatementTransactions: overrides.reinstatementTransactions || [],
    reinstatementPremium: overrides.reinstatementPremium || 0,
    reinstatementCount: overrides.reinstatementCount || 0,
    byBundleType,
    byProduct,
    ...overrides,
  };
}

export function makeSelfGenMetrics(overrides: Partial<SelfGenMetrics> = {}): SelfGenMetrics {
  return {
    selfGenItems: 3,
    totalItems: 5,
    selfGenPercent: 60,
    selfGenPremium: 6000,
    totalPremium: 10000,
    selfGenPolicies: 3,
    totalPolicies: 5,
    selfGenHouseholds: 3,
    totalHouseholds: 5,
    ...overrides,
  };
}
