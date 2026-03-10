// @vitest-environment node

import { describe, expect, it } from "vitest";

import { calculateMemberPayout, convertToPerformance } from "@/lib/payout-calculator/calculator";
import {
  makeMetrics,
  makePlan,
  makeSelfGenMetrics,
  makeTransaction,
} from "@/tests/fixtures/comp-fixtures";

describe("comp fixture suite", () => {
  const periodMonth = 3;
  const periodYear = 2026;

  it("calculates a standard tiered premium plan from committed fixtures", () => {
    const plan = makePlan({
      name: "Standard Tier Plan",
      payout_type: "percent_of_premium",
      chargeback_rule: "none",
    });
    const metrics = makeMetrics({
      premiumWritten: 15000,
      netPremium: 15000,
      commissionEarned: 1500,
      netCommission: 1500,
      byBundleType: [{
        bundleType: "standard",
        premiumWritten: 15000,
        premiumChargebacks: 0,
        netPremium: 15000,
        itemsIssued: 3,
        creditCount: 3,
        chargebackCount: 0,
      }],
      byProduct: [{
        product: "Standard Auto",
        premiumWritten: 15000,
        premiumChargebacks: 0,
        netPremium: 15000,
        itemsIssued: 3,
        creditCount: 3,
        chargebackCount: 0,
      }],
      itemsIssued: 3,
      policiesIssued: 3,
      creditCount: 3,
    });

    const payout = calculateMemberPayout(
      convertToPerformance(metrics, "tm-1", "Fixture Producer", plan.chargeback_rule, periodMonth, periodYear, new Map()),
      plan,
      periodMonth,
      periodYear
    );

    expect(payout.tierThresholdMet).toBe(10000);
    expect(payout.tierCommissionValue).toBe(7);
    expect(payout.totalPayout).toBe(1050);
  });

  it("calculates bundle-config plans using canonical bundle segments", () => {
    const plan = makePlan({
      name: "Bundle Config Plan",
      bundle_configs: {
        monoline: { enabled: false, payout_type: "flat_per_item", rate: 5 },
        standard: { enabled: true, payout_type: "flat_per_item", rate: 20 },
        preferred: { enabled: true, payout_type: "percent_of_premium", rate: 10 },
      },
    });
    const metrics = makeMetrics({
      premiumWritten: 7000,
      netPremium: 7000,
      itemsIssued: 3,
      policiesIssued: 3,
      creditCount: 3,
      byBundleType: [
        {
          bundleType: "standard",
          premiumWritten: 4000,
          premiumChargebacks: 0,
          netPremium: 4000,
          itemsIssued: 2,
          creditCount: 2,
          chargebackCount: 0,
        },
        {
          bundleType: "preferred",
          premiumWritten: 3000,
          premiumChargebacks: 0,
          netPremium: 3000,
          itemsIssued: 1,
          creditCount: 1,
          chargebackCount: 0,
        },
      ],
    });

    const payout = calculateMemberPayout(
      convertToPerformance(metrics, "tm-1", "Fixture Producer", plan.chargeback_rule, periodMonth, periodYear, new Map()),
      plan,
      periodMonth,
      periodYear
    );

    expect(payout.totalPayout).toBe(340);
    expect(payout.commissionByBundleType).toEqual([
      { bundleType: "standard", premium: 4000, items: 2, commission: 40 },
      { bundleType: "preferred", premium: 3000, items: 1, commission: 300 },
    ]);
  });

  it("calculates product-rate plans from committed product fixtures", () => {
    const plan = makePlan({
      name: "Product Rate Plan",
      product_rates: {
        "Standard Auto": { payout_type: "flat_per_item", rate: 15 },
        Homeowners: { payout_type: "percent_of_premium", rate: 12 },
      },
    });
    const metrics = makeMetrics({
      premiumWritten: 5000,
      netPremium: 5000,
      itemsIssued: 3,
      policiesIssued: 3,
      creditCount: 3,
      byProduct: [
        {
          product: "Standard Auto",
          premiumWritten: 2000,
          premiumChargebacks: 0,
          netPremium: 2000,
          itemsIssued: 2,
          creditCount: 2,
          chargebackCount: 0,
        },
        {
          product: "Homeowners",
          premiumWritten: 3000,
          premiumChargebacks: 0,
          netPremium: 3000,
          itemsIssued: 1,
          creditCount: 1,
          chargebackCount: 0,
        },
      ],
    });

    const payout = calculateMemberPayout(
      convertToPerformance(metrics, "tm-1", "Fixture Producer", plan.chargeback_rule, periodMonth, periodYear, new Map()),
      plan,
      periodMonth,
      periodYear
    );

    expect(payout.totalPayout).toBe(390);
    expect(payout.commissionByProduct).toEqual([
      { product: "Standard Auto", premium: 2000, items: 2, commission: 30 },
      { product: "Homeowners", premium: 3000, items: 1, commission: 360 },
    ]);
  });

  it("applies self-gen bonus rules from committed fixture inputs", () => {
    const plan = makePlan({
      name: "Self-Gen Plan",
      tiers: [{ id: "tier-1", min_threshold: 0, commission_value: 10, sort_order: 0 }],
      commission_modifiers: {
        self_gen_bonus: {
          enabled: true,
          min_percent: 40,
          bonus_type: "percent_boost",
          bonus_value: 10,
        },
      },
    });
    const metrics = makeMetrics();
    const selfGenMetrics = makeSelfGenMetrics();

    const payout = calculateMemberPayout(
      convertToPerformance(metrics, "tm-1", "Fixture Producer", plan.chargeback_rule, periodMonth, periodYear, new Map()),
      plan,
      periodMonth,
      periodYear,
      { bonusAmount: 0, achievedPromos: [] },
      selfGenMetrics.selfGenItems,
      selfGenMetrics
    );

    expect(payout.baseCommission).toBe(1000);
    expect(payout.selfGenPercent).toBe(60);
    expect(payout.selfGenBonusAmount).toBe(100);
    expect(payout.totalPayout).toBe(1100);
  });

  it("filters chargeback edge cases with committed transaction fixtures", () => {
    const plan = makePlan({
      name: "Chargeback Fixture Plan",
      chargeback_rule: "full",
      tiers: [{ id: "tier-1", min_threshold: 0, commission_value: 10, sort_order: 0 }],
    });
    const metrics = makeMetrics({
      premiumWritten: 10000,
      premiumChargebacks: 900,
      netPremium: 9100,
      commissionEarned: 1000,
      commissionChargebacks: 90,
      netCommission: 910,
      chargebackTransactions: [
        makeTransaction({
          policyNumber: "CB-IN",
          product: "Standard Auto",
          premium: -500,
          origPolicyEffDate: "10/2025",
          transType: "Cancellation Of New Issued Transaction - First Term",
          bundleType: "standard",
        }),
        makeTransaction({
          policyNumber: "CB-OUT",
          product: "Standard Auto",
          premium: -300,
          origPolicyEffDate: "01/2025",
          transType: "Cancellation Of New Issued Transaction - First Term",
          bundleType: "standard",
        }),
        makeTransaction({
          policyNumber: "MC-1",
          product: "Motor Club",
          premium: -100,
          origPolicyEffDate: "10/2025",
          transType: "Cancellation Of New Issued Transaction - First Term",
          isAuto: false,
          bundleType: "monoline",
        }),
        makeTransaction({
          policyNumber: "REIN-1",
          product: "Standard Auto",
          premium: 250,
          commission: 25,
          origPolicyEffDate: "10/2025",
          transType: "Reinstatement Of New Issued Transaction - First Term",
          bundleType: "standard",
        }),
      ],
      byBundleType: [{
        bundleType: "standard",
        premiumWritten: 10000,
        premiumChargebacks: 900,
        netPremium: 9100,
        itemsIssued: 5,
        creditCount: 5,
        chargebackCount: 4,
      }],
      byProduct: [
        {
          product: "Standard Auto",
          premiumWritten: 10000,
          premiumChargebacks: 800,
          netPremium: 9200,
          itemsIssued: 5,
          creditCount: 5,
          chargebackCount: 3,
        },
        {
          product: "Motor Club",
          premiumWritten: 0,
          premiumChargebacks: 100,
          netPremium: -100,
          itemsIssued: 0,
          creditCount: 0,
          chargebackCount: 1,
        },
      ],
    });

    const payout = calculateMemberPayout(
      convertToPerformance(
        metrics,
        "tm-1",
        "Fixture Producer",
        plan.chargeback_rule,
        periodMonth,
        periodYear,
        new Map([
          ["standard auto", 6],
          ["motor club", 12],
        ])
      ),
      plan,
      periodMonth,
      periodYear
    );

    expect(payout.eligibleChargebackPremium).toBe(500);
    expect(payout.eligibleChargebackCount).toBe(1);
    expect(payout.excludedChargebackCount).toBe(3);
    expect(payout.totalPayout).toBe(950);
    expect(payout.chargebackDetails?.map((detail) => ({
      policyNumber: detail.policyNumber,
      classification: detail.classification,
      included: detail.included,
    }))).toEqual([
      { policyNumber: "CB-IN", classification: "cancellation_of_new_issue", included: true },
      { policyNumber: "CB-OUT", classification: "cancellation_of_new_issue", included: false },
      { policyNumber: "MC-1", classification: "excluded_product", included: false },
      { policyNumber: "REIN-1", classification: "reinstatement", included: false },
    ]);
  });

  it("persists manual written tier metrics without changing issued payout production", () => {
    const plan = makePlan({
      name: "Manual Written Fixture Plan",
      tier_metric: "premium",
      tier_metric_source: "written",
    });
    const metrics = makeMetrics({
      premiumWritten: 10000,
      netPremium: 10000,
      commissionEarned: 1000,
      netCommission: 1000,
      itemsIssued: 2,
      policiesIssued: 2,
      creditCount: 2,
    });

    const payout = calculateMemberPayout(
      convertToPerformance(metrics, "tm-1", "Fixture Producer", plan.chargeback_rule, periodMonth, periodYear, new Map()),
      plan,
      periodMonth,
      periodYear,
      { bonusAmount: 0, achievedPromos: [] },
      0,
      undefined,
      undefined,
      {
        writtenItems: 6,
        writtenPremium: 25000,
        writtenPolicies: 4,
        writtenHouseholds: 3,
        writtenPoints: 6,
      },
      undefined,
      {
        source: "manual_override",
        manualWrittenMetrics: {
          writtenItems: 6,
          writtenPremium: 25000,
          writtenPolicies: 4,
          writtenHouseholds: 3,
          writtenPoints: 6,
        },
      }
    );

    expect(payout.tierThresholdMet).toBe(20000);
    expect(payout.tierCommissionValue).toBe(10);
    expect(payout.writtenPremium).toBe(25000);
    expect(payout.writtenItems).toBe(6);
    expect(payout.issuedPremium).toBe(10000);
    expect(payout.calculationSnapshot?.inputs.tierQualificationSource).toBe("manual_override");
    expect(payout.calculationSnapshot?.manualWrittenMetrics?.writtenPremium).toBe(25000);
  });
});
