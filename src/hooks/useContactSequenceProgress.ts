import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SequenceTaskInfo {
  id: string;
  title: string;
  action_type: 'call' | 'text' | 'email' | 'other';
  day_number: number;
  due_date: string;
  status: 'pending' | 'due' | 'overdue' | 'completed';
  completed_at: string | null;
  completion_notes: string | null;
}

export interface SequenceInstanceInfo {
  instanceId: string;
  sequenceName: string;
  status: string;
  startDate: string | null;
  createdAt: string;
  tasks: SequenceTaskInfo[];
}

/**
 * Fetches onboarding sequence instances + tasks for a given contact.
 * Agency portal: direct Supabase query via RLS.
 * Staff portal: pass pre-fetched staffData (from edge function response).
 */
export function useContactSequenceProgress(
  contactId: string | null,
  agencyId: string | null,
  staffData?: SequenceInstanceInfo[] | null,
) {
  // undefined = agency portal (query via RLS)
  // null = staff portal, still loading (skip query, return loading state)
  // SequenceInstanceInfo[] = staff portal, data ready (skip query, return data)
  const isStaffMode = staffData !== undefined;

  const query = useQuery({
    queryKey: ['contact-sequence-progress', contactId, agencyId],
    queryFn: async (): Promise<SequenceInstanceInfo[]> => {
      if (!contactId || !agencyId) return [];

      // 1. Direct match by contact_id
      const { data: directData, error: directError } = await supabase
        .from('onboarding_instances')
        .select(`
          id, sequence_id, status, start_date, created_at,
          sequence:onboarding_sequences(id, name),
          tasks:onboarding_tasks(
            id, title, action_type, day_number, due_date, status,
            completed_at, completion_notes
          )
        `)
        .eq('contact_id', contactId)
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });

      if (directError) {
        console.error('[useContactSequenceProgress] Error:', directError);
        return [];
      }

      const directIds = new Set((directData || []).map((i: any) => i.id));

      // 2. Also find instances linked via onboarding_tasks.contact_id
      //    (tasks denormalize contact_id, catching instances assigned via sale/household)
      const { data: taskLinkedData } = await supabase
        .from('onboarding_tasks')
        .select('instance_id')
        .eq('contact_id', contactId)
        .eq('agency_id', agencyId)
        .not('instance_id', 'is', null);

      const extraInstanceIds = [
        ...new Set(
          (taskLinkedData || [])
            .map((t: any) => t.instance_id)
            .filter((id: string) => !directIds.has(id))
        ),
      ];

      let allInstances = directData || [];

      if (extraInstanceIds.length > 0) {
        const { data: extraData } = await supabase
          .from('onboarding_instances')
          .select(`
            id, sequence_id, status, start_date, created_at,
            sequence:onboarding_sequences(id, name),
            tasks:onboarding_tasks(
              id, title, action_type, day_number, due_date, status,
              completed_at, completion_notes
            )
          `)
          .in('id', extraInstanceIds)
          .eq('agency_id', agencyId)
          .order('created_at', { ascending: false });

        allInstances = [...allInstances, ...(extraData || [])];
      }

      return mapRawInstances(allInstances);
    },
    // Only auto-fetch for agency portal (not in staff mode)
    enabled: !!contactId && !!agencyId && !isStaffMode,
  });

  // Staff mode: return pre-fetched data or loading state
  if (isStaffMode) {
    return {
      data: staffData ?? [],
      isLoading: staffData === null,
      error: null,
    };
  }

  return query;
}

function mapRawInstances(data: any[]): SequenceInstanceInfo[] {
  return data.map((instance: any) => ({
    instanceId: instance.id,
    sequenceName: instance.sequence?.name || 'Unknown Sequence',
    status: instance.status,
    startDate: instance.start_date,
    createdAt: instance.created_at,
    tasks: (instance.tasks || [])
      .sort((a: any, b: any) => a.day_number - b.day_number)
      .map((t: any) => ({
        id: t.id,
        title: t.title,
        action_type: t.action_type,
        day_number: t.day_number,
        due_date: t.due_date,
        status: t.status,
        completed_at: t.completed_at,
        completion_notes: t.completion_notes,
      })),
  }));
}

/**
 * Maps raw edge function sequence data to SequenceInstanceInfo[]
 */
export function mapSequenceInstances(rawInstances: any[]): SequenceInstanceInfo[] {
  return mapRawInstances(rawInstances);
}
