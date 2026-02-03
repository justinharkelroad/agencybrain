import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LqsObjection {
  id: string;
  agency_id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Hook to fetch active objections for use in forms (dropdown selection)
 * Returns only active objections, accessible by all authenticated users
 * @param enabled - Set to false to disable the query (e.g., in staff context)
 */
export function useLqsObjections(enabled: boolean = true) {
  return useQuery({
    queryKey: ['lqs-objections-active'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lqs_objections')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('name');

      if (error) throw error;
      return (data || []) as LqsObjection[];
    },
  });
}

/**
 * Hook for agency management of objections (all objections including inactive)
 * Returns all objections for the agency and CRUD mutations
 * @param agencyId - The agency ID to manage objections for
 */
export function useAdminLqsObjections(agencyId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin-lqs-objections', agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lqs_objections')
        .select('*')
        .eq('agency_id', agencyId)
        .order('sort_order')
        .order('name');

      if (error) throw error;
      return (data || []) as LqsObjection[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!agencyId) throw new Error('No agency ID');

      // Get the highest sort_order for new items
      const { data: maxSort } = await supabase
        .from('lqs_objections')
        .select('sort_order')
        .eq('agency_id', agencyId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();

      const nextSortOrder = (maxSort?.sort_order ?? 0) + 1;

      const { error } = await supabase
        .from('lqs_objections')
        .insert({ name: name.trim(), sort_order: nextSortOrder, agency_id: agencyId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lqs-objections', agencyId] });
      queryClient.invalidateQueries({ queryKey: ['lqs-objections-active'] });
      toast.success('Objection created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create objection');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from('lqs_objections')
        .update({ name: name.trim(), updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lqs-objections', agencyId] });
      queryClient.invalidateQueries({ queryKey: ['lqs-objections-active'] });
      toast.success('Objection updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update objection');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('lqs_objections')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lqs-objections', agencyId] });
      queryClient.invalidateQueries({ queryKey: ['lqs-objections-active'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to toggle objection status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lqs_objections')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lqs-objections', agencyId] });
      queryClient.invalidateQueries({ queryKey: ['lqs-objections-active'] });
      toast.success('Objection deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete objection. It may be in use.');
    },
  });

  return {
    ...query,
    createObjection: createMutation,
    updateObjection: updateMutation,
    toggleActive: toggleActiveMutation,
    deleteObjection: deleteMutation,
  };
}
