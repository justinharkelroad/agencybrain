import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PlaybookTag {
  id: string;
  agency_id: string;
  domain: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export function usePlaybookTags(agencyId: string | null, { includeInactive = false }: { includeInactive?: boolean } = {}) {
  const queryClient = useQueryClient();

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["playbook-tags", agencyId, includeInactive],
    queryFn: async () => {
      if (!agencyId) return [];

      let query = supabase
        .from("agency_playbook_tags")
        .select("id, agency_id, domain, name, is_active, sort_order")
        .eq("agency_id", agencyId)
        .order("sort_order", { ascending: true });

      if (!includeInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PlaybookTag[];
    },
    enabled: !!agencyId,
  });

  const createTag = useMutation({
    mutationFn: async (tag: { agency_id: string; domain: string; name: string; sort_order?: number }) => {
      const { data, error } = await supabase
        .from("agency_playbook_tags")
        .insert(tag)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playbook-tags", agencyId] });
      toast.success("Tag created");
    },
    onError: () => toast.error("Failed to create tag"),
  });

  const updateTag = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PlaybookTag> }) => {
      const { data, error } = await supabase
        .from("agency_playbook_tags")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playbook-tags", agencyId] });
    },
    onError: () => toast.error("Failed to update tag"),
  });

  const deleteTag = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agency_playbook_tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playbook-tags", agencyId] });
      toast.success("Tag deleted");
    },
    onError: () => toast.error("Failed to delete tag"),
  });

  const tagsByDomain = (domain: string) => tags.filter((t) => t.domain === domain);

  return { tags, isLoading, tagsByDomain, createTag, updateTag, deleteTag };
}
