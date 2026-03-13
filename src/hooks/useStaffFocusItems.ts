import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { toast } from "sonner";
import type { PlaybookZone, PlaybookDomain } from "./useFocusItems";

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
  source_type: string | null;
  source_name: string | null;
  source_session_id: string | null;
  // Playbook fields
  zone: PlaybookZone;
  scheduled_date: string | null;
  domain: PlaybookDomain | null;
  sub_tag_id: string | null;
  week_key: string | null;
  completed: boolean;
  completion_proof: string | null;
  completion_feeling: string | null;
}

export interface CreateFocusItemData {
  title: string;
  description?: string;
  priority_level: PriorityLevel;
  zone?: PlaybookZone;
  domain?: PlaybookDomain;
  sub_tag_id?: string;
}

export interface UpdateFocusItemData {
  title?: string;
  description?: string;
  priority_level?: PriorityLevel;
}

export function useStaffFocusItems(weekKey?: string) {
  const queryClient = useQueryClient();
  const { sessionToken, user } = useStaffAuth();
  const teamMemberId = user?.team_member_id;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["staff-focus-items", teamMemberId, weekKey],
    queryFn: async () => {
      if (!sessionToken) throw new Error("No session token");

      const { data, error } = await supabase.functions.invoke('get_staff_team_data', {
        headers: { 'x-staff-session': sessionToken },
        body: { type: weekKey ? 'playbook_items' : 'focus_items', week_key: weekKey },
      });

      if (error) throw error;
      return (data?.focus_items || []) as StaffFocusItem[];
    },
    enabled: !!sessionToken && !!teamMemberId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["staff-focus-items", teamMemberId] });
    queryClient.invalidateQueries({ queryKey: ["staff-playbook-stats", teamMemberId] });
  };

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
      invalidate();
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
    onSuccess: () => invalidate(),
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
        body: { type: 'delete_focus_item', id },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate();
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
        body: { type: 'move_focus_item', id, column_status, column_order },
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
    onSettled: () => invalidate(),
  });

  // Schedule an item from bench to a specific day
  const scheduleItem = useMutation({
    mutationFn: async ({ id, date, domain, sub_tag_id }: {
      id: string;
      date: string;
      domain?: PlaybookDomain;
      sub_tag_id?: string | null;
    }) => {
      if (!sessionToken) throw new Error("No session token");
      const { data, error } = await supabase.functions.invoke('get_staff_team_data', {
        headers: { 'x-staff-session': sessionToken },
        body: { type: 'schedule_playbook_item', id, date, domain, sub_tag_id },
      });
      if (error) throw error;
      return data?.focus_item;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Scheduled as Power Play!");
    },
    onError: () => toast.error("Failed to schedule item"),
  });

  const completeItem = useMutation({
    mutationFn: async (id: string) => {
      if (!sessionToken) throw new Error("No session token");
      const { data, error } = await supabase.functions.invoke('get_staff_team_data', {
        headers: { 'x-staff-session': sessionToken },
        body: { type: 'complete_playbook_item', id },
      });
      if (error) throw error;
      return data?.focus_item;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["staff-focus-items", teamMemberId] });
      const prev = queryClient.getQueryData<StaffFocusItem[]>(["staff-focus-items", teamMemberId, weekKey]);
      queryClient.setQueryData<StaffFocusItem[]>(["staff-focus-items", teamMemberId, weekKey], (old) =>
        old?.map((item) => (item.id === id ? { ...item, completed: true } : item))
      );
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["staff-focus-items", teamMemberId, weekKey], context.prev);
      }
      toast.error("Failed to complete item");
    },
    onSettled: () => invalidate(),
  });

  const uncompleteItem = useMutation({
    mutationFn: async (id: string) => {
      if (!sessionToken) throw new Error("No session token");
      const { data, error } = await supabase.functions.invoke('get_staff_team_data', {
        headers: { 'x-staff-session': sessionToken },
        body: { type: 'uncomplete_playbook_item', id },
      });
      if (error) throw error;
      return data?.focus_item;
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error("Failed to uncomplete item"),
  });

  const unscheduleItem = useMutation({
    mutationFn: async (id: string) => {
      if (!sessionToken) throw new Error("No session token");
      const { data, error } = await supabase.functions.invoke('get_staff_team_data', {
        headers: { 'x-staff-session': sessionToken },
        body: { type: 'unschedule_playbook_item', id },
      });
      if (error) throw error;
      return data?.focus_item;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Moved back to Bench");
    },
    onError: () => toast.error("Failed to unschedule item"),
  });

  const setDomain = useMutation({
    mutationFn: async ({ id, domain, sub_tag_id }: {
      id: string;
      domain: PlaybookDomain;
      sub_tag_id?: string | null;
    }) => {
      if (!sessionToken) throw new Error("No session token");
      const { data, error } = await supabase.functions.invoke('get_staff_team_data', {
        headers: { 'x-staff-session': sessionToken },
        body: { type: 'set_playbook_domain', id, domain, sub_tag_id },
      });
      if (error) throw error;
      return data?.focus_item;
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error("Failed to set domain"),
  });

  // Set item as One Big Thing for the week
  const setOneBigThing = useMutation({
    mutationFn: async ({ id, wk }: { id: string; wk: string }) => {
      if (!sessionToken) throw new Error("No session token");
      const { data, error } = await supabase.functions.invoke('get_staff_team_data', {
        headers: { 'x-staff-session': sessionToken },
        body: { type: 'set_one_big_thing', id, week_key: wk },
      });
      if (error) throw error;
      return data?.focus_item;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Set as your One Big Thing!");
    },
    onError: () => toast.error("Failed to set One Big Thing"),
  });

  // Complete One Big Thing with reflection
  const completeOneBigThing = useMutation({
    mutationFn: async ({ id, proof, feeling }: { id: string; proof: string; feeling: string }) => {
      if (!sessionToken) throw new Error("No session token");
      const { data, error } = await supabase.functions.invoke('get_staff_team_data', {
        headers: { 'x-staff-session': sessionToken },
        body: { type: 'complete_one_big_thing', id, completion_proof: proof, completion_feeling: feeling },
      });
      if (error) throw error;
      return data?.focus_item;
    },
    onSuccess: () => {
      invalidate();
      toast.success("One Big Thing complete!");
    },
    onError: () => toast.error("Failed to complete"),
  });

  // Clear One Big Thing back to bench
  const clearOneBigThing = useMutation({
    mutationFn: async (id: string) => {
      if (!sessionToken) throw new Error("No session token");
      const { data, error } = await supabase.functions.invoke('get_staff_team_data', {
        headers: { 'x-staff-session': sessionToken },
        body: { type: 'clear_one_big_thing', id },
      });
      if (error) throw error;
      return data?.focus_item;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Moved back to Bench");
    },
    onError: () => toast.error("Failed to clear One Big Thing"),
  });

  return {
    items,
    isLoading,
    createItem,
    updateItem,
    deleteItem,
    moveItem,
    scheduleItem,
    completeItem,
    uncompleteItem,
    unscheduleItem,
    setDomain,
    setOneBigThing,
    completeOneBigThing,
    clearOneBigThing,
  };
}
