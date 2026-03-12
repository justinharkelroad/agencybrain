import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BrokeredCarrierPolicyType {
  id: string;
  brokered_carrier_id: string;
  agency_id: string;
  name: string;
  is_active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export function useBrokeredCarrierPolicyTypes(agencyId: string | null) {
  const queryClient = useQueryClient();

  const { data: policyTypes = [], isLoading } = useQuery<BrokeredCarrierPolicyType[]>({
    queryKey: ["brokered-carrier-policy-types", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from("brokered_carrier_policy_types" as any)
        .select("*")
        .eq("agency_id", agencyId)
        .order("order_index")
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as BrokeredCarrierPolicyType[];
    },
    enabled: !!agencyId,
  });

  const getActiveTypesForCarrier = (carrierId: string) =>
    policyTypes.filter((pt) => pt.brokered_carrier_id === carrierId && pt.is_active);

  const getTypesForCarrier = (carrierId: string) =>
    policyTypes.filter((pt) => pt.brokered_carrier_id === carrierId);

  const createPolicyType = useMutation({
    mutationFn: async ({ carrierId, name }: { carrierId: string; name: string }) => {
      if (!agencyId) throw new Error("No agency ID");
      const { data, error } = await supabase
        .from("brokered_carrier_policy_types" as any)
        .insert({ brokered_carrier_id: carrierId, agency_id: agencyId, name })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brokered-carrier-policy-types", agencyId] });
      toast.success("Policy type added");
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast.error("This policy type already exists for this carrier");
      } else {
        toast.error("Failed to add policy type");
      }
    },
  });

  const deletePolicyType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("brokered_carrier_policy_types" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brokered-carrier-policy-types", agencyId] });
      toast.success("Policy type removed");
    },
    onError: () => {
      toast.error("Failed to remove policy type");
    },
  });

  return {
    policyTypes,
    isLoading,
    getActiveTypesForCarrier,
    getTypesForCarrier,
    createPolicyType,
    deletePolicyType,
  };
}
