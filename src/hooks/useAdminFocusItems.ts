import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import type { PriorityLevel, ColumnStatus, CreateFocusItemData, UpdateFocusItemData } from "./useFocusItems";

export interface AdminFocusItem {
  id: string;
  user_id: string;
  agency_id: string | null;
  title: string;
  description: string | null;
  priority_level: PriorityLevel;
  column_status: ColumnStatus;
  column_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    agency?: {
      name: string;
    };
  };
}

export function useAdminFocusItems(targetUserId?: string) {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-focus-items", targetUserId],
    queryFn: async () => {
      let query = supabase
        .from("focus_items")
        .select(`
          *,
          user:profiles!user_id(
            id,
            agency:agencies(name)
          )
        `)
        .order("column_order", { ascending: true });

      if (targetUserId) {
        query = query.eq("user_id", targetUserId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as AdminFocusItem[];
    },
    enabled: true,
  });

  const createItem = useMutation({
    mutationFn: async (
      data: CreateFocusItemData & {
        target_user_id: string;
        column_status?: ColumnStatus;
      }
    ) => {
      const { data: newItem, error } = await supabase
        .from("focus_items")
        .insert({
          title: data.title,
          description: data.description || null,
          priority_level: data.priority_level,
          column_status: data.column_status || "backlog",
          column_order: 0,
          user_id: data.target_user_id,
        })
        .select()
        .single();

      if (error) throw error;
      return newItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-focus-items"] });
      toast.success("Focus item created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create focus item");
      console.error("Create focus item error:", error);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: UpdateFocusItemData;
    }) => {
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
      queryClient.invalidateQueries({ queryKey: ["admin-focus-items"] });
      toast.success("Focus item updated");
    },
    onError: (error) => {
      toast.error("Failed to update focus item");
      console.error("Update focus item error:", error);
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("focus_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-focus-items"] });
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
      await queryClient.cancelQueries({ queryKey: ["admin-focus-items"] });

      const previousItems = queryClient.getQueryData<AdminFocusItem[]>([
        "admin-focus-items",
        targetUserId,
      ]);

      queryClient.setQueryData<AdminFocusItem[]>(
        ["admin-focus-items", targetUserId],
        (old) => {
          if (!old) return old;
          return old.map((item) =>
            item.id === id
              ? {
                  ...item,
                  column_status,
                  column_order,
                  updated_at: new Date().toISOString(),
                }
              : item
          );
        }
      );

      return { previousItems };
    },
    onError: (error, _variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(
          ["admin-focus-items", targetUserId],
          context.previousItems
        );
      }
      toast.error("Failed to move focus item");
      console.error("Move focus item error:", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-focus-items"] });
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
