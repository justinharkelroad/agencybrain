import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

interface DailyMetric {
  team_member_id: string;
  team_member_name: string;
  date: string;
  outbound_calls: number;
  talk_minutes: number;
  quoted_count: number;
  sold_items: number;
  cross_sells_uncovered: number;
  mini_reviews: number;
  kpi_version_id?: string;
  label_at_submit?: string;
  daily_score: number;
  hits: number;
  pass: boolean;
  // Additional fields for compatibility
  pass_days?: number;
  score_sum?: number;
  streak?: number;
}

interface DashboardDailyResult {
  metrics: DailyMetric[];
  // Aggregated tiles from the daily metrics
  tiles: {
    outbound_calls: number;
    talk_minutes: number;
    quoted: number;
    sold_items: number;
    pass_rate: number;
    cross_sells_uncovered?: number;
    mini_reviews?: number;
    sold_policies?: number;
    sold_premium_cents?: number;
  };
  // Table format for compatibility
  table: DailyMetric[];
  // Additional fields for compatibility
  contest?: any[];
  meta?: {
    contest_board_enabled?: boolean;
    agencyName?: string;
  };
}

export function useDashboardDaily(
  agencySlug: string,
  role: "Sales" | "Service",
  selectedDate: Date
) {
  return useQuery({
    queryKey: ["dashboard-daily", agencySlug, role, selectedDate.toISOString().slice(0, 10)],
    queryFn: async (): Promise<DashboardDailyResult> => {
      const dateStr = selectedDate.toISOString().slice(0, 10); // YYYY-MM-DD format
      
      // Get daily dashboard data using the new RPC
      const { data, error } = await supabase.rpc('get_dashboard_daily', {
        p_agency_slug: agencySlug,
        p_role: role,
        p_start: dateStr,
        p_end: dateStr
      });

      if (error) throw new Error(error.message);

      const metrics = data as DailyMetric[] || [];
      
      // Calculate aggregated tiles from the daily metrics
      const tiles = {
        outbound_calls: metrics.reduce((sum, m) => sum + (m.outbound_calls || 0), 0),
        talk_minutes: metrics.reduce((sum, m) => sum + (m.talk_minutes || 0), 0),
        quoted: metrics.reduce((sum, m) => sum + (m.quoted_count || 0), 0),
        sold_items: metrics.reduce((sum, m) => sum + (m.sold_items || 0), 0),
        cross_sells_uncovered: metrics.reduce((sum, m) => sum + (m.cross_sells_uncovered || 0), 0),
        mini_reviews: metrics.reduce((sum, m) => sum + (m.mini_reviews || 0), 0),
        pass_rate: 0, // Will be calculated based on targets
        sold_policies: 0,
        sold_premium_cents: 0,
      };

      // Transform metrics to include computed fields for table compatibility
      const tableData = metrics.map(metric => ({
        ...metric,
        pass_days: metric.pass ? 1 : 0, // Use the calculated pass status
        score_sum: metric.daily_score, // Use the calculated daily score
        streak: 0, // Streak calculation would need separate logic
      }));
      
      return {
        metrics,
        tiles,
        table: tableData,
        contest: [],
        meta: {
          contest_board_enabled: false,
          agencyName: "",
        },
      };
    },
    enabled: !!agencySlug && !!role,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}