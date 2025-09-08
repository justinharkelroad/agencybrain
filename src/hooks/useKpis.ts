import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface KPI {
  id: string;
  key: string;
  label: string;
  type: string;
  color?: string;
  is_active: boolean;
}

interface KPIsResponse {
  role: string;
  n_required: number;
  kpis: KPI[];
}

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