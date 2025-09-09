import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface VersionedMetric {
  date: string;
  team_member_id: string;
  team_member_name: string;
  role: string;
  kpi_key: string;
  kpi_label: string; // The label at time of submission
  kpi_version_id: string;
  value: number;
  pass: boolean;
  hits: number;
  daily_score: number;
  is_late: boolean;
  streak_count: number;
}

interface DashboardOptions {
  consolidateVersions?: boolean; // Whether to group all versions of a KPI together
}

interface VersionedDashboardResult {
  metrics: VersionedMetric[];
  tiles: Record<string, number>;
  contest: any[];
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
      return {
        metrics: result?.metrics || [],
        tiles: result?.tiles || {},
        contest: result?.contest || []
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