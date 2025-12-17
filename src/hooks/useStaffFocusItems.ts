import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { toast } from "sonner";

export type PriorityLevel = "top" | "mid" | "low";
export type ColumnStatus = "backlog" | "week1" | "week2" | "next_call" | "completed";

export interface StaffFocusItem {
  id: string;
  title: string;
  description: string | null;
  priority_level: PriorityLevel;
  column_status: ColumnStatus;
  created_at: string;
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
}

export function useStaffFocusItems() {
  const queryClient = useQueryClient();
  const { sessionToken, user } = useStaffAuth();
  const teamMemberId = user?.team_member_id;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["staff-focus-items", teamMemberId],
    queryFn: async () => {
      if (!sessionToken) throw new Error("No session token");

      const { data, error } = await supabase.functions.invoke('get_staff_team_data', {
        headers: { 'x-staff-session': sessionToken },
        body: { type: 'focus_items' },
      });

      if (error) throw error;
      return (data?.focus_items || []) as StaffFocusItem[];
    },
    enabled: !!sessionToken && !!teamMemberId,
  });

  const createItem = useMutation({
    mutationFn: async (newItem: CreateFocusItemData) => {
      if (!sessionToken) throw new Error("No session token");

      const { data, error } = await supabase.functions.invoke('get_staff_team_data', {
        headers: { 'x-staff-session': sessionToken },
        body: { 
          type: 'create_focus_item',
          ...newItem,
        },
      });

      if (error) throw error;
      return data?.focus_item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-focus-items", teamMemberId] });
      toast.success("Focus item created");
    },
    onError: (error) => {
      toast.error("Failed to create focus item");
      console.error("Create focus item error:", error);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateFocusItemData }) => {
      if (!sessionToken) throw new Error("No session token");

      const { data, error } = await supabase.functions.invoke('get_staff_team_data', {
        headers: { 'x-staff-session': sessionToken },
        body: { 
          type: 'update_focus_item',
          id,
          ...updates,
        },
      });

      if (error) throw error;
      return data?.focus_item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-focus-items", teamMemberId] });
    },
    onError: (error) => {
      toast.error("Failed to update focus item");
      console.error("Update focus item error:", error);
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      if (!sessionToken) throw new Error("No session token");

      const { data, error } = await supabase.functions.invoke('get_staff_team_data', {
        headers: { 'x-staff-session': sessionToken },
        body: { 
          type: 'delete_focus_item',
          id,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-focus-items", teamMemberId] });
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
      if (!sessionToken) throw new Error("No session token");

      const { data, error } = await supabase.functions.invoke('get_staff_team_data', {
        headers: { 'x-staff-session': sessionToken },
        body: { 
          type: 'move_focus_item',
          id,
          column_status,
          column_order,
        },
      });

      if (error) throw error;
      return data?.focus_item;
    },
    onMutate: async ({ id, column_status, column_order }) => {
      await queryClient.cancelQueries({ queryKey: ["staff-focus-items", teamMemberId] });
      
      const previousItems = queryClient.getQueryData<StaffFocusItem[]>(["staff-focus-items", teamMemberId]);
      
      queryClient.setQueryData<StaffFocusItem[]>(["staff-focus-items", teamMemberId], (old) => {
        if (!old) return old;
        return old.map((item) =>
          item.id === id
            ? { ...item, column_status, column_order }
            : item
        );
      });
      
      return { previousItems };
    },
    onError: (error, _variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(["staff-focus-items", teamMemberId], context.previousItems);
      }
      toast.error("Failed to move focus item");
      console.error("Move focus item error:", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-focus-items", teamMemberId] });
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
