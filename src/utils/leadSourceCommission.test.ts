import { describe, it, expect } from "vitest";
import { normalizeCommissionRate, computeEstimatedCommissionPerRow, computeTotals, LeadSourceExtended } from "./leadSourceCommission";

describe("normalizeCommissionRate", () => {
  it("handles undefined, empty, and invalid", () => {
    expect(normalizeCommissionRate()).toBeUndefined();
    expect(normalizeCommissionRate("")).toBeUndefined();
    expect(normalizeCommissionRate("abc")).toBeUndefined();
  });

  it("normalizes percent and decimal inputs", () => {
    expect(normalizeCommissionRate(0.12)).toBeCloseTo(0.12);
    expect(normalizeCommissionRate("0.12")).toBeCloseTo(0.12);
    expect(normalizeCommissionRate(12)).toBeCloseTo(0.12);
    expect(normalizeCommissionRate("12%" as any)).toBeCloseTo(0.12);
  });

  it("clamps to [0,1]", () => {
    expect(normalizeCommissionRate(-5)).toBe(0);
    expect(normalizeCommissionRate(120)).toBe(1);
    expect(normalizeCommissionRate(1.5)).toBe(1);
  });
});

describe("computeEstimatedCommissionPerRow", () => {
  it("computes soldPremium * commissionRate and rounds to 2 decimals", () => {
    expect(computeEstimatedCommissionPerRow({ soldPremium: 14500, commissionRate: 0.12 })).toBe(1740);
    expect(computeEstimatedCommissionPerRow({ soldPremium: 0, commissionRate: 0.2 })).toBe(0);
    expect(computeEstimatedCommissionPerRow({ soldPremium: undefined, commissionRate: 0.2 })).toBe(0);
    expect(computeEstimatedCommissionPerRow({ soldPremium: 100, commissionRate: undefined })).toBe(0);
  });
});

describe("computeTotals", () => {
  it("sums revenue and estimated commission across lead sources", () => {
    const leadSources: LeadSourceExtended[] = [
      { name: "A", spend: 1000, soldPremium: 10000, commissionRate: 0.1 }, // 1000
      { name: "B", spend: 2000, soldPremium: 5000, commissionRate: 0.12 }, // 600
      { name: "C", spend: 500, soldPremium: undefined, commissionRate: 0.2 }, // 0
    ];
    const totals = computeTotals(leadSources);
    expect(totals.totalRevenueFromLeadSources).toBe(15000);
    expect(totals.totalEstimatedCommission).toBe(1600);
  });

  it("handles blanks, zeros, and deletion scenarios", () => {
    const leadSources: LeadSourceExtended[] = [
      { name: "A", spend: 1000 },
    ];
    const totals = computeTotals(leadSources);
    expect(totals.totalRevenueFromLeadSources).toBe(0);
    expect(totals.totalEstimatedCommission).toBe(0);
  });
});
