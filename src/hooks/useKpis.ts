import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

// New hook for direct RPC call to list_agency_kpis
export function useAgencyKpis(agencyId: string) {
  return useQuery({
    queryKey: ["agency-kpis", agencyId],
    enabled: !!agencyId,
    queryFn: async (): Promise<AgencyKPI[]> => {
      const { data, error } = await supabase.rpc('list_agency_kpis', {
        _agency: agencyId
      });
      
      if (error) throw new Error(error.message);
      return data || [];
    },
  });
}

// Legacy hook - still using edge function
export function useKpis(memberId: string, role?: string) {
  return useQuery({
    queryKey: ["kpis", memberId, role],
    enabled: !!memberId,
    queryFn: async (): Promise<KPIsResponse> => {
      const params = new URLSearchParams({ member_id: memberId });
      if (role) params.set("role", role);
      
      const { data, error } = await supabase.functions.invoke('list_agency_kpis', {
        body: { member_id: memberId, role }
      });
      
      if (error) throw new Error(error.message);
      return data;
    },
  });
}