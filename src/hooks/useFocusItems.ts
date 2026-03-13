import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getWeekKey } from "@/lib/date-utils";

export type PriorityLevel = "top" | "mid" | "low";
export type ColumnStatus = "backlog" | "week1" | "week2" | "next_call" | "completed";
export type PlaybookZone = "bench" | "power_play" | "queue";
export type PlaybookDomain = "body" | "being" | "balance" | "business";

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
}

export interface CreateFocusItemData {
  title: string;
  description?: string;
  priority_level: PriorityLevel;
  source_type?: string;
  source_name?: string;
  source_session_id?: string;
  zone?: PlaybookZone;
  domain?: PlaybookDomain;
  sub_tag_id?: string;
}

export interface UpdateFocusItemData {
  title?: string;
  description?: string;
  priority_level?: PriorityLevel;
  column_status?: ColumnStatus;
  column_order?: number;
  zone?: PlaybookZone;
  domain?: PlaybookDomain;
  sub_tag_id?: string | null;
}

export function useFocusItems(weekKey?: string) {
  const queryClient = useQueryClient();

  // Get current user for cache key isolation
  const { data: currentUser } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
    staleTime: Infinity,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["focus-items", currentUser?.id, weekKey],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch bench items + power_plays for the week + queue items
      let query = supabase
        .from("focus_items")
        .select("*")
        .eq("user_id", user.id)
        .order("column_order", { ascending: true });

      if (weekKey) {
        // For playbook view: bench + queue + this week's power plays
        query = supabase
          .from("focus_items")
          .select("*")
          .eq("user_id", user.id)
          .or(`zone.eq.bench,zone.eq.queue,and(zone.eq.power_play,week_key.eq.${weekKey})`)
          .order("column_order", { ascending: true });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FocusItem[];
    },
    enabled: !!currentUser?.id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["focus-items", currentUser?.id] });
    queryClient.invalidateQueries({ queryKey: ["playbook-stats", currentUser?.id] });
  };

  const createItem = useMutation({
    mutationFn: async (newItem: CreateFocusItemData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("focus_items")
        .insert({
          title: newItem.title,
          description: newItem.description || null,
          priority_level: newItem.priority_level,
          user_id: user.id,
          column_status: "backlog",
          column_order: 0,
          source_type: newItem.source_type || null,
          source_name: newItem.source_name || null,
          source_session_id: newItem.source_session_id || null,
          zone: newItem.zone || "bench",
          domain: newItem.domain || null,
          sub_tag_id: newItem.sub_tag_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
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
      invalidate();
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
      await queryClient.cancelQueries({ queryKey: ["focus-items", currentUser?.id] });

      const previousItems = queryClient.getQueryData<FocusItem[]>(["focus-items", currentUser?.id]);

      queryClient.setQueryData<FocusItem[]>(["focus-items", currentUser?.id], (old) => {
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
        queryClient.setQueryData(["focus-items", currentUser?.id], context.previousItems);
      }
      toast.error("Failed to move focus item");
      console.error("Move focus item error:", error);
    },
    onSettled: () => {
      invalidate();
    },
  });

  // Schedule an item from bench to a specific day as a power play
  const scheduleItem = useMutation({
    mutationFn: async ({ id, date, domain, sub_tag_id }: {
      id: string;
      date: string;
      domain?: PlaybookDomain;
      sub_tag_id?: string | null;
    }) => {
      const dateObj = new Date(date + "T12:00:00"); // noon to avoid TZ issues
      const wk = getWeekKey(dateObj);
      const updates: Record<string, unknown> = {
        zone: "power_play",
        scheduled_date: date,
        week_key: wk,
      };
      if (domain) updates.domain = domain;
      if (sub_tag_id !== undefined) updates.sub_tag_id = sub_tag_id;

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
      invalidate();
      toast.success("Scheduled as Power Play!");
    },
    onError: () => toast.error("Failed to schedule item"),
  });

  // Complete a power play item
  const completeItem = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("focus_items")
        .update({ completed: true })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["focus-items", currentUser?.id] });
      const prev = queryClient.getQueryData<FocusItem[]>(["focus-items", currentUser?.id, weekKey]);
      queryClient.setQueryData<FocusItem[]>(["focus-items", currentUser?.id, weekKey], (old) =>
        old?.map((item) => (item.id === id ? { ...item, completed: true } : item))
      );
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["focus-items", currentUser?.id, weekKey], context.prev);
      }
      toast.error("Failed to complete item");
    },
    onSettled: () => invalidate(),
  });

  // Uncomplete a power play item
  const uncompleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("focus_items")
        .update({ completed: false })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error("Failed to uncomplete item"),
  });

  // Move item back to bench
  const unscheduleItem = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("focus_items")
        .update({
          zone: "bench",
          scheduled_date: null,
          week_key: null,
          completed: false,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Moved back to Bench");
    },
    onError: () => toast.error("Failed to unschedule item"),
  });

  // Set domain on an item
  const setDomain = useMutation({
    mutationFn: async ({ id, domain, sub_tag_id }: {
      id: string;
      domain: PlaybookDomain;
      sub_tag_id?: string | null;
    }) => {
      const updates: Record<string, unknown> = { domain };
      if (sub_tag_id !== undefined) updates.sub_tag_id = sub_tag_id;
      const { data, error } = await supabase
        .from("focus_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error("Failed to set domain"),
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
  };
}
