import { describe, expect, it } from "vitest";

import { inferBundleTypes, type NewBusinessRecord } from "@/lib/new-business-details-parser";

function makeRecord(overrides: Partial<NewBusinessRecord>): NewBusinessRecord {
  return {
    agentNumber: "A1",
    subProducerCode: "515",
    subProducerName: "Test Producer",
    bindId: null,
    bindIdName: null,
    policyNumber: "P-1",
    customerName: "Jane Doe",
    firstName: "Jane",
    lastName: "Doe",
    issuedDate: "2026-03-01",
    dateWritten: "2026-03-01",
    product: "Standard Auto",
    lineGroup: "Auto",
    productDescription: "Standard Auto",
    packageType: null,
    transactionType: "New Business",
    itemCount: 1,
    writtenPremium: 1000,
    dispositionCode: "New Policy",
    rowNumber: 1,
    isChargeback: false,
    chargebackReason: null,
    ...overrides,
  };
}

describe("new business bundle parity", () => {
  it("classifies standard auto plus homeowners as preferred", () => {
    const result = inferBundleTypes([
      makeRecord({ policyNumber: "AUTO-1", product: "Standard Auto" }),
      makeRecord({ policyNumber: "HOME-1", product: "Homeowners" }),
    ]);

    expect(result.get("AUTO-1")).toBe("preferred");
    expect(result.get("HOME-1")).toBe("preferred");
  });

  it("does not treat specialty auto as the preferred auto anchor", () => {
    const result = inferBundleTypes([
      makeRecord({ policyNumber: "SPEC-1", product: "Specialty Auto" }),
      makeRecord({ policyNumber: "HOME-1", product: "Homeowners" }),
    ]);

    expect(result.get("SPEC-1")).toBe("standard");
    expect(result.get("HOME-1")).toBe("standard");
  });

  it("counts umbrella with auto as standard", () => {
    const result = inferBundleTypes([
      makeRecord({ policyNumber: "AUTO-1", product: "Standard Auto" }),
      makeRecord({ policyNumber: "UMB-1", product: "Personal Umbrella" }),
    ]);

    expect(result.get("AUTO-1")).toBe("standard");
    expect(result.get("UMB-1")).toBe("standard");
  });

  it("excludes motor club from bundle recognition", () => {
    const result = inferBundleTypes([
      makeRecord({ policyNumber: "AUTO-1", product: "Standard Auto" }),
      makeRecord({ policyNumber: "MC-1", product: "Motor Club" }),
    ]);

    expect(result.get("AUTO-1")).toBe("monoline");
    expect(result.get("MC-1")).toBe("monoline");
  });
});
