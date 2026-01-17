import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

interface KpiVersion {
  id: string;
  kpi_id: string;
  label: string;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
}

interface FormKpiBinding {
  id: string;
  form_template_id: string;
  kpi_version_id: string;
  created_at: string;
  kpi_versions: KpiVersion;
}

export function useKpiVersions(kpiId?: string) {
  return useQuery({
    queryKey: ["kpi-versions", kpiId],
    queryFn: async (): Promise<KpiVersion[]> => {
      let query = supabase
        .from("kpi_versions")
        .select("*")
        .order("valid_from", { ascending: false });

      if (kpiId) {
        query = query.eq("kpi_id", kpiId);
      }

      const { data, error } = await query;
      
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!kpiId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useCurrentKpiVersion(kpiId: string) {
  return useQuery({
    queryKey: ["current-kpi-version", kpiId],
    queryFn: async (): Promise<KpiVersion | null> => {
      const { data, error } = await supabase
        .from("kpi_versions")
        .select("*")
        .eq("kpi_id", kpiId)
        .is("valid_to", null)
        .single();
      
      if (error && error.code !== 'PGRST116') throw new Error(error.message);
      return data;
    },
    enabled: !!kpiId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useFormKpiBindings(formTemplateId?: string) {
  return useQuery({
    queryKey: ["form-kpi-bindings", formTemplateId],
    queryFn: async (): Promise<FormKpiBinding[]> => {
      const { data, error } = await supabase
        .from("forms_kpi_bindings")
        .select(`
          *,
          kpi_versions (
            id,
            kpi_id,
            label,
            valid_from,
            valid_to,
            created_at
          )
        `)
        .eq("form_template_id", formTemplateId!);
      
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!formTemplateId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useUpdateFormKpiBinding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      formTemplateId 
    }: { 
      formTemplateId: string; 
    }) => {
      // Call the RPC that properly rebinds ALL KPIs from schema_json
      // This ensures all KPI bindings are synced, not just one
      const { error } = await supabase.rpc('bind_form_kpis', {
        p_form: formTemplateId
      });
      
      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: (_, { formTemplateId }) => {
      queryClient.invalidateQueries({ 
        queryKey: ["form-kpi-bindings", formTemplateId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["outdated-form-kpis"] 
      });
    },
  });
}

export function useOutdatedFormKpis(agencyId?: string) {
  return useQuery({
    queryKey: ["outdated-form-kpis", agencyId],
    queryFn: async () => {
      // Find forms with KPI bindings that are not current
      const { data, error } = await supabase
        .from("form_templates")
        .select(`
          id,
          name,
          forms_kpi_bindings!inner (
            kpi_version_id,
            kpi_versions!inner (
              kpi_id,
              label,
              valid_to
            )
          )
        `)
        .eq("agency_id", agencyId!)
        .not("forms_kpi_bindings.kpi_versions.valid_to", "is", null);

      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!agencyId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}