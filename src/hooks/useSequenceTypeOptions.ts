import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

export interface SequenceTypeOption {
  id: string;
  type_key: string;
  label: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSequenceTypeInput {
  type_key: string;
  label: string;
  description?: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface UpdateSequenceTypeInput {
  label?: string;
  description?: string;
  is_active?: boolean;
  sort_order?: number;
}

const QUERY_KEY = ['sequence-type-options'];

/**
 * Hook to fetch active sequence type options for dropdowns
 */
export function useSequenceTypeOptions() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sequence_type_options')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      return (data ?? []) as SequenceTypeOption[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

/**
 * Hook to fetch ALL sequence type options (including inactive) for admin management
 */
export function useAllSequenceTypeOptions() {
  return useQuery({
    queryKey: [...QUERY_KEY, 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sequence_type_options')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      return (data ?? []) as SequenceTypeOption[];
    },
    staleTime: 60 * 1000, // Cache for 1 minute (admin operations need fresher data)
  });
}

/**
 * Hook to get usage counts for each sequence type
 */
export function useSequenceTypeUsageCounts() {
  return useQuery({
    queryKey: ['sequence-type-usage-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('onboarding_sequences')
        .select('target_type');

      if (error) throw error;

      // Count occurrences of each target_type
      const counts: Record<string, number> = {};
      for (const seq of data ?? []) {
        const key = seq.target_type;
        counts[key] = (counts[key] || 0) + 1;
      }
      return counts;
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Generate a type_key from a label
 */
function generateTypeKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
}

/**
 * Admin mutations for managing sequence type options
 */
export function useSequenceTypeOptionsMutations() {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ['sequence-type-usage-counts'] });
  };

  const createType = useMutation({
    mutationFn: async (input: Omit<CreateSequenceTypeInput, 'type_key'> & { type_key?: string }) => {
      const type_key = input.type_key || generateTypeKey(input.label);

      // Get current max sort_order if not provided
      let sort_order = input.sort_order;
      if (sort_order === undefined) {
        const { data: existing } = await supabase
          .from('sequence_type_options')
          .select('sort_order')
          .order('sort_order', { ascending: false })
          .limit(1);

        // Place before "other" which is at 99
        sort_order = (existing?.[0]?.sort_order || 0) + 1;
        if (sort_order >= 99) sort_order = 98;
      }

      const { data, error } = await supabase
        .from('sequence_type_options')
        .insert({
          type_key,
          label: input.label,
          description: input.description || null,
          is_active: input.is_active ?? true,
          sort_order,
        })
        .select()
        .single();

      if (error) throw error;
      return data as SequenceTypeOption;
    },
    onSuccess: () => {
      toast.success('Sequence type created');
      invalidateQueries();
    },
    onError: (error: Error) => {
      console.error('Error creating sequence type:', error);
      if (error.message.includes('duplicate key')) {
        toast.error('A type with this key already exists');
      } else {
        toast.error('Failed to create sequence type');
      }
    },
  });

  const updateType = useMutation({
    mutationFn: async ({ id, ...input }: UpdateSequenceTypeInput & { id: string }) => {
      const { data, error } = await supabase
        .from('sequence_type_options')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as SequenceTypeOption;
    },
    onSuccess: () => {
      toast.success('Sequence type updated');
      invalidateQueries();
    },
    onError: (error: Error) => {
      console.error('Error updating sequence type:', error);
      toast.error('Failed to update sequence type');
    },
  });

  const deleteType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sequence_type_options')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Sequence type deleted');
      invalidateQueries();
    },
    onError: (error: Error) => {
      console.error('Error deleting sequence type:', error);
      toast.error('Failed to delete sequence type');
    },
  });

  const reorderTypes = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Update sort_order for each type
      const updates = orderedIds.map((id, index) =>
        supabase
          .from('sequence_type_options')
          .update({ sort_order: index })
          .eq('id', id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      toast.success('Order updated');
      invalidateQueries();
    },
    onError: (error: Error) => {
      console.error('Error reordering sequence types:', error);
      toast.error('Failed to update order');
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('sequence_type_options')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as SequenceTypeOption;
    },
    onSuccess: (data) => {
      toast.success(data.is_active ? 'Type activated' : 'Type deactivated');
      invalidateQueries();
    },
    onError: (error: Error) => {
      console.error('Error toggling sequence type:', error);
      toast.error('Failed to update type');
    },
  });

  return {
    createType,
    updateType,
    deleteType,
    reorderTypes,
    toggleActive,
  };
}
