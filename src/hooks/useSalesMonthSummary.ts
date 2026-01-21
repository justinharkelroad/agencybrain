import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateCountableTotals } from "@/lib/product-constants";

interface SalePolicy {
  id: string;
  policy_type_name: string | null;
  total_premium: number | null;
  total_items: number | null;
  total_points: number | null;
}

interface SalesMonthSummary {
  premium: number;
  items: number;
  policies: number;
  points: number;
  salesCount: number;
}

interface UseSalesMonthSummaryOptions {
  agencyId: string | null;
  startDate: string;
  endDate: string;
  staffSessionToken?: string;
}

export function useSalesMonthSummary({
  agencyId,
  startDate,
  endDate,
  staffSessionToken,
}: UseSalesMonthSummaryOptions) {
  return useQuery({
    queryKey: ["sales-month-summary", agencyId, startDate, endDate, staffSessionToken],
    queryFn: async (): Promise<SalesMonthSummary> => {
      if (!agencyId) {
        return { premium: 0, items: 0, policies: 0, points: 0, salesCount: 0 };
      }

      // If using staff session token, use get_staff_sales which returns totals
      if (staffSessionToken) {
        const { data, error } = await supabase.functions.invoke('get_staff_sales', {
          headers: { 'x-staff-session': staffSessionToken },
          body: {
            date_start: startDate,
            date_end: endDate,
            include_leaderboard: false,
            scope: "team"  // Use team scope to get agency-wide totals
          }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        // get_staff_sales returns totals directly
        const totals = data?.totals || {};
        return {
          premium: totals.premium || 0,
          items: totals.items || 0,
          policies: totals.policies || 0,
          points: totals.points || 0,
          salesCount: data?.personal_sales?.length || 0,
        };
      }

      // Direct Supabase query for admin users
      const { data: sales, error } = await supabase
        .from("sales")
        .select(
          "id, sale_policies(id, policy_type_name, total_premium, total_items, total_points)"
        )
        .eq("agency_id", agencyId)
        .gte("sale_date", startDate)
        .lte("sale_date", endDate);

      if (error) {
        throw error;
      }

      let totals = { premium: 0, items: 0, policies: 0, points: 0 };
      for (const sale of sales || []) {
        const policies = (sale.sale_policies || []) as SalePolicy[];
        const countable = calculateCountableTotals(policies);
        totals.premium += countable.premium;
        totals.items += countable.items;
        totals.policies += countable.policyCount;
        totals.points += countable.points;
      }

      return { ...totals, salesCount: (sales || []).length };
    },
    enabled: !!agencyId,
  });
}
