import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { fetchWithAuth, hasStaffToken } from "@/lib/staffRequest";

/**
 * Hook to fetch current KPI labels for an agency.
 * Returns a map of slug -> current label from kpi_versions where valid_to IS NULL.
 * This ensures the dashboard always displays the latest KPI labels, not hardcoded values.
 * 
 * Supports both Supabase JWT and staff session token authentication.
 */
export function useKpiLabels(agencyId: string | undefined) {
  return useQuery({
    queryKey: ["kpi-labels", agencyId],
    queryFn: async (): Promise<Record<string, string>> => {
      if (!agencyId) return {};

      const isStaff = hasStaffToken();
      
      // For staff users, use the edge function
      if (isStaff) {
        const res = await fetchWithAuth("list_agency_kpis", {
          method: "POST",
          body: {},
        });
        
        if (!res.ok) {
          console.error('Error fetching KPI labels via edge function');
          return {};
        }
        
        const data = await res.json();
        return data.labels || {};
      }
      
      // For Supabase users, use direct RLS query (original approach)
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
    staleTime: 30 * 1000, // 30 seconds - faster label updates after changes
    gcTime: 10 * 60 * 1000,
  });
}
