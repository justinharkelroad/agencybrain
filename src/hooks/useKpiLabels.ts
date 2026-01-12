import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { fetchWithAuth, hasStaffToken } from "@/lib/staffRequest";

/**
 * Hook to fetch current KPI labels for an agency, optionally filtered by role.
 * Returns a map of slug -> current label from kpi_versions where valid_to IS NULL.
 * This ensures the dashboard always displays the latest KPI labels, not hardcoded values.
 * 
 * When role is provided, returns role-specific labels with fallback to agency-wide (NULL role) labels.
 * Role-specific labels take priority over NULL role labels for the same key.
 * 
 * Supports both Supabase JWT and staff session token authentication.
 */
export function useKpiLabels(agencyId: string | undefined, role?: string) {
  return useQuery({
    queryKey: ["kpi-labels", agencyId, role],
    queryFn: async (): Promise<Record<string, string>> => {
      if (!agencyId) return {};

      const isStaff = hasStaffToken();
      
      // For staff users, use the edge function
      if (isStaff) {
        const res = await fetchWithAuth("list_agency_kpis", {
          method: "POST",
          body: { role }, // Pass role to edge function
        });
        
        if (!res.ok) {
          console.error('Error fetching KPI labels via edge function');
          return {};
        }
        
        const data = await res.json();
        return data.labels || {};
      }
      
      // For Supabase users, use direct RLS query
      let query = supabase
        .from('kpis')
        .select(`
          key,
          role,
          kpi_versions!inner(label, valid_to)
        `)
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .is('kpi_versions.valid_to', null);
      
      // Filter by role if provided (include role-specific OR agency-wide NULL role)
      if (role) {
        query = query.or(`role.eq.${role},role.is.null`);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching KPI labels:', error);
        throw error;
      }
      
      // Build a map of slug -> current label
      // Deduplicate: role-specific labels take priority over NULL role labels
      const labelMap: Record<string, string> = {};
      const nullLabels: Record<string, string> = {};
      
      data?.forEach((kpi: any) => {
        const currentVersion = kpi.kpi_versions?.[0];
        if (currentVersion) {
          if (kpi.role === role) {
            // Role-specific takes priority
            labelMap[kpi.key] = currentVersion.label;
          } else if (kpi.role === null && !labelMap[kpi.key]) {
            // NULL fallback only if no role-specific exists yet
            nullLabels[kpi.key] = currentVersion.label;
          }
        }
      });
      
      // Merge: NULL labels first, then role-specific (role-specific wins)
      return { ...nullLabels, ...labelMap };
    },
    enabled: !!agencyId,
    staleTime: 30 * 1000, // 30 seconds - faster label updates after changes
    gcTime: 10 * 60 * 1000,
  });
}
