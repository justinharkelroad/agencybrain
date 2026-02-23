import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export type OnboardingTrainingItem = {
  id: string;
  member_id: string;
  agency_id: string;
  label: string;
  completed: boolean;
  completed_at: string | null;
  completed_by_user_id: string | null;
  note: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by_user_id: string | null;
};

export function useOnboardingTrainingItems(memberId: string | undefined, agencyId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ['onboarding-training-items', memberId];

  const query = useQuery({
    queryKey,
    enabled: !!memberId && !!agencyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('onboarding_training_items')
        .select('*')
        .eq('member_id', memberId!)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as OnboardingTrainingItem[];
    },
  });

  const addItem = useMutation({
    mutationFn: async (label: string) => {
      if (!memberId || !agencyId) throw new Error('Missing member or agency');
      const maxSort = (query.data || []).reduce((max, it) => Math.max(max, it.sort_order), 0);
      const { error } = await supabase
        .from('onboarding_training_items')
        .insert({
          member_id: memberId,
          agency_id: agencyId,
          label,
          sort_order: maxSort + 1,
          created_by_user_id: user?.id ?? null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success('Training item added');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to add item'),
  });

  const toggleComplete = useMutation({
    mutationFn: async ({ id, completed, note }: { id: string; completed: boolean; note?: string }) => {
      const update: Record<string, any> = {
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        completed_by_user_id: completed ? (user?.id ?? null) : null,
        note: completed ? (note || null) : null,
      };
      const { error } = await supabase
        .from('onboarding_training_items')
        .update(update)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to update item'),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('onboarding_training_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success('Training item removed');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to remove item'),
  });

  return { query, addItem, toggleComplete, removeItem };
}
