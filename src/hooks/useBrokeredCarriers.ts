import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BrokeredCarrier {
  id: string;
  agency_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useBrokeredCarriers(agencyId: string | null) {
  const queryClient = useQueryClient();

  const { data: carriers = [], isLoading, error } = useQuery<BrokeredCarrier[]>({
    queryKey: ["brokered-carriers", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from("brokered_carriers")
        .select("*")
        .eq("agency_id", agencyId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!agencyId,
  });

  const activeCarriers = carriers.filter(c => c.is_active);

  const createCarrier = useMutation({
    mutationFn: async (name: string) => {
      if (!agencyId) throw new Error("No agency ID");
      const { data, error } = await supabase
        .from("brokered_carriers")
        .insert({ agency_id: agencyId, name })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brokered-carriers", agencyId] });
      toast.success("Brokered carrier added");
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast.error("A carrier with this name already exists");
      } else {
        toast.error("Failed to add carrier");
      }
    },
  });

  const updateCarrier = useMutation({
    mutationFn: async ({ id, name, is_active }: { id: string; name?: string; is_active?: boolean }) => {
      const updates: Partial<BrokeredCarrier> = {};
      if (name !== undefined) updates.name = name;
      if (is_active !== undefined) updates.is_active = is_active;

      const { error } = await supabase
        .from("brokered_carriers")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brokered-carriers", agencyId] });
      toast.success("Carrier updated");
    },
    onError: () => {
      toast.error("Failed to update carrier");
    },
  });

  const deleteCarrier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("brokered_carriers")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brokered-carriers", agencyId] });
      toast.success("Carrier removed");
    },
    onError: () => {
      toast.error("Failed to remove carrier");
    },
  });

  return {
    carriers,
    activeCarriers,
    isLoading,
    error,
    createCarrier,
    updateCarrier,
    deleteCarrier,
  };
}
