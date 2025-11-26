import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TrainingModule {
  id: string;
  agency_id: string;
  category_id: string;
  name: string;
  description: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingModuleInsert {
  agency_id: string;
  category_id: string;
  name: string;
  description?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
}

export interface TrainingModuleUpdate {
  name?: string;
  description?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
}

export function useTrainingModules(categoryId?: string) {
  const queryClient = useQueryClient();

  // Fetch modules for a category
  const {
    data: modules = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["training-modules", categoryId],
    queryFn: async () => {
      if (!categoryId) return [];

      const { data, error } = await supabase
        .from("training_modules")
        .select("*")
        .eq("category_id", categoryId)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TrainingModule[];
    },
    enabled: !!categoryId,
  });

  // Create module
  const createModule = useMutation({
    mutationFn: async (module: TrainingModuleInsert) => {
      const { data, error } = await supabase
        .from("training_modules")
        .insert(module)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["training-modules", data.category_id] });
      toast.success("Module created");
    },
    onError: (error: any) => {
      console.error("Create module error:", error);
      toast.error(error.message || "Failed to create module");
    },
  });

  // Update module
  const updateModule = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TrainingModuleUpdate }) => {
      const { data, error } = await supabase
        .from("training_modules")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["training-modules", data.category_id] });
      toast.success("Module updated");
    },
    onError: (error: any) => {
      console.error("Update module error:", error);
      toast.error(error.message || "Failed to update module");
    },
  });

  // Delete module
  const deleteModule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("training_modules")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-modules"] });
      toast.success("Module deleted");
    },
    onError: (error: any) => {
      console.error("Delete module error:", error);
      toast.error(error.message || "Failed to delete module");
    },
  });

  return {
    modules,
    isLoading,
    error,
    createModule: createModule.mutate,
    updateModule: updateModule.mutate,
    deleteModule: deleteModule.mutate,
    isCreating: createModule.isPending,
    isUpdating: updateModule.isPending,
    isDeleting: deleteModule.isPending,
  };
}
