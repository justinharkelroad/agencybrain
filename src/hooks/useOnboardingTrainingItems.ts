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
  checklist_type: string;
};

export function useOnboardingTrainingItems(
  memberId: string | undefined,
  agencyId: string | undefined,
  checklistType: string = 'onboarding',
) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ['onboarding-training-items', memberId, checklistType];

  const query = useQuery({
    queryKey,
    enabled: !!memberId && !!agencyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('onboarding_training_items')
        .select('*')
        .eq('member_id', memberId!)
        .eq('checklist_type', checklistType)
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
          checklist_type: checklistType,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success('Item added');
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
      toast.success('Item removed');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to remove item'),
  });

  const reorderItems = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: 'up' | 'down' }) => {
      const items = query.data || [];
      const idx = items.findIndex((it) => it.id === id);
      if (idx < 0) return;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= items.length) return;

      const a = items[idx];
      const b = items[swapIdx];

      // If sort_order values are equal (concurrent insert edge case), assign distinct values
      let sortA = a.sort_order;
      let sortB = b.sort_order;
      if (sortA === sortB) {
        // Use array index to break the tie
        sortA = idx + 1;
        sortB = swapIdx + 1;
      }

      // Swap sort_order values
      const { error: e1 } = await supabase
        .from('onboarding_training_items')
        .update({ sort_order: sortB })
        .eq('id', a.id);
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from('onboarding_training_items')
        .update({ sort_order: sortA })
        .eq('id', b.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to reorder items'),
  });

  const copyToMembers = useMutation({
    mutationFn: async ({
      targetMemberIds,
      items,
    }: {
      targetMemberIds: string[];
      items: { label: string; sort_order: number }[];
    }) => {
      if (!agencyId) throw new Error('Missing agency');
      if (targetMemberIds.length === 0 || items.length === 0) return { copied: 0, skipped: 0 };

      // Fetch existing items for all targets in one query
      const { data: existing, error: fetchErr } = await supabase
        .from('onboarding_training_items')
        .select('member_id, label, sort_order')
        .in('member_id', targetMemberIds)
        .eq('checklist_type', checklistType);
      if (fetchErr) throw fetchErr;

      // Group existing labels (lowercased) and max sort_order by member
      const memberLabels = new Map<string, Set<string>>();
      const memberMaxSort = new Map<string, number>();
      for (const row of existing || []) {
        const mid = row.member_id;
        if (!memberLabels.has(mid)) memberLabels.set(mid, new Set());
        memberLabels.get(mid)!.add(row.label.trim().toLowerCase());
        memberMaxSort.set(mid, Math.max(memberMaxSort.get(mid) ?? 0, row.sort_order));
      }

      // Build insert rows, skipping duplicates per member
      const allRows: {
        member_id: string;
        agency_id: string;
        label: string;
        sort_order: number;
        created_by_user_id: string | null;
        checklist_type: string;
      }[] = [];
      let skipped = 0;

      for (const mid of targetMemberIds) {
        const existingSet = memberLabels.get(mid) ?? new Set();
        let nextSort = (memberMaxSort.get(mid) ?? 0) + 1;
        for (const item of items) {
          if (existingSet.has(item.label.trim().toLowerCase())) {
            skipped++;
            continue;
          }
          allRows.push({
            member_id: mid,
            agency_id: agencyId!,
            label: item.label,
            sort_order: nextSort++,
            created_by_user_id: user?.id ?? null,
            checklist_type: checklistType,
          });
        }
      }

      if (allRows.length > 0) {
        const { error: insertErr } = await supabase
          .from('onboarding_training_items')
          .insert(allRows);
        if (insertErr) throw insertErr;
      }

      return { copied: allRows.length, skipped };
    },
    onSuccess: (_data, variables) => {
      for (const mid of variables.targetMemberIds) {
        qc.invalidateQueries({ queryKey: ['onboarding-training-items', mid, checklistType] });
      }
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to copy items'),
  });

  return { query, addItem, toggleComplete, removeItem, reorderItems, copyToMembers };
}
