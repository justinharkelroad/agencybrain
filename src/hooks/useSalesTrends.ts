import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

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
      total_premium,
      total_items,
      total_points,
      sale_policies(id)
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

  const uniqueCustomers = new Set(
    (sales || [])
      .map((s: any) => s.customer_name?.toLowerCase().trim())
      .filter(Boolean)
  );

  return (sales || []).reduce(
    (acc: SalesTotals, sale: any) => ({
      premium: acc.premium + (sale.total_premium || 0),
      items: acc.items + (sale.total_items || 0),
      points: acc.points + (sale.total_points || 0),
      policies: acc.policies + (sale.sale_policies?.length || 0),
      households: uniqueCustomers.size,
    }),
    { premium: 0, items: 0, points: 0, policies: 0, households: 0 }
  );
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
