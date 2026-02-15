import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";
import { fetchWithAuth, hasStaffToken } from "@/lib/staffRequest";

interface DailyMetric {
  team_member_id: string;
  rep_name: string;
  work_date: string;
  outbound_calls: number;
  talk_minutes: number;
  quoted_count: number;
  sold_items: number;
  sold_policies: number;
  sold_premium_cents: number;
  cross_sells_uncovered: number;
  mini_reviews: number;
  pass: boolean;
  hits: number;
  daily_score: number;
  is_late: boolean;
  status: string;
  // Legacy compatibility fields
  team_member_name?: string;
  date?: string;
}

interface AgencyCallTotals {
  outbound_calls: number;
  talk_minutes: number;
}

interface DashboardDailyResult {
  rows: DailyMetric[];
  tiles: Array<{
    title: string;
    value: number;
    icon: string;
  }>;
  table: Array<DailyMetric & { name: string }>;
  agencyCallTotals: AgencyCallTotals | null;
}

/**
 * Hook to fetch daily dashboard metrics for a given agency and role.
 * Supports both Supabase JWT and staff session token authentication.
 */
export function useDashboardDaily(
  agencySlug: string,
  role: "Sales" | "Service", 
  selectedDate: Date
) {
  return useQuery({
    queryKey: ["dashboard-daily", agencySlug, role, selectedDate.toISOString().slice(0, 10)],
    queryFn: async (): Promise<DashboardDailyResult> => {
      console.log("useDashboardDaily: Fetching data", { agencySlug, role, selectedDate });
      
      // Format date as YYYY-MM-DD for the API (use local timezone, not UTC)
      const workDate = format(selectedDate, "yyyy-MM-dd");
      
      console.log("Fetching daily data for date:", workDate);

      const isStaff = hasStaffToken();

      // For Supabase users, verify session exists
      if (!isStaff) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error("No authentication session found");
        }
      }

      // Use dual-mode auth via fetchWithAuth
      const response = await fetchWithAuth("get_dashboard_daily", {
        method: "GET",
        queryParams: {
          agencySlug,
          workDate,
          role,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Dashboard API error ${response.status}`);
      }

      const { rows, agencyCallTotals } = await response.json();
      
      console.log("Raw dashboard data:", rows);

      // Role filtering now handled by backend
      const filteredRows = rows;

      // Generate summary tiles from the actual data.
      // For call metrics (Outbound Calls, Talk Minutes), use agency-wide totals
      // from call_events when available — these include unmatched calls.
      // Fall back to summing per-member rows if the RPC didn't return data.
      const tiles = [
        {
          title: "Outbound Calls",
          value: agencyCallTotals?.outbound_calls
            ?? filteredRows.reduce((sum: number, row: DailyMetric) => sum + (row.outbound_calls || 0), 0),
          icon: "📞"
        },
        {
          title: "Talk Minutes",
          value: agencyCallTotals?.talk_minutes
            ?? filteredRows.reduce((sum: number, row: DailyMetric) => sum + (row.talk_minutes || 0), 0),
          icon: "⏱️"
        },
        {
          title: "Quoted",
          value: filteredRows.reduce((sum: number, row: DailyMetric) => sum + (row.quoted_count || 0), 0),
          icon: "📋"
        },
        {
          title: "Sold Items",
          value: filteredRows.reduce((sum: number, row: DailyMetric) => sum + (row.sold_items || 0), 0),
          icon: "💰"
        },
        {
          title: "Cross-Sells Uncovered",
          value: filteredRows.reduce((sum: number, row: DailyMetric) => sum + (row.cross_sells_uncovered || 0), 0),
          icon: "📈"
        },
        {
          title: "Mini Reviews",
          value: filteredRows.reduce((sum: number, row: DailyMetric) => sum + (row.mini_reviews || 0), 0),
          icon: "🎖️"
        }
      ];

      // Format table data with rep names
      const table = filteredRows.map((row: DailyMetric) => ({
        ...row,
        name: row.rep_name || 'Unassigned',
        team_member_name: row.rep_name || 'Unassigned', // Legacy compatibility
        date: row.work_date // Legacy compatibility
      }));

      console.log("Processed dashboard result:", { rows: filteredRows.length, tiles, table: table.length });

      return { rows: filteredRows, tiles, table, agencyCallTotals: agencyCallTotals || null };
    },
    enabled: !!agencySlug && !!role,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
