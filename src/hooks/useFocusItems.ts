import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PriorityLevel = "top" | "mid" | "low";
export type ColumnStatus = "backlog" | "week1" | "week2" | "next_call" | "completed";

export interface FocusItem {
  id: string;
  user_id: string;
  agency_id: string | null;
  title: string;
  description: string | null;
  priority_level: PriorityLevel;
  column_status: ColumnStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  column_order: number;
}

export interface CreateFocusItemData {
  title: string;
  description?: string;
  priority_level: PriorityLevel;
}

export interface UpdateFocusItemData {
  title?: string;
  description?: string;
  priority_level?: PriorityLevel;
  column_status?: ColumnStatus;
  column_order?: number;
}

export function useFocusItems() {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["focus-items"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("focus_items")
        .select("*")
        .eq("user_id", user.id)
        .order("column_order", { ascending: true });

      if (error) throw error;
      return data as FocusItem[];
    },
  });

  const createItem = useMutation({
    mutationFn: async (newItem: CreateFocusItemData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("focus_items")
        .insert({
          ...newItem,
          user_id: user.id,
          column_status: "backlog",
          column_order: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["focus-items"] });
      toast.success("Focus item created");
    },
    onError: (error) => {
      toast.error("Failed to create focus item");
      console.error("Create focus item error:", error);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateFocusItemData }) => {
      const { data, error } = await supabase
        .from("focus_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["focus-items"] });
    },
    onError: (error) => {
      toast.error("Failed to update focus item");
      console.error("Update focus item error:", error);
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("focus_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["focus-items"] });
      toast.success("Focus item deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete focus item");
      console.error("Delete focus item error:", error);
    },
  });

  const moveItem = useMutation({
    mutationFn: async ({
      id,
      column_status,
      column_order,
    }: {
      id: string;
      column_status: ColumnStatus;
      column_order: number;
    }) => {
      const { data, error } = await supabase
        .from("focus_items")
        .update({ column_status, column_order })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, column_status, column_order }) => {
      await queryClient.cancelQueries({ queryKey: ["focus-items"] });
      
      const previousItems = queryClient.getQueryData<FocusItem[]>(["focus-items"]);
      
      queryClient.setQueryData<FocusItem[]>(["focus-items"], (old) => {
        if (!old) return old;
        return old.map((item) =>
          item.id === id
            ? { ...item, column_status, column_order, updated_at: new Date().toISOString() }
            : item
        );
      });
      
      return { previousItems };
    },
    onError: (error, _variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(["focus-items"], context.previousItems);
      }
      toast.error("Failed to move focus item");
      console.error("Move focus item error:", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["focus-items"] });
    },
  });

  return {
    items,
    isLoading,
    createItem,
    updateItem,
    deleteItem,
    moveItem,
  };
}
