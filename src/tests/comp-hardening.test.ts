// @vitest-environment node

import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  calculateBrokeredCommission,
  calculateMemberPayout,
  convertToPerformance,
  BrokeredMetrics,
} from "@/lib/payout-calculator/calculator";
import {
  makeMetrics,
  makePlan,
  makeTransaction,
} from "@/tests/fixtures/comp-fixtures";
import type { WrittenMetrics } from "@/lib/payout-calculator/types";

const periodMonth = 3;
const periodYear = 2026;

// ============================================================
// 1. Brokered tiered commission: flat-per-item interpretation
// ============================================================
describe("brokered tiered commission interpretation", () => {
  it("treats tiered brokered values as flat-per-item even when main plan is percent_of_premium", () => {
    // Scenario: main plan pays % of premium, but brokered tiers are $15/$20/$25 per item.
    // Old code guessed from value (>1 = flat). New code always treats as flat-per-item.
    // If it incorrectly used the main plan's percent_of_premium interpretation,
    // $15 would become 15% of premium = 8 * (15/100) * $500 = WRONG.
    const plan = makePlan({
      payout_type: "percent_of_premium", // main plan is percentage
      brokered_payout_type: "tiered",
      brokered_tiers: [
        { id: "bt-1", min_threshold: 0, commission_value: 15, sort_order: 0 },
        { id: "bt-2", min_threshold: 5, commission_value: 20, sort_order: 1 },
        { id: "bt-3", min_threshold: 10, commission_value: 25, sort_order: 2 },
      ],
    });

    const brokeredMetrics: BrokeredMetrics = {
      items: 8,
      premium: 5000,
      policies: 4,
      households: 3,
    };

    const result = calculateBrokeredCommission(brokeredMetrics, plan);

    // 8 items >= 5 threshold → tier-2 ($20/item) → 8 * 20 = $160
    expect(result).toBe(160);
  });

  it("treats small tiered brokered values ($0.75) as flat-per-item, not percentages", () => {
    // Regression: old code treated values <= 1 as percentages.
    // $0.75 per item would have been interpreted as 0.75 * premium = wildly wrong.
    const plan = makePlan({
      payout_type: "flat_per_item",
      brokered_payout_type: "tiered",
      brokered_tiers: [
        { id: "bt-1", min_threshold: 0, commission_value: 0.75, sort_order: 0 },
      ],
    });

    const brokeredMetrics: BrokeredMetrics = {
      items: 10,
      premium: 8000,
      policies: 5,
      households: 4,
    };

    const result = calculateBrokeredCommission(brokeredMetrics, plan);

    // 10 items * $0.75 = $7.50 (correct)
    // Old code: 8000 * 0.75 = $6000 (wrong — treated as 75% of premium)
    expect(result).toBe(7.5);
  });
});

// ============================================================
// 2. Specialty Auto under product-rate plans
// ============================================================
describe("Specialty Auto product-rate isolation", () => {
  it("pays Specialty Auto at its own product rate, separate from Auto", () => {
    const plan = makePlan({
      name: "Product Rate Plan with Specialty Auto",
      product_rates: {
        "Auto": { payout_type: "flat_per_item", rate: 15 },
        "Specialty Auto": { payout_type: "flat_per_item", rate: 10 },
        "Homeowners": { payout_type: "percent_of_premium", rate: 8 },
      },
    });

    const metrics = makeMetrics({
      premiumWritten: 12000,
      netPremium: 12000,
      itemsIssued: 6,
      policiesIssued: 6,
      creditCount: 6,
      byProduct: [
        {
          product: "Auto",
          premiumWritten: 5000,
          premiumChargebacks: 0,
          netPremium: 5000,
          itemsIssued: 3,
          creditCount: 3,
          chargebackCount: 0,
        },
        {
          product: "Specialty Auto",
          premiumWritten: 2000,
          premiumChargebacks: 0,
          netPremium: 2000,
          itemsIssued: 1,
          creditCount: 1,
          chargebackCount: 0,
        },
        {
          product: "Homeowners",
          premiumWritten: 5000,
          premiumChargebacks: 0,
          netPremium: 5000,
          itemsIssued: 2,
          creditCount: 2,
          chargebackCount: 0,
        },
      ],
    });

    const payout = calculateMemberPayout(
      convertToPerformance(metrics, "tm-1", "Test Producer", plan.chargeback_rule, periodMonth, periodYear, new Map()),
      plan,
      periodMonth,
      periodYear,
    );

    // Auto: 3 items * $15 = $45
    // Specialty Auto: 1 item * $10 = $10
    // Homeowners: $5000 * 8% = $400
    expect(payout.commissionByProduct).toEqual([
      { product: "Auto", premium: 5000, items: 3, commission: 45 },
      { product: "Specialty Auto", premium: 2000, items: 1, commission: 10 },
      { product: "Homeowners", premium: 5000, items: 2, commission: 400 },
    ]);
    expect(payout.totalPayout).toBe(455);
  });

  it("gives Specialty Auto $0 commission when only Auto rate is configured", () => {
    // If agency only configured "Auto" rate, Specialty Auto should not silently
    // inherit it — it should show as $0 commission (transparent, not hidden).
    const plan = makePlan({
      name: "Auto-only Product Rate Plan",
      product_rates: {
        "Auto": { payout_type: "flat_per_item", rate: 15 },
      },
    });

    const metrics = makeMetrics({
      premiumWritten: 7000,
      netPremium: 7000,
      itemsIssued: 4,
      policiesIssued: 4,
      creditCount: 4,
      byProduct: [
        {
          product: "Auto",
          premiumWritten: 5000,
          premiumChargebacks: 0,
          netPremium: 5000,
          itemsIssued: 3,
          creditCount: 3,
          chargebackCount: 0,
        },
        {
          product: "Specialty Auto",
          premiumWritten: 2000,
          premiumChargebacks: 0,
          netPremium: 2000,
          itemsIssued: 1,
          creditCount: 1,
          chargebackCount: 0,
        },
      ],
    });

    const payout = calculateMemberPayout(
      convertToPerformance(metrics, "tm-1", "Test Producer", plan.chargeback_rule, periodMonth, periodYear, new Map()),
      plan,
      periodMonth,
      periodYear,
    );

    // Auto: 3 * $15 = $45
    // Specialty Auto: no config → $0
    expect(payout.commissionByProduct).toEqual([
      { product: "Auto", premium: 5000, items: 3, commission: 45 },
      { product: "Specialty Auto", premium: 2000, items: 1, commission: 0 },
    ]);
    expect(payout.totalPayout).toBe(45);
  });
});

// ============================================================
// 3. Finalized overwrite blocking (persistPayoutSet logic)
// ============================================================
// Note: persistPayoutSet is a closure inside usePayoutCalculator hook and cannot
// be imported directly. We test the protection pattern: the function checks for
// existing finalized/paid rows and throws before upserting. We verify the flow
// through calculateMemberPayout → the payout has status='draft' and the
// protection would fire on the DB query. Here we test the boundary: draft payouts
// should always be saveable (status='draft'), and the protection logic is
// structurally verified.
describe("finalized payout protection contract", () => {
  it("produces payouts with draft status that can be saved", () => {
    const plan = makePlan({
      tiers: [{ id: "tier-1", min_threshold: 0, commission_value: 5, sort_order: 0 }],
    });
    const metrics = makeMetrics({
      premiumWritten: 8000,
      netPremium: 8000,
    });

    const payout = calculateMemberPayout(
      convertToPerformance(metrics, "tm-1", "Test Producer", plan.chargeback_rule, periodMonth, periodYear, new Map()),
      plan,
      periodMonth,
      periodYear,
    );

    // Calculated payouts always start as draft
    expect(payout.status).toBe("draft");

    // The persistPayoutSet protection checks for status IN ('finalized', 'paid')
    // in existing rows. A draft payout should never self-block.
    expect(payout.status).not.toBe("finalized");
    expect(payout.status).not.toBe("paid");

    // Verify the payout has the correct period for the protection query scope
    expect(payout.periodMonth).toBe(periodMonth);
    expect(payout.periodYear).toBe(periodYear);
  });

  it("includes calculation snapshot for audit trail on every payout", () => {
    const plan = makePlan({
      tiers: [{ id: "tier-1", min_threshold: 0, commission_value: 7, sort_order: 0 }],
    });
    const metrics = makeMetrics({ premiumWritten: 12000, netPremium: 12000 });

    const payout = calculateMemberPayout(
      convertToPerformance(metrics, "tm-1", "Test Producer", plan.chargeback_rule, periodMonth, periodYear, new Map()),
      plan,
      periodMonth,
      periodYear,
    );

    // Snapshot must exist for audit — this is what gets persisted as calculation_snapshot_json
    expect(payout.calculationSnapshot).toBeDefined();
    expect(payout.calculationSnapshot!.inputs.tierMetric).toBe("premium");
    expect(payout.calculationSnapshot!.inputs.chargebackRule).toBe("none");
    expect(payout.calculationSnapshot!.calculations.finalTotal).toBe(payout.totalPayout);
    expect(payout.calculationSnapshot!.calculatedAt).toBeTruthy();
  });
});

// ============================================================
// 4. Policy type filter + written metrics (manual-filter regression)
// ============================================================
describe("policy type filter with written metrics (manual-filter regression)", () => {
  it("filters written metrics to only matching policy types for tier qualification", () => {
    // Scenario: plan tiers on "items" with policy_type_filter = ["Auto"].
    // Producer has 4 Auto items + 2 Home items in sales table.
    // Tier should qualify on 4 items (Auto only), not 6 (all).
    const plan = makePlan({
      name: "Auto-only Tier Plan",
      tier_metric: "items",
      tier_metric_source: "written",
      payout_type: "percent_of_premium",
      policy_type_filter: ["Auto"],
      tiers: [
        { id: "tier-1", min_threshold: 0, commission_value: 5, sort_order: 0 },
        { id: "tier-2", min_threshold: 5, commission_value: 8, sort_order: 1 },
        { id: "tier-3", min_threshold: 10, commission_value: 12, sort_order: 2 },
      ],
    });

    // Statement data (issued production — used for payout base)
    const metrics = makeMetrics({
      premiumWritten: 20000,
      netPremium: 20000,
      itemsIssued: 6,
      policiesIssued: 6,
      creditCount: 6,
    });

    // Written metrics from sales table (used for tier qualification)
    const writtenMetrics: WrittenMetrics = {
      writtenItems: 6,
      writtenPremium: 20000,
      writtenPolicies: 6,
      writtenHouseholds: 4,
      writtenPoints: 6,
      policyTypeBreakdown: {
        "Auto": {
          writtenItems: 4,
          writtenPremium: 12000,
          writtenPolicies: 4,
          writtenHouseholds: 3,
          writtenPoints: 4,
          householdSaleIds: ["s1", "s2", "s3"],
        },
        "Homeowners": {
          writtenItems: 2,
          writtenPremium: 8000,
          writtenPolicies: 2,
          writtenHouseholds: 2,
          writtenPoints: 2,
          householdSaleIds: ["s2", "s4"],
        },
      },
    };

    const payout = calculateMemberPayout(
      convertToPerformance(metrics, "tm-1", "Test Producer", plan.chargeback_rule, periodMonth, periodYear, new Map()),
      plan,
      periodMonth,
      periodYear,
      { bonusAmount: 0, achievedPromos: [] },
      0,
      undefined,
      undefined,
      writtenMetrics,
    );

    // Tier qualification: 4 Auto items → tier-1 (0 threshold, 5%)
    // NOT tier-2 (requires 5 items) — the Home items are filtered out
    expect(payout.tierThresholdMet).toBe(0);
    expect(payout.tierCommissionValue).toBe(5);
    // Payout base is issued premium (all products): $20,000 * 5% = $1,000
    expect(payout.totalPayout).toBe(1000);
    // Snapshot should record the filtered metric value
    expect(payout.calculationSnapshot?.inputs.tierMetricValueUsed).toBe(4);
    expect(payout.calculationSnapshot?.inputs.tierQualificationSource).toBe("sales_table");
  });

  it("does NOT zero-out tier when filter matches no policy types in written metrics", () => {
    // Edge case: filter is ["Life"] but sales table has no Life policies.
    // Should still find tier-1 (threshold 0) with 0 items, not crash.
    const plan = makePlan({
      name: "Life-only Tier Plan",
      tier_metric: "items",
      tier_metric_source: "written",
      payout_type: "percent_of_premium",
      policy_type_filter: ["Life"],
      tiers: [
        { id: "tier-1", min_threshold: 0, commission_value: 3, sort_order: 0 },
        { id: "tier-2", min_threshold: 5, commission_value: 6, sort_order: 1 },
      ],
    });

    const metrics = makeMetrics({
      premiumWritten: 15000,
      netPremium: 15000,
    });

    const writtenMetrics: WrittenMetrics = {
      writtenItems: 8,
      writtenPremium: 15000,
      writtenPolicies: 8,
      writtenHouseholds: 5,
      writtenPoints: 8,
      policyTypeBreakdown: {
        "Auto": {
          writtenItems: 5,
          writtenPremium: 10000,
          writtenPolicies: 5,
          writtenHouseholds: 3,
          writtenPoints: 5,
          householdSaleIds: ["s1", "s2", "s3"],
        },
        "Homeowners": {
          writtenItems: 3,
          writtenPremium: 5000,
          writtenPolicies: 3,
          writtenHouseholds: 2,
          writtenPoints: 3,
          householdSaleIds: ["s2", "s4"],
        },
      },
    };

    const payout = calculateMemberPayout(
      convertToPerformance(metrics, "tm-1", "Test Producer", plan.chargeback_rule, periodMonth, periodYear, new Map()),
      plan,
      periodMonth,
      periodYear,
      { bonusAmount: 0, achievedPromos: [] },
      0,
      undefined,
      undefined,
      writtenMetrics,
    );

    // 0 Life items → tier-1 (threshold 0, 3%) — should not crash or skip
    expect(payout.tierThresholdMet).toBe(0);
    expect(payout.tierCommissionValue).toBe(3);
    // Payout base is still issued premium: $15,000 * 3% = $450
    expect(payout.totalPayout).toBe(450);
    expect(payout.calculationSnapshot?.inputs.tierMetricValueUsed).toBe(0);
  });

  it("filters household count by sale IDs when policy_type_filter is active", () => {
    // Regression: households must deduplicate by saleId, not sum per-policy-type counts.
    // Sale s2 appears in both Auto and Homeowners — it should count as 1 household, not 2.
    const plan = makePlan({
      name: "Household Tier Plan",
      tier_metric: "households",
      tier_metric_source: "written",
      payout_type: "flat_per_household",
      policy_type_filter: ["Auto", "Homeowners"],
      tiers: [
        { id: "tier-1", min_threshold: 0, commission_value: 50, sort_order: 0 },
        { id: "tier-2", min_threshold: 4, commission_value: 75, sort_order: 1 },
      ],
    });

    const metrics = makeMetrics({
      premiumWritten: 10000,
      netPremium: 10000,
      creditCount: 4,
    });

    const writtenMetrics: WrittenMetrics = {
      writtenItems: 6,
      writtenPremium: 20000,
      writtenPolicies: 6,
      writtenHouseholds: 4,
      writtenPoints: 6,
      policyTypeBreakdown: {
        "Auto": {
          writtenItems: 4,
          writtenPremium: 12000,
          writtenPolicies: 4,
          writtenHouseholds: 3, // fallback, should use saleIds instead
          writtenPoints: 4,
          householdSaleIds: ["s1", "s2", "s3"],
        },
        "Homeowners": {
          writtenItems: 2,
          writtenPremium: 8000,
          writtenPolicies: 2,
          writtenHouseholds: 2,
          writtenPoints: 2,
          householdSaleIds: ["s2", "s4"], // s2 overlaps with Auto
        },
      },
    };

    const payout = calculateMemberPayout(
      convertToPerformance(metrics, "tm-1", "Test Producer", plan.chargeback_rule, periodMonth, periodYear, new Map()),
      plan,
      periodMonth,
      periodYear,
      { bonusAmount: 0, achievedPromos: [] },
      0,
      undefined,
      undefined,
      writtenMetrics,
    );

    // Unique sale IDs across Auto + Homeowners: s1, s2, s3, s4 = 4 households
    // 4 >= 4 → tier-2 ($75/household)
    expect(payout.tierThresholdMet).toBe(4);
    expect(payout.tierCommissionValue).toBe(75);
    // Payout: 4 households * $75 = $300
    // (flat_per_household uses writtenHouseholds from the filtered written metrics)
    expect(payout.totalPayout).toBe(300);
  });
});

// ============================================================
// 5. persistPayoutSet overwrite protection (direct)
// ============================================================
describe("assertPeriodNotFinalized (persist guard)", () => {
  // Import the extracted guard function so we can test it with a controlled mock
  // without needing to render the React hook.
  let assertPeriodNotFinalized: typeof import("@/lib/payout-calculator/persist-guards").assertPeriodNotFinalized;

  beforeAll(async () => {
    const mod = await import("@/lib/payout-calculator/persist-guards");
    assertPeriodNotFinalized = mod.assertPeriodNotFinalized;
  });

  function buildMockClient(rows: Array<{ id: string; status: string }> | null, error: { message: string } | null = null) {
    // Build a chainable mock that matches the Supabase query pattern:
    // .from("comp_payouts").select("id, status").eq(...).eq(...).eq(...).in(...)
    const inFn = vi.fn(() => Promise.resolve({ data: rows, error }));
    const eq3 = vi.fn(() => ({ in: inFn }));
    const eq2 = vi.fn(() => ({ eq: eq3 }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const selectFn = vi.fn(() => ({ eq: eq1 }));
    const fromFn = vi.fn(() => ({ select: selectFn }));
    return { from: fromFn, _spies: { fromFn, selectFn, eq1, eq2, eq3, inFn } };
  }

  it("throws when finalized rows exist for the period", async () => {
    const client = buildMockClient([
      { id: "payout-1", status: "finalized" },
      { id: "payout-2", status: "finalized" },
    ]);

    await expect(
      assertPeriodNotFinalized(client, "agency-1", 3, 2026)
    ).rejects.toThrow("This period already has finalized payouts and cannot be overwritten.");
  });

  it("throws when paid rows exist for the period", async () => {
    const client = buildMockClient([
      { id: "payout-1", status: "paid" },
    ]);

    await expect(
      assertPeriodNotFinalized(client, "agency-1", 3, 2026)
    ).rejects.toThrow("This period already has paid payouts and cannot be overwritten.");
  });

  it("passes through when only draft rows exist (empty result from finalized/paid filter)", async () => {
    const client = buildMockClient([]);

    // Should not throw
    await expect(
      assertPeriodNotFinalized(client, "agency-1", 3, 2026)
    ).resolves.toBeUndefined();
  });

  it("passes through when no rows exist at all", async () => {
    const client = buildMockClient(null);

    await expect(
      assertPeriodNotFinalized(client, "agency-1", 3, 2026)
    ).resolves.toBeUndefined();
  });

  it("throws when the Supabase query itself errors", async () => {
    const client = buildMockClient(null, { message: "connection refused" });

    await expect(
      assertPeriodNotFinalized(client, "agency-1", 3, 2026)
    ).rejects.toThrow("Failed to check existing payouts: connection refused");
  });

  it("queries the correct table, columns, and filters", async () => {
    const client = buildMockClient([]);
    await assertPeriodNotFinalized(client, "agency-1", 2, 2026);

    expect(client._spies.fromFn).toHaveBeenCalledWith("comp_payouts");
    expect(client._spies.selectFn).toHaveBeenCalledWith("id, status");
    expect(client._spies.eq1).toHaveBeenCalledWith("agency_id", "agency-1");
    expect(client._spies.eq2).toHaveBeenCalledWith("period_month", 2);
    expect(client._spies.eq3).toHaveBeenCalledWith("period_year", 2026);
    expect(client._spies.inFn).toHaveBeenCalledWith("status", ["finalized", "paid"]);
  });
});

// ============================================================
// 6. Sheila end-to-end regression
// ============================================================
// Scenario: Producer "Sheila" has a plan with:
//   - tier_metric_source = 'written' (tiers from sales table)
//   - tier_metric = 'items'
//   - policy_type_filter = ['Auto'] (only Auto items count for tier)
//   - bundle_configs for commission (monoline/standard/preferred rates)
//   - 3-month chargeback rule
// She has 8 Auto + 3 Homeowners items in the sales table,
// but only Auto should qualify her tier.
// Commission is calculated on the FULL issued statement (all products),
// split by bundle type using bundle_configs.
// This tests the exact path that previously regressed:
// sales-table written metrics → policy_type_filter → tier qualification
// → bundle_configs commission on full statement data.
describe("Sheila end-to-end regression", () => {
  it("qualifies tier on filtered Auto items from sales table, pays commission on full issued statement via bundle_configs", () => {
    const plan = makePlan({
      name: "Sheila's Comp Plan",
      tier_metric: "items",
      tier_metric_source: "written",
      payout_type: "flat_per_item", // base payout type (overridden by bundle_configs)
      policy_type_filter: ["Auto"],
      chargeback_rule: "three_month",
      tiers: [
        { id: "tier-1", min_threshold: 0, commission_value: 10, sort_order: 0 },
        { id: "tier-2", min_threshold: 5, commission_value: 15, sort_order: 1 },
        { id: "tier-3", min_threshold: 10, commission_value: 20, sort_order: 2 },
      ],
      bundle_configs: {
        monoline: { enabled: true, payout_type: "flat_per_item", rate: 8 },
        standard: { enabled: true, payout_type: "flat_per_item", rate: 18 },
        preferred: { enabled: true, payout_type: "flat_per_item", rate: 25 },
      },
    });

    // Statement data: Sheila's Allstate statement for the month
    // Has both Auto and Homeowners production across bundle types
    const metrics = makeMetrics({
      premiumWritten: 35000,
      premiumChargebacks: 800,
      netPremium: 34200,
      itemsIssued: 11,
      policiesIssued: 8,
      creditCount: 8,
      chargebackTransactions: [
        // One chargeback within 3-month window (included)
        makeTransaction({
          policyNumber: "CB-SHEILA-1",
          product: "Standard Auto",
          premium: -800,
          origPolicyEffDate: "01/2026", // ~2 months before March 2026
          transType: "Cancellation Of New Issued Transaction - First Term",
          bundleType: "standard",
        }),
      ],
      byBundleType: [
        {
          bundleType: "monoline",
          premiumWritten: 5000,
          premiumChargebacks: 0,
          netPremium: 5000,
          itemsIssued: 2,
          creditCount: 2,
          chargebackCount: 0,
        },
        {
          bundleType: "standard",
          premiumWritten: 18000,
          premiumChargebacks: 800,
          netPremium: 17200,
          itemsIssued: 5,
          creditCount: 5,
          chargebackCount: 1,
        },
        {
          bundleType: "preferred",
          premiumWritten: 12000,
          premiumChargebacks: 0,
          netPremium: 12000,
          itemsIssued: 4,
          creditCount: 4,
          chargebackCount: 0,
        },
      ],
      byProduct: [
        {
          product: "Standard Auto",
          premiumWritten: 22000,
          premiumChargebacks: 800,
          netPremium: 21200,
          itemsIssued: 7,
          creditCount: 6,
          chargebackCount: 1,
        },
        {
          product: "Homeowners",
          premiumWritten: 13000,
          premiumChargebacks: 0,
          netPremium: 13000,
          itemsIssued: 4,
          creditCount: 4,
          chargebackCount: 0,
        },
      ],
    });

    // Sales table data: Sheila's manual sales entries (for tier qualification)
    const writtenMetrics: WrittenMetrics = {
      writtenItems: 11,
      writtenPremium: 35000,
      writtenPolicies: 8,
      writtenHouseholds: 6,
      writtenPoints: 11,
      policyTypeBreakdown: {
        "Auto": {
          writtenItems: 8,
          writtenPremium: 22000,
          writtenPolicies: 5,
          writtenHouseholds: 4,
          writtenPoints: 8,
          householdSaleIds: ["s1", "s2", "s3", "s4"],
        },
        "Homeowners": {
          writtenItems: 3,
          writtenPremium: 13000,
          writtenPolicies: 3,
          writtenHouseholds: 3,
          writtenPoints: 3,
          householdSaleIds: ["s2", "s5", "s6"],
        },
      },
    };

    const performance = convertToPerformance(
      metrics, "tm-sheila", "Sheila",
      plan.chargeback_rule, periodMonth, periodYear,
      new Map([["standard auto", 6], ["homeowners", 12]])
    );

    const payout = calculateMemberPayout(
      performance,
      plan,
      periodMonth,
      periodYear,
      { bonusAmount: 0, achievedPromos: [] },
      0,           // selfGenItems
      undefined,   // selfGenMetrics
      undefined,   // brokeredMetrics
      writtenMetrics,
    );

    // === TIER QUALIFICATION ===
    // Filter: only "Auto" items from sales table → 8 items
    // 8 >= 5 → tier-2 ($15/item)
    // NOT tier-3 (requires 10) — the 3 Homeowners items are excluded
    expect(payout.calculationSnapshot?.inputs.tierQualificationSource).toBe("sales_table");
    expect(payout.calculationSnapshot?.inputs.tierMetricValueUsed).toBe(8);
    expect(payout.tierThresholdMet).toBe(5);
    expect(payout.tierCommissionValue).toBe(15);

    // === COMMISSION CALCULATION (bundle_configs on full statement) ===
    // Chargebacks: 1 chargeback at $800, origPolicyEffDate 01/2026
    // Statement month: March 2026. Days in force: ~59 days. < 90 → eligible.
    expect(payout.eligibleChargebackCount).toBe(1);
    expect(payout.eligibleChargebackPremium).toBe(800);

    // Bundle commission (using bundle_configs rates, NOT tier rate):
    //   monoline: 2 items * $8 = $16
    //   standard: 5 items * $18 = $90 (chargeback handled at bundle level via ratio)
    //     - but chargebackByBundle standard has 1 eligible, ratio = 1/1 = 1.0
    //     - effective items = max(0, 5 - round(1 * 1.0)) = 4
    //     - commission = 4 * $18 = $72
    //   preferred: 4 items * $25 = $100
    // Total: $16 + $72 + $100 = $188
    expect(payout.commissionByBundleType).toBeDefined();
    expect(payout.commissionByBundleType!.length).toBe(3);

    // Verify monoline
    const monolineEntry = payout.commissionByBundleType!.find(b => b.bundleType === "monoline");
    expect(monolineEntry).toBeDefined();
    expect(monolineEntry!.commission).toBe(16);

    // Verify preferred
    const preferredEntry = payout.commissionByBundleType!.find(b => b.bundleType === "preferred");
    expect(preferredEntry).toBeDefined();
    expect(preferredEntry!.commission).toBe(100);

    // Verify standard (chargeback-adjusted)
    const standardEntry = payout.commissionByBundleType!.find(b => b.bundleType === "standard");
    expect(standardEntry).toBeDefined();
    // Standard has 1 chargeback eligible out of 1 total → ratio = 1
    // effective items = max(0, 5 - round(1 * 1)) = 4
    expect(standardEntry!.items).toBe(4);
    expect(standardEntry!.commission).toBe(72);

    // Total commission: 16 + 72 + 100 = 188
    expect(payout.baseCommission).toBe(188);
    expect(payout.totalPayout).toBe(188);

    // === WRITTEN vs ISSUED SEPARATION ===
    // Written metrics on the payout store the FULL unfiltered sales table data
    // (the filter only narrows the tier qualification metric, stored in snapshot)
    expect(payout.writtenItems).toBe(11);  // Full sales table (all products)
    expect(payout.writtenPremium).toBe(35000);  // Full sales table
    // Issued metrics reflect full statement data
    expect(payout.issuedPremium).toBe(35000);  // Full statement
    expect(payout.issuedItems).toBe(11);  // Full statement
    // The FILTERED metric value (8 Auto items) is recorded in the snapshot
    expect(payout.calculationSnapshot?.inputs.tierMetricValueUsed).toBe(8);

    // === AUDIT TRAIL ===
    expect(payout.calculationSnapshot).toBeDefined();
    expect(payout.calculationSnapshot!.inputs.tierMetric).toBe("items");
    expect(payout.calculationSnapshot!.inputs.tierMetricSource).toBe("written");
    expect(payout.calculationSnapshot!.calculations.finalTotal).toBe(188);
    expect(payout.chargebackRule).toBe("three_month");
    expect(payout.status).toBe("draft");
  });
});
