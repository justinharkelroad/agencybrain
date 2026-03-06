import { describe, expect, it } from "vitest";

import { analyzeSubProducers } from "@/lib/allstate-analyzer/sub-producer-analyzer";
import type { StatementTransaction } from "@/lib/allstate-parser/excel-parser";

function makeTransaction(overrides: Partial<StatementTransaction>): StatementTransaction {
  return {
    rowNumber: 1,
    policyNumber: "P-1",
    namedInsured: "Test Insured",
    product: "Standard Auto",
    transType: "Coverage Issued",
    businessType: "New Business",
    policyBundleType: "Preferred",
    writtenPremium: 1000,
    commissionablePremium: 1000,
    baseCommissionRate: 0.1,
    baseCommissionAmount: 100,
    vcRate: 0,
    vcAmount: 0,
    totalCommission: 100,
    effectiveRate: 0.1,
    channel: "Agency",
    serviceFeeAssignedDate: "",
    origPolicyEffDate: "10/2025",
    indicator: "",
    subProdCode: "515",
    ...overrides,
  };
}

describe("chargeback reinstatement handling", () => {
  it("captures standalone first-term reinstatements for later add-back", () => {
    const result = analyzeSubProducers([
      makeTransaction({
        transType: "Reinstatement Of New Issued Transaction - First Term",
        writtenPremium: 750,
        totalCommission: 75,
      }),
    ], new Date(2025, 11, 1));

    expect(result.totals.reinstatementCount).toBe(1);
    expect(result.totals.reinstatementPremium).toBe(750);
    expect(result.producers[0].reinstatementCount).toBe(1);
    expect(result.producers[0].reinstatementPremium).toBe(750);
  });

  it("does not separately add reinstatements that net to zero in the same month", () => {
    const result = analyzeSubProducers([
      makeTransaction({
        transType: "Cancellation Of New Issued Transaction - First Term",
        writtenPremium: -750,
        totalCommission: -75,
      }),
      makeTransaction({
        transType: "Reinstatement Of New Issued Transaction - First Term",
        writtenPremium: 750,
        totalCommission: 75,
      }),
    ], new Date(2025, 11, 1));

    expect(result.totals.reinstatementCount).toBe(0);
    expect(result.totals.reinstatementPremium).toBe(0);
    expect(result.totals.premiumChargebacks).toBe(0);
  });

  it("ignores first-renewal reinstatements for first-term give-backs", () => {
    const result = analyzeSubProducers([
      makeTransaction({
        businessType: "First Renewal",
        transType: "Reinstatement - First Renewal Term",
        writtenPremium: 825,
        totalCommission: 82.5,
      }),
    ], new Date(2025, 11, 1));

    expect(result.totals.reinstatementCount).toBe(0);
    expect(result.totals.reinstatementPremium).toBe(0);
  });
});
