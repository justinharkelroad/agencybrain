import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";

interface DashboardParams {
  agencySlug: string;
  role: string;
  selectedDate: Date;
  quotedLabel: string;
  soldMetric: string;
}

interface DashboardData {
  tiles: {
    outbound_calls: number;
    talk_minutes: number;
    quoted: number;
    sold_items: number;
    sold_policies: number;
    sold_premium_cents: number;
    pass_rate: number;
    cross_sells_uncovered?: number;
    mini_reviews?: number;
  };
  table: Array<{
    team_member_id: string;
    team_member_name: string;
    role: string;
    date: string;
    outbound_calls: number;
    talk_minutes: number;
    quoted_count: number;
    sold_items: number;
    sold_policies: number;
    sold_premium_cents: number;
    pass_days: number;
    score_sum: number;
    streak: number;
    cross_sells_uncovered?: number;
    mini_reviews?: number;
  }>;
  dailySeries: Array<{
    date: string;
    outbound_calls: number;
    talk_minutes: number;
    quoted_count: number;
    sold_items: number;
    sold_policies: number;
    sold_premium_cents: number;
    pass_count: number;
  }>;
  contest: Array<{
    team_member_id: string;
    team_member_name: string;
    role: string;
    date: string;
    outbound_calls: number;
    talk_minutes: number;
    quoted_count: number;
    sold_items: number;
    sold_policies: number;
    sold_premium_cents: number;
    pass_days: number;
    score_sum: number;
    streak: number;
    cross_sells_uncovered?: number;
    mini_reviews?: number;
  }>;
  meta?: {
    contest_board_enabled?: boolean;
    agencyName?: string;
  };
}

export function useDashboardData(params: DashboardParams) {
  return useQuery({
    queryKey: ["dashboard", params.agencySlug, params.role, params.selectedDate, params.quotedLabel, params.soldMetric],
    enabled: !!params.agencySlug,
    queryFn: async (): Promise<DashboardData> => {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      
      const dateString = format(params.selectedDate, "yyyy-MM-dd");
      
      const res = await supabase.functions.invoke('get_dashboard', {
        body: { 
          agencySlug: params.agencySlug, 
          role: params.role, 
          start: dateString, 
          end: dateString, 
          quotedLabel: params.quotedLabel, 
          soldMetric: params.soldMetric 
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.error) {
        throw new Error(res.error.message || 'Dashboard fetch failed');
      }

      return res.data;
    },
  });
}