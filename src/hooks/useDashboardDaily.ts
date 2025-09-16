import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { computeWeightedScore, buildTargetsMap, DEFAULT_WEIGHTS } from "@/utils/scoring";

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
      
      // 1) Fetch daily dashboard data from RPC
      const { data, error } = await supabase.rpc('get_dashboard_daily', {
        p_agency_slug: agencySlug,
        p_role: role,
        p_start: dateStr,
        p_end: dateStr
      });
      if (error) throw new Error(error.message);

      let metrics = (data as DailyMetric[]) || [];

      // 2) Build safety-net: fetch weights and targets to recompute when RPC returns unweighted scores
      let weights = { ...DEFAULT_WEIGHTS } as Record<string, number>;
      let targetsMap = { defaults: {}, byMember: {} } as ReturnType<typeof buildTargetsMap>;
      try {
        const { data: agencyId, error: agencyErr } = await supabase.rpc('get_agency_id_by_slug', { p_slug: agencySlug });
        if (!agencyErr && agencyId) {
          const { data: rules } = await supabase
            .from('scorecard_rules')
            .select('weights,n_required')
            .eq('agency_id', agencyId as string)
            .eq('role', role)
            .maybeSingle();
          if (rules?.weights) {
            weights = { ...weights, ...rules.weights as any };
          }
          const { data: targetRows } = await supabase
            .from('targets')
            .select('team_member_id,metric_key,value_number')
            .eq('agency_id', agencyId as string);
          targetsMap = buildTargetsMap(targetRows || []);
        }
      } catch (e) {
        // Non-fatal: keep defaults
        console.warn('[Metrics] safety-net bootstrap failed, using defaults', e);
      }

      // 3) Recompute and correct daily_score when it matches raw hits but weights imply a higher score
      metrics = metrics.map((m) => {
        const { hits: compHits, score: compScore } = computeWeightedScore(m as any, weights as any, targetsMap);
        const rpcScore = Number(m.daily_score ?? 0);
        const rpcHits = Number(m.hits ?? 0);
        const shouldCorrect = compScore > rpcScore && rpcScore === rpcHits && compScore !== rpcHits;
        const finalScore = shouldCorrect ? compScore : rpcScore;
        console.debug('[Metrics] daily scoring', {
          member: m.team_member_name,
          rpcDailyScore: rpcScore,
          rpcHits,
          computedHits: compHits,
          computedScore: compScore,
          corrected: shouldCorrect,
          finalScore,
        });
        return {
          ...m,
          daily_score: finalScore,
        } as DailyMetric;
      });
      
      // 4) Aggregated tiles from corrected metrics
      const tiles = {
        outbound_calls: metrics.reduce((sum, m) => sum + (m.outbound_calls || 0), 0),
        talk_minutes: metrics.reduce((sum, m) => sum + (m.talk_minutes || 0), 0),
        quoted: metrics.reduce((sum, m) => sum + (m.quoted_count || 0), 0),
        sold_items: metrics.reduce((sum, m) => sum + (m.sold_items || 0), 0),
        cross_sells_uncovered: metrics.reduce((sum, m) => sum + (m.cross_sells_uncovered || 0), 0),
        mini_reviews: metrics.reduce((sum, m) => sum + (m.mini_reviews || 0), 0),
        pass_rate: 0,
        sold_policies: 0,
        sold_premium_cents: 0,
      };

      // 5) Table compatibility fields
      const tableData = metrics.map(metric => ({
        ...metric,
        pass_days: metric.pass ? 1 : 0,
        score_sum: metric.daily_score,
        streak: 0,
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