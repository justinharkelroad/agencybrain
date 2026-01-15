import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { deduplicateKpisBySlug } from "@/utils/kpiUtils";

// Original interface for legacy edge function
interface KPI {
  id: string;
  key: string;
  label: string;
  type: string;
  color?: string;
  is_active: boolean;
}

// New interface for RPC function
interface AgencyKPI {
  kpi_id: string;
  slug: string;
  label: string;
  active: boolean;
}

interface KPIsResponse {
  role: string;
  n_required: number;
  kpis: KPI[];
}

// New hook for direct RPC call to list_agency_kpis with optional role filtering
// Includes defensive deduplication to prevent duplicate KPIs from appearing
// even if the database function returns duplicates (e.g., due to role mismatches)
export function useAgencyKpis(agencyId: string, role?: string) {
  return useQuery({
    queryKey: ["agency-kpis", agencyId, role],
    enabled: !!agencyId,
    queryFn: async (): Promise<AgencyKPI[]> => {
      const { data, error } = await supabase.rpc('list_agency_kpis_by_role', {
        _agency: agencyId,
        _role: role || null
      });
      
      if (error) throw new Error(error.message);
      
      // Defensive deduplication: ensure no duplicate slugs are returned
      // This prevents UI issues even if the database function has bugs
      return deduplicateKpisBySlug(data || []);
    },
  });
}

// Legacy hook - now also using RPC (no more edge function calls)
export function useKpis(memberId: string, role?: string) {
  return useQuery({
    queryKey: ["kpis", memberId, role],
    enabled: !!memberId,
    queryFn: async (): Promise<KPIsResponse> => {
      // This needs to be replaced with proper RPC call once we have the agency ID
      // For now, throw an error to prevent 404s
      throw new Error("useKpis needs to be updated to use agency-based RPC call");
    },
  });
}