import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PriorInsuranceCompany {
  id: string;
  agency_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function usePriorInsuranceCompanies(agencyId: string | null) {
  const queryClient = useQueryClient();

  const { data: companies = [], isLoading, error } = useQuery<PriorInsuranceCompany[]>({
    queryKey: ["prior-insurance-companies", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from("prior_insurance_companies")
        .select("*")
        .eq("agency_id", agencyId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!agencyId,
  });

  const activeCompanies = companies.filter(c => c.is_active);

  const createCompany = useMutation({
    mutationFn: async (name: string) => {
      if (!agencyId) throw new Error("No agency ID");
      const { data, error } = await supabase
        .from("prior_insurance_companies")
        .insert({ agency_id: agencyId, name })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prior-insurance-companies", agencyId] });
      toast.success("Prior insurance company added");
    },
    onError: (error: Error & { code?: string }) => {
      if (error.code === "23505") {
        toast.error("A company with this name already exists");
      } else {
        toast.error("Failed to add company");
      }
    },
  });

  const updateCompany = useMutation({
    mutationFn: async ({ id, name, is_active }: { id: string; name?: string; is_active?: boolean }) => {
      const updates: Partial<PriorInsuranceCompany> = {};
      if (name !== undefined) updates.name = name;
      if (is_active !== undefined) updates.is_active = is_active;

      const { error } = await supabase
        .from("prior_insurance_companies")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prior-insurance-companies", agencyId] });
      toast.success("Company updated");
    },
    onError: () => {
      toast.error("Failed to update company");
    },
  });

  const deleteCompany = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("prior_insurance_companies")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prior-insurance-companies", agencyId] });
      toast.success("Company removed");
    },
    onError: () => {
      toast.error("Failed to remove company");
    },
  });

  return {
    companies,
    activeCompanies,
    isLoading,
    error,
    createCompany,
    updateCompany,
    deleteCompany,
  };
}
