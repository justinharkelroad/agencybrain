import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

interface VersionedMetric {
  date: string;
  team_member_id: string;
  team_member_name: string;
  role: string;
  kpi_key: string;
  kpi_label: string; // The label at time of submission (label_at_submit)
  kpi_version_id: string;
  value: number;
  pass: boolean;
  hits: number;
  daily_score: number;
  is_late: boolean;
  streak_count: number;
}

interface VersionedTableRow extends VersionedMetric {
  // Additional computed fields for table display
  outbound_calls: number;
  talk_minutes: number;
  quoted_count: number;
  sold_items: number;
  sold_policies: number;
  sold_premium_cents: number;
  cross_sells_uncovered?: number;
  mini_reviews?: number;
  pass_days: number;
  score_sum: number;
  streak: number;
}

interface DashboardOptions {
  consolidateVersions?: boolean; // Whether to group all versions of a KPI together
}

interface VersionedDashboardResult {
  metrics: VersionedMetric[];
  tiles: Record<string, number>;
  contest: any[];
  table?: VersionedTableRow[]; // Table format compatible with existing dashboard
  meta?: {
    contest_board_enabled?: boolean;
    agencyName?: string;
  };
}

export function useVersionedDashboardData(
  agencySlug: string,
  role: "Sales" | "Service",
  options: DashboardOptions = {}
) {
  return useQuery({
    queryKey: ["versioned-dashboard", agencySlug, role, options],
    queryFn: async (): Promise<VersionedDashboardResult> => {
      // Get dashboard data with versioned KPI information
      const { data, error } = await supabase.rpc('get_versioned_dashboard_data', {
        p_agency_slug: agencySlug,
        p_role: role,
        p_consolidate_versions: options.consolidateVersions || false
      });

      if (error) throw new Error(error.message);

      const result = data as any;
      
      // Transform metrics data into table rows for dashboard compatibility
      const metrics = result?.metrics || [];
      const table = metrics.map((metric: VersionedMetric) => ({
        ...metric,
        team_member_name: metric.team_member_name,
        outbound_calls: 0, // Will be populated from actual metrics
        talk_minutes: 0,
        quoted_count: 0,
        sold_items: 0,
        sold_policies: 0,
        sold_premium_cents: 0,
        cross_sells_uncovered: 0,
        mini_reviews: 0,
        pass_days: metric.pass ? 1 : 0,
        score_sum: metric.daily_score,
        streak: metric.streak_count
      }));
      
      return {
        metrics,
        tiles: result?.tiles || {},
        contest: result?.contest || [],
        table,
        meta: {
          contest_board_enabled: false,
          agencyName: ""
        }
      };
    },
    enabled: !!agencySlug && !!role,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

// Fallback to regular dashboard data when versioned data is not available
export function useDashboardDataWithFallback(
  agencySlug: string,
  role: "Sales" | "Service",
  options: DashboardOptions = {}
) {
  const versionedQuery = useVersionedDashboardData(agencySlug, role, options);
  
  // Fallback query using the existing hook structure  
  const fallbackQuery = useQuery({
    queryKey: ["dashboard-fallback", agencySlug, role],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get_dashboard', {
        body: {
          agencySlug,
          role,
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          end: new Date().toISOString().slice(0, 10),
        }
      });

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: versionedQuery.isError,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  return {
    data: versionedQuery.data || fallbackQuery.data,
    isLoading: versionedQuery.isLoading || (versionedQuery.isError && fallbackQuery.isLoading),
    isFetching: versionedQuery.isFetching || fallbackQuery.isFetching,
    error: versionedQuery.error || fallbackQuery.error,
    isError: versionedQuery.isError && fallbackQuery.isError,
    refetch: () => {
      versionedQuery.refetch();
      fallbackQuery.refetch();
    }
  };
}