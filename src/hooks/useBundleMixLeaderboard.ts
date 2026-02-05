import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

  // Fetch sales with bundle_type and customer_name for deduplication
  let salesQuery = supabase
    .from("sales")
    .select("team_member_id, bundle_type, customer_name")
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

  // Aggregate per team member
  const aggregated: Record<string, {
    team_member_id: string;
    name: string;
    preferred: Set<string>;
    standard: Set<string>;
    monoline: Set<string>;
    allCustomers: Set<string>;
  }> = {};

  for (const tm of teamMembers || []) {
    aggregated[tm.id] = {
      team_member_id: tm.id,
      name: tm.name,
      preferred: new Set(),
      standard: new Set(),
      monoline: new Set(),
      allCustomers: new Set(),
    };
  }

  for (const sale of sales || []) {
    const tmId = sale.team_member_id;
    if (!tmId || !aggregated[tmId]) continue;

    const customerKey = (sale.customer_name || "").toLowerCase().trim();
    if (!customerKey) continue;

    aggregated[tmId].allCustomers.add(customerKey);

    if (sale.bundle_type === "Preferred") {
      aggregated[tmId].preferred.add(customerKey);
    } else if (sale.bundle_type === "Standard") {
      aggregated[tmId].standard.add(customerKey);
    } else {
      // NULL bundle_type = Monoline
      aggregated[tmId].monoline.add(customerKey);
    }
  }

  // Convert to BundleMixEntry array
  const entries: BundleMixEntry[] = Object.values(aggregated).map((entry) => {
    const total = entry.allCustomers.size;
    const preferred = entry.preferred.size;
    const standard = entry.standard.size;
    const monoline = entry.monoline.size;

    return {
      team_member_id: entry.team_member_id,
      name: entry.name,
      totalHouseholds: total,
      preferred,
      standard,
      monoline,
      preferredPct: total > 0 ? Math.round((preferred / total) * 100) : 0,
      standardPct: total > 0 ? Math.round((standard / total) * 100) : 0,
      monolinePct: total > 0 ? Math.round((monoline / total) * 100) : 0,
    };
  });

  // Default sort: Preferred % descending
  entries.sort((a, b) => b.preferredPct - a.preferredPct || b.totalHouseholds - a.totalHouseholds);

  return entries;
}
