import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildCustomerBundleMap, buildCustomerKey } from "@/lib/sales-bundle-classification";

export interface BundleMixEntry {
  team_member_id: string;
  name: string;
  totalHouseholds: number;
  preferred: number;
  standard: number;
  monoline: number;
  preferredPct: number;
  standardPct: number;
  monolinePct: number;
}

interface UseBundleMixLeaderboardOptions {
  agencyId: string | null;
  startDate: string;
  endDate: string;
  businessFilter?: string;
  staffSessionToken?: string;
  currentTeamMemberId?: string | null;
}

export function useBundleMixLeaderboard({
  agencyId,
  startDate,
  endDate,
  businessFilter = "all",
  staffSessionToken,
}: UseBundleMixLeaderboardOptions) {
  return useQuery({
    queryKey: ["bundle-mix-leaderboard", agencyId, startDate, endDate, businessFilter, staffSessionToken],
    queryFn: async (): Promise<BundleMixEntry[]> => {
      // Staff portal path
      if (staffSessionToken) {
        const { data, error } = await supabase.functions.invoke("get_staff_sales", {
          headers: { "x-staff-session": staffSessionToken },
          body: {
            date_start: startDate,
            date_end: endDate,
            include_leaderboard: true,
            business_filter: businessFilter,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        // Staff endpoint returns leaderboard + raw sales; we need bundle_type from sales
        // Fall through to fetch bundle data from sales directly using the agency_id from staff data
        const staffAgencyId = data?.agency_id;
        if (!staffAgencyId) return [];

        return fetchBundleMixData(staffAgencyId, startDate, endDate, businessFilter);
      }

      // Owner portal path
      if (!agencyId) return [];

      return fetchBundleMixData(agencyId, startDate, endDate, businessFilter);
    },
    enabled: !!agencyId || !!staffSessionToken,
  });
}

interface BundleMixSale {
  team_member_id?: string | null;
  customer_name?: string | null;
  customer_zip?: string | null;
  existing_customer_products?: string[] | null;
  sale_policies?: Array<{
    product_type_id?: string | null;
    policy_type_name?: string | null;
  }> | null;
}

async function fetchBundleMixData(
  agencyId: string,
  startDate: string,
  endDate: string,
  businessFilter: string,
): Promise<BundleMixEntry[]> {
  // Fetch active team members
  const { data: teamMembers, error: tmError } = await supabase
    .from("team_members")
    .select("id, name")
    .eq("agency_id", agencyId)
    .eq("status", "active");

  if (tmError) throw tmError;

  // Fetch sales in range (we'll classify each customer by all-time product mix)
  let salesQuery = supabase
    .from("sales")
    .select("team_member_id, customer_name, customer_zip, existing_customer_products, sale_policies(product_type_id, policy_type_name)")
    .eq("agency_id", agencyId)
    .gte("sale_date", startDate)
    .lte("sale_date", endDate);

  if (businessFilter === "regular") {
    salesQuery = salesQuery.is("brokered_carrier_id", null);
  } else if (businessFilter === "brokered") {
    salesQuery = salesQuery.not("brokered_carrier_id", "is", null);
  }

  const { data: sales, error: salesError } = await salesQuery;

  if (salesError) throw salesError;
  const typedSales = (sales || []) as BundleMixSale[];

  const customerNames = Array.from(
    new Set(
      typedSales
        .map((sale) => sale.customer_name?.trim())
        .filter((name): name is string => !!name)
    )
  );

  let historicalSales = typedSales;
  if (customerNames.length > 0) {
    let historicalQuery = supabase
      .from("sales")
      .select("customer_name, customer_zip, existing_customer_products, sale_policies(product_type_id, policy_type_name)")
      .eq("agency_id", agencyId)
      .in("customer_name", customerNames);

    if (businessFilter === "regular") {
      historicalQuery = historicalQuery.is("brokered_carrier_id", null);
    } else if (businessFilter === "brokered") {
      historicalQuery = historicalQuery.not("brokered_carrier_id", "is", null);
    }

    const { data, error: historicalError } = await historicalQuery;
    if (historicalError) throw historicalError;
    historicalSales = (data || []) as BundleMixSale[];
  }

  const policyTypeIds = Array.from(
    new Set(
      [...typedSales, ...historicalSales]
        .flatMap((sale) => sale.sale_policies || [])
        .map((policy) => policy.product_type_id)
        .filter((id): id is string => !!id),
    ),
  );

  const canonicalNameByPolicyTypeId = new Map<string, string>();
  if (policyTypeIds.length > 0) {
    const { data: policyTypes, error: policyTypeError } = await supabase
      .from("policy_types")
      .select("id, product_type:product_types(name)")
      .in("id", policyTypeIds);

    if (policyTypeError) throw policyTypeError;

    for (const policyType of policyTypes || []) {
      const canonicalName = (policyType.product_type as { name?: string | null } | null)?.name;
      if (canonicalName) {
        canonicalNameByPolicyTypeId.set(policyType.id, canonicalName);
      }
    }
  }

  const customerBundleMap = buildCustomerBundleMap(historicalSales, canonicalNameByPolicyTypeId);

  // First pass: determine best bundle type per customer per team member
  // Priority: Preferred > Standard > Monoline (null)
  // Cross-sells create multiple sale records for the same customer with different
  // bundle types; we classify each customer by their highest bundle type.
  const bestBundlePerCustomer: Record<string, Record<string, string>> = {};

  const tmNames: Record<string, string> = {};
  for (const tm of teamMembers || []) {
    bestBundlePerCustomer[tm.id] = {};
    tmNames[tm.id] = tm.name;
  }

  for (const sale of typedSales) {
    const tmId = sale.team_member_id;
    if (!tmId || !bestBundlePerCustomer[tmId]) continue;

    const customerKey = buildCustomerKey(sale.customer_name, sale.customer_zip);
    if (!customerKey) continue;

    const current = bestBundlePerCustomer[tmId][customerKey];
    const saleType = customerBundleMap.get(customerKey) || "Monoline";

    // Upgrade to highest bundle type seen for this customer
    if (saleType === "Preferred") {
      bestBundlePerCustomer[tmId][customerKey] = "Preferred";
    } else if (saleType === "Standard" && current !== "Preferred") {
      bestBundlePerCustomer[tmId][customerKey] = "Standard";
    } else if (!current) {
      bestBundlePerCustomer[tmId][customerKey] = "Monoline";
    }
  }

  // Second pass: count customers by their best bundle type
  const entries: BundleMixEntry[] = Object.entries(bestBundlePerCustomer).map(
    ([tmId, customers]) => {
      let preferred = 0;
      let standard = 0;
      let monoline = 0;

      for (const bundleType of Object.values(customers)) {
        if (bundleType === "Preferred") preferred++;
        else if (bundleType === "Standard") standard++;
        else monoline++;
      }

      const total = preferred + standard + monoline;

      return {
        team_member_id: tmId,
        name: tmNames[tmId] || "",
        totalHouseholds: total,
        preferred,
        standard,
        monoline,
        preferredPct: total > 0 ? Math.round((preferred / total) * 100) : 0,
        standardPct: total > 0 ? Math.round((standard / total) * 100) : 0,
        monolinePct: total > 0 ? Math.round((monoline / total) * 100) : 0,
      };
    }
  );

  // Default sort: Preferred % descending
  entries.sort((a, b) => b.preferredPct - a.preferredPct || b.totalHouseholds - a.totalHouseholds);

  return entries;
}
