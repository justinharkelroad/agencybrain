import { describe, it, expect } from "vitest";
import { computeMetrics, DEFAULT_INPUTS, MarketingInputs, clampPercent } from "./marketingCalculator";

describe("marketingCalculator - acceptance test", () => {
  it("calculates derived values from placeholders", () => {
    const inputs: MarketingInputs = { ...DEFAULT_INPUTS };
    const d = computeMetrics(inputs);

    expect(d.totalLeads).toBe(1111); // round(10000/9)
    expect(d.quotedHH).toBe(44); // round(1111 * 0.04)
    expect(d.costPerQuotedHH).toBeDefined();
    expect(d!.costPerQuotedHH!).toBeCloseTo(227.27, 2); // 10000/44
    expect(d.closedHH).toBe(7); // round(44 * 0.15)
    expect(d.soldItems).toBe(15); // round(7 * 2.1)
    expect(d.soldPremium).toBe(14805); // 15 * 987
    expect(d.totalComp).toBeCloseTo(3257.10, 2); // 14805 * 0.22
  });
});

describe("marketingCalculator - edge cases", () => {
  it("clamps percents to 0-100", () => {
    const inputs: MarketingInputs = {
      ...DEFAULT_INPUTS,
      quoteRatePct: 150,
      closeRatePct: -10,
      commissionPct: 500,
    };
    const d = computeMetrics(inputs);
    // effectively uses 100%, 0%, 100%
    expect(d.quotedHH).toBe(1111); // 100% of total leads
    expect(d.closedHH).toBe(0); // 0% close rate
    // commission 100% => total comp equals soldPremium
    expect(d.totalComp).toBe(d.soldPremium);
  });

  it("handles negative and zero inputs safely", () => {
    const inputs: MarketingInputs = {
      leadSource: "Test",
      spend: -100, // clamps to 0
      cpl: 0, // zero CPL => totalLeads 0
      quoteRatePct: 50,
      closeRatePct: 50,
      avgItemValue: -10, // clamps to 0 in math
      avgItemsPerHH: -3, // clamps to 0 in math
      commissionPct: 50,
    };
    const d = computeMetrics(inputs);
    expect(d.totalLeads).toBe(0);
    expect(d.quotedHH).toBe(0);
    expect(d.costPerQuotedHH).toBeNull();
    expect(d.closedHH).toBe(0);
    expect(d.soldItems).toBe(0);
    expect(d.soldPremium).toBe(0);
    expect(d.totalComp).toBe(0);
  });

  it("rounds .5 up for counts", () => {
    const inputs: MarketingInputs = {
      ...DEFAULT_INPUTS,
      spend: 5,
      cpl: 1.1, // 4.545... -> rounds to 5
      quoteRatePct: 11, // 5 * 0.11 = 0.55 -> rounds to 1
      closeRatePct: 50, // 1 * 0.5 = 0.5 -> rounds to 1
      avgItemsPerHH: 1.5, // 1 * 1.5 = 1.5 -> rounds to 2
      avgItemValue: 1,
      commissionPct: 0,
    };
    const d = computeMetrics(inputs);
    expect(d.totalLeads).toBe(5);
    expect(d.quotedHH).toBe(1);
    expect(d.closedHH).toBe(1);
    expect(d.soldItems).toBe(2);
  });
});
