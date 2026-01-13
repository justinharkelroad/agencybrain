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

      // If using staff session token, call the edge function
      if (staffSessionToken) {
        const response = await fetch(
          `https://wjqyccbytctqwceuhzhk.supabase.co/functions/v1/get_staff_sales_analytics`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${staffSessionToken}`,
            },
            body: JSON.stringify({
              start_date: startDate,
              end_date: endDate,
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch sales summary");
        }

        const data = await response.json();
        const sales = data.sales || [];

        let totals = { premium: 0, items: 0, policies: 0, points: 0 };
        for (const sale of sales) {
          const policies = (sale.sale_policies || []) as SalePolicy[];
          const countable = calculateCountableTotals(policies);
          totals.premium += countable.premium;
          totals.items += countable.items;
          totals.policies += countable.policyCount;
          totals.points += countable.points;
        }

        return { ...totals, salesCount: sales.length };
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
