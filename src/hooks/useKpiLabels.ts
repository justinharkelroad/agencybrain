import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

/**
 * Hook to fetch current KPI labels for an agency.
 * Returns a map of slug -> current label from kpi_versions where valid_to IS NULL.
 * This ensures the dashboard always displays the latest KPI labels, not hardcoded values.
 */
export function useKpiLabels(agencyId: string | undefined) {
  return useQuery({
    queryKey: ["kpi-labels", agencyId],
    queryFn: async (): Promise<Record<string, string>> => {
      if (!agencyId) return {};
      
      // Get current (active) KPI labels for the agency
      // Join kpis to kpi_versions where valid_to IS NULL (current version)
      const { data, error } = await supabase
        .from('kpis')
        .select(`
          key,
          kpi_versions!inner(label, valid_to)
        `)
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .is('kpi_versions.valid_to', null);
      
      if (error) {
        console.error('Error fetching KPI labels:', error);
        throw error;
      }
      
      // Build a map of slug -> current label
      const labelMap: Record<string, string> = {};
      data?.forEach((kpi: any) => {
        const currentVersion = kpi.kpi_versions?.[0];
        if (currentVersion) {
          labelMap[kpi.key] = currentVersion.label;
        }
      });
      
      return labelMap;
    },
    enabled: !!agencyId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000,
  });
}
