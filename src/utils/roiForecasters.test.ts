import { describe, it, expect } from "vitest";
import {
  DEFAULT_INPUTS,
  computeMetrics,
  MailerInputs,
  computeMailerMetrics,
  TransferInputs,
  computeTransferMetrics,
} from "./marketingCalculator";

describe("roi forecasters - acceptance", () => {
  it("data lead forecaster matches known sample", () => {
    const d = computeMetrics(DEFAULT_INPUTS);
    expect(d.totalLeads).toBe(1111);
    expect(d.quotedHH).toBe(44);
    expect(d.closedHH).toBe(7);
    expect(d.soldItems).toBe(15);
    expect(d.soldPremium).toBe(14805);
  });

  it("mailer forecaster computes derived chain", () => {
    const inputs: MailerInputs = {
      mailSource: "Test Mail",
      spend: 5000,
      costPerPiece: 0.5,
      responseRatePct: 2, // 2%
      quotedPctOfInboundPct: 60, // 60% of calls quoted
      closeRatePct: 25, // 25% close
      avgItemsPerHH: 2,
      avgItemValue: 1000,
      commissionPct: 20,
    };
    const d = computeMailerMetrics(inputs);
    // total mailers = 10000
    expect(d.totalMailersSent).toBe(10000);
    // inbound calls = 200
    expect(d.inboundCalls).toBe(200);
    // quoted = 120
    expect(d.quotedHH).toBe(120);
    // cost per quoted hh = 5000 / 120 = 41.666...
    expect(d.costPerQuotedHH).toBeCloseTo(41.6667, 4);
    // closed = 30
    expect(d.closedHH).toBe(30);
    // sold items = 60
    expect(d.soldItems).toBe(60);
    // sold premium = 60000
    expect(d.soldPremium).toBe(60000);
    // total comp = 12000
    expect(d.totalComp).toBe(12000);
  });

  it("live transfer forecaster computes derived chain", () => {
    const inputs: TransferInputs = {
      liveTransferSource: "Vendor",
      spend: 4500,
      costPerTransfer: 50, // 90 transfers
      quotedPctOfInboundPct: 80, // 72 quoted
      closeRatePct: 25, // 18 closed
      avgItemsPerHH: 1.5, // 27 items -> rounds to 27
      avgItemValue: 900, // 24300 premium
      commissionPct: 22, // 5346 comp
    };
    const d = computeTransferMetrics(inputs);
    expect(d.totalTransfers).toBe(90);
    expect(d.quotedHH).toBe(72);
    expect(d.costPerQuotedHH).toBeCloseTo(62.5, 2);
    expect(d.closedHH).toBe(18);
    expect(d.soldItems).toBe(27);
    expect(d.soldPremium).toBe(24300);
    expect(d.totalComp).toBeCloseTo(5346, 2);
  });
});
