import { describe, expect, it } from "vitest";

import { buildCustomerBundleMap } from "@/lib/sales-bundle-classification";

describe("sales-bundle-classification", () => {
  it("uses canonical product names linked from policy types", () => {
    const bundleMap = buildCustomerBundleMap(
      [
        {
          customer_name: "Kamau Kimaru",
          customer_zip: "46032",
          sale_policies: [
            { product_type_id: "home-policy", policy_type_name: "Home Insurance" },
            { product_type_id: "auto-policy", policy_type_name: "Standard Auto" },
          ],
        },
      ],
      new Map([
        ["home-policy", "Homeowners"],
        ["auto-policy", "Standard Auto"],
      ]),
    );

    expect(bundleMap.get("kamau kimaru|46032")).toBe("Preferred");
  });

  it("includes existing customer products in household bundle classification", () => {
    const bundleMap = buildCustomerBundleMap(
      [
        {
          customer_name: "Jordan Example",
          customer_zip: "46204",
          existing_customer_products: ["homeowners"],
          sale_policies: [
            { product_type_id: "auto-policy", policy_type_name: "Standard Auto" },
          ],
        },
      ],
      new Map([["auto-policy", "Standard Auto"]]),
    );

    expect(bundleMap.get("jordan example|46204")).toBe("Preferred");
  });
});
