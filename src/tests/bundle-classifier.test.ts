import { describe, expect, it } from "vitest";
import { classifyBundle } from "@/lib/bundle-classifier";

describe("bundle-classifier", () => {
  it("classifies preferred only for standard auto + homeowners/condo", () => {
    const result = classifyBundle({
      productNames: ["Standard Auto", "Homeowners"],
    });
    expect(result.bundleType).toBe("Preferred");
    expect(result.isBundle).toBe(true);
  });

  it("classifies auto + renters as standard (not preferred)", () => {
    const result = classifyBundle({
      productNames: ["Standard Auto", "Renters"],
    });
    expect(result.bundleType).toBe("Standard");
    expect(result.isBundle).toBe(true);
  });

  it("classifies single product as monoline", () => {
    const result = classifyBundle({
      productNames: ["Homeowners"],
    });
    expect(result.bundleType).toBe("Monoline");
    expect(result.isBundle).toBe(false);
  });

  it("excludes motor club from bundle recognition", () => {
    const result = classifyBundle({
      productNames: ["Motor Club", "Standard Auto"],
    });
    expect(result.bundleType).toBe("Monoline");
    expect(result.recognizedProductCount).toBe(1);
  });

  it("supports existing-product flags for cross-sell context", () => {
    const result = classifyBundle({
      productNames: ["Standard Auto"],
      existingProducts: ["renters"],
    });
    expect(result.bundleType).toBe("Standard");
    expect(result.isBundle).toBe(true);
  });

  it("maps line-code products correctly", () => {
    const result = classifyBundle({
      productNames: [
        "010 - Auto - Private Passenger Voluntary",
        "070 - Homeowners",
      ],
    });
    expect(result.bundleType).toBe("Preferred");
  });

  it("ignores unrecognized products for bundle classification", () => {
    const result = classifyBundle({
      productNames: ["Totally Unknown Product", "Another Unknown Product"],
    });
    expect(result.bundleType).toBe("Monoline");
    expect(result.recognizedProductCount).toBe(0);
  });
});
