import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { calculateCountableTotals } from "@/lib/product-constants";
import { buildCustomerKey } from "@/lib/sales-bundle-classification";

export interface SalesTrends {
  premium: number | null;
  items: number | null;
  points: number | null;
  policies: number | null;
  households: number | null;
}

interface SalesTotals {
  premium: number;
  items: number;
  points: number;
  policies: number;
  households: number;
}

interface SalePolicy {
  id: string;
  policy_type_name: string | null;
  total_premium: number | null;
  total_items: number | null;
  total_points: number | null;
}

interface SaleRow {
  customer_name: string | null;
  customer_zip: string | null;
  sale_policies: SalePolicy[] | null;
}

interface UseSalesTrendsOptions {
  agencyId: string | null;
  teamMemberId?: string | null;
  currentMonth?: Date;
}

function calcPercentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

async function fetchMonthTotals(
  agencyId: string,
  startDate: string,
  endDate: string,
  teamMemberId?: string | null
): Promise<SalesTotals> {
  let query = supabase
    .from("sales")
    .select(`
      customer_name,
      customer_zip,
      sale_policies(id, policy_type_name, total_premium, total_items, total_points)
    `)
    .eq("agency_id", agencyId)
    .gte("sale_date", startDate)
    .lte("sale_date", endDate);

  if (teamMemberId) {
    query = query.eq("team_member_id", teamMemberId);
  }

  const { data: sales, error } = await query;

  if (error) {
    throw error;
  }

  const rows = (sales || []) as unknown as SaleRow[];
  const uniqueCustomers = new Set<string>();
  const totals: SalesTotals = { premium: 0, items: 0, points: 0, policies: 0, households: 0 };

  for (const sale of rows) {
    const countable = calculateCountableTotals(sale.sale_policies || []);
    totals.premium += countable.premium;
    totals.items += countable.items;
    totals.points += countable.points;
    totals.policies += countable.policyCount;

    if (countable.policyCount > 0) {
      const customerKey = buildCustomerKey(sale.customer_name, sale.customer_zip);
      if (customerKey) uniqueCustomers.add(customerKey);
    }
  }

  totals.households = uniqueCustomers.size;
  return totals;
}

export function useSalesTrends({
  agencyId,
  teamMemberId,
  currentMonth = new Date(),
}: UseSalesTrendsOptions) {
  const currentStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const currentEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const prevMonth = subMonths(currentMonth, 1);
  const prevStart = format(startOfMonth(prevMonth), "yyyy-MM-dd");
  const prevEnd = format(endOfMonth(prevMonth), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["sales-trends", agencyId, teamMemberId, currentStart, currentEnd],
    queryFn: async (): Promise<{ trends: SalesTrends; currentTotals: SalesTotals; previousTotals: SalesTotals }> => {
      if (!agencyId) {
        return {
          trends: { premium: null, items: null, points: null, policies: null, households: null },
          currentTotals: { premium: 0, items: 0, points: 0, policies: 0, households: 0 },
          previousTotals: { premium: 0, items: 0, points: 0, policies: 0, households: 0 },
        };
      }

      const [currentTotals, previousTotals] = await Promise.all([
        fetchMonthTotals(agencyId, currentStart, currentEnd, teamMemberId),
        fetchMonthTotals(agencyId, prevStart, prevEnd, teamMemberId),
      ]);

      const trends: SalesTrends = {
        premium: calcPercentChange(currentTotals.premium, previousTotals.premium),
        items: calcPercentChange(currentTotals.items, previousTotals.items),
        points: calcPercentChange(currentTotals.points, previousTotals.points),
        policies: calcPercentChange(currentTotals.policies, previousTotals.policies),
        households: calcPercentChange(currentTotals.households, previousTotals.households),
      };

      return { trends, currentTotals, previousTotals };
    },
    enabled: !!agencyId,
  });
}
