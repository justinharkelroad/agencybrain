import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type MissionSession = Tables<'mission_control_sessions'>;
export type MissionCommitment = Tables<'mission_control_commitments'>;
export type MissionBoardItem = Tables<'mission_control_board_items'>;
export type MissionAttachment = Tables<'mission_control_attachments'>;
export type MissionCoachNote = Tables<'mission_control_coach_notes'>;
export type MissionUpload = Tables<'uploads'>;

export type MissionCommitmentStatus =
  | 'not_started'
  | 'in_progress'
  | 'done'
  | 'blocked'
  | 'carried_forward';

export type MissionBoardColumn = 'backlog' | 'in_progress' | 'before_next_call' | 'done';

interface MissionWorkspaceArgs {
  agencyId: string | null | undefined;
  ownerUserId: string | null | undefined;
  enabled?: boolean;
  includeCoachNotes?: boolean;
  currentUserId?: string | null;
}

const workspaceKey = (agencyId: string | null | undefined, ownerUserId: string | null | undefined) => [
  'mission-control-workspace',
  agencyId,
  ownerUserId,
];

export function useMissionControlWorkspace({
  agencyId,
  ownerUserId,
  enabled = true,
  includeCoachNotes = false,
  currentUserId = null,
}: MissionWorkspaceArgs) {
  const queryClient = useQueryClient();
  const queryEnabled = Boolean(enabled && agencyId && ownerUserId);

  const sessionsQuery = useQuery({
    queryKey: [...workspaceKey(agencyId, ownerUserId), 'sessions'],
    enabled: queryEnabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mission_control_sessions')
        .select('*')
        .eq('agency_id', agencyId!)
        .eq('owner_user_id', ownerUserId!)
        .order('session_date', { ascending: false });

      if (error) throw error;
      return data as MissionSession[];
    },
  });

  const commitmentsQuery = useQuery({
    queryKey: [...workspaceKey(agencyId, ownerUserId), 'commitments'],
    enabled: queryEnabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mission_control_commitments')
        .select('*')
        .eq('agency_id', agencyId!)
        .eq('owner_user_id', ownerUserId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MissionCommitment[];
    },
  });

  const boardItemsQuery = useQuery({
    queryKey: [...workspaceKey(agencyId, ownerUserId), 'board-items'],
    enabled: queryEnabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mission_control_board_items')
        .select('*')
        .eq('agency_id', agencyId!)
        .eq('owner_user_id', ownerUserId!)
        .order('column_status', { ascending: true })
        .order('column_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MissionBoardItem[];
    },
  });

  const attachmentsQuery = useQuery({
    queryKey: [...workspaceKey(agencyId, ownerUserId), 'attachments'],
    enabled: queryEnabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mission_control_attachments')
        .select('*')
        .eq('agency_id', agencyId!)
        .eq('owner_user_id', ownerUserId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MissionAttachment[];
    },
  });

  const uploadsQuery = useQuery({
    queryKey: [...workspaceKey(agencyId, ownerUserId), 'uploads'],
    enabled: queryEnabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uploads')
        .select('*')
        .eq('user_id', ownerUserId!)
        .order('created_at', { ascending: false })
        .limit(24);

      if (error) throw error;
      return data as MissionUpload[];
    },
  });

  const coachNotesQuery = useQuery({
    queryKey: [...workspaceKey(agencyId, ownerUserId), 'coach-notes'],
    enabled: queryEnabled && includeCoachNotes,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mission_control_coach_notes')
        .select('*')
        .eq('agency_id', agencyId!)
        .eq('owner_user_id', ownerUserId!)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as MissionCoachNote[];
    },
  });

  const invalidateWorkspace = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [...workspaceKey(agencyId, ownerUserId), 'sessions'] }),
      queryClient.invalidateQueries({ queryKey: [...workspaceKey(agencyId, ownerUserId), 'commitments'] }),
      queryClient.invalidateQueries({ queryKey: [...workspaceKey(agencyId, ownerUserId), 'board-items'] }),
      queryClient.invalidateQueries({ queryKey: [...workspaceKey(agencyId, ownerUserId), 'attachments'] }),
      queryClient.invalidateQueries({ queryKey: [...workspaceKey(agencyId, ownerUserId), 'coach-notes'] }),
    ]);
  };

  const createSession = useMutation({
    mutationFn: async (
      payload: Omit<TablesInsert<'mission_control_sessions'>, 'agency_id' | 'owner_user_id' | 'created_by'>
    ) => {
      const { data, error } = await supabase
        .from('mission_control_sessions')
        .insert({
          ...payload,
          agency_id: agencyId!,
          owner_user_id: ownerUserId!,
          created_by: currentUserId ?? ownerUserId!,
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as MissionSession;
    },
    onSuccess: async () => {
      await invalidateWorkspace();
      toast.success('Session captured');
    },
    onError: (error) => {
      console.error('Create mission session failed', error);
      toast.error('Could not save the session');
    },
  });

  const updateSession = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TablesUpdate<'mission_control_sessions'> }) => {
      const { data, error } = await supabase
        .from('mission_control_sessions')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data as MissionSession;
    },
    onSuccess: async () => {
      await invalidateWorkspace();
      toast.success('Session updated');
    },
    onError: (error) => {
      console.error('Update mission session failed', error);
      toast.error('Could not update the session');
    },
  });

  const createCommitment = useMutation({
    mutationFn: async (
      payload: Omit<TablesInsert<'mission_control_commitments'>, 'agency_id' | 'owner_user_id'>
    ) => {
      const { data, error } = await supabase
        .from('mission_control_commitments')
        .insert({
          ...payload,
          agency_id: agencyId!,
          owner_user_id: ownerUserId!,
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as MissionCommitment;
    },
    onSuccess: async () => {
      await invalidateWorkspace();
      toast.success('Commitment added');
    },
    onError: (error) => {
      console.error('Create mission commitment failed', error);
      toast.error('Could not add the commitment');
    },
  });

  const updateCommitment = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TablesUpdate<'mission_control_commitments'> }) => {
      const { data, error } = await supabase
        .from('mission_control_commitments')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data as MissionCommitment;
    },
    onSuccess: async () => {
      await invalidateWorkspace();
      toast.success('Commitment updated');
    },
    onError: (error) => {
      console.error('Update mission commitment failed', error);
      toast.error('Could not update the commitment');
    },
  });

  const createBoardItem = useMutation({
    mutationFn: async (
      payload: Omit<TablesInsert<'mission_control_board_items'>, 'agency_id' | 'owner_user_id'>
    ) => {
      const { data, error } = await supabase
        .from('mission_control_board_items')
        .insert({
          ...payload,
          agency_id: agencyId!,
          owner_user_id: ownerUserId!,
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as MissionBoardItem;
    },
    onSuccess: async () => {
      await invalidateWorkspace();
      toast.success('Mission board updated');
    },
    onError: (error) => {
      console.error('Create mission board item failed', error);
      toast.error('Could not add the board item');
    },
  });

  const updateBoardItem = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TablesUpdate<'mission_control_board_items'> }) => {
      const { data, error } = await supabase
        .from('mission_control_board_items')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data as MissionBoardItem;
    },
    onSuccess: async () => {
      await invalidateWorkspace();
      toast.success('Board item updated');
    },
    onError: (error) => {
      console.error('Update mission board item failed', error);
      toast.error('Could not update the board item');
    },
  });

  const createAttachment = useMutation({
    mutationFn: async (
      payload: Omit<TablesInsert<'mission_control_attachments'>, 'agency_id' | 'owner_user_id' | 'created_by'>
    ) => {
      const { data, error } = await supabase
        .from('mission_control_attachments')
        .insert({
          ...payload,
          agency_id: agencyId!,
          owner_user_id: ownerUserId!,
          created_by: currentUserId ?? ownerUserId!,
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as MissionAttachment;
    },
    onSuccess: async () => {
      await Promise.all([
        invalidateWorkspace(),
        queryClient.invalidateQueries({ queryKey: [...workspaceKey(agencyId, ownerUserId), 'uploads'] }),
      ]);
      toast.success('Attachment linked');
    },
    onError: (error) => {
      console.error('Create mission attachment failed', error);
      toast.error('Could not link the attachment');
    },
  });

  const createCoachNote = useMutation({
    mutationFn: async (
      payload: Omit<TablesInsert<'mission_control_coach_notes'>, 'agency_id' | 'owner_user_id' | 'created_by'>
    ) => {
      const { data, error } = await supabase
        .from('mission_control_coach_notes')
        .insert({
          ...payload,
          agency_id: agencyId!,
          owner_user_id: ownerUserId!,
          created_by: currentUserId!,
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as MissionCoachNote;
    },
    onSuccess: async () => {
      await invalidateWorkspace();
      toast.success('Coach note saved');
    },
    onError: (error) => {
      console.error('Create coach note failed', error);
      toast.error('Could not save the coach note');
    },
  });

  const updateCoachNote = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TablesUpdate<'mission_control_coach_notes'> }) => {
      const { data, error } = await supabase
        .from('mission_control_coach_notes')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data as MissionCoachNote;
    },
    onSuccess: async () => {
      await invalidateWorkspace();
      toast.success('Coach note updated');
    },
    onError: (error) => {
      console.error('Update coach note failed', error);
      toast.error('Could not update the coach note');
    },
  });

  const sessions = sessionsQuery.data ?? [];
  const commitments = commitmentsQuery.data ?? [];
  const boardItems = boardItemsQuery.data ?? [];
  const attachments = attachmentsQuery.data ?? [];
  const coachNotes = coachNotesQuery.data ?? [];
  const uploads = uploadsQuery.data ?? [];

  const latestSession = sessions[0] ?? null;

  const attachmentsByCommitment = useMemo(() => {
    const map = new Map<string, MissionAttachment[]>();
    for (const attachment of attachments) {
      if (!attachment.commitment_id) continue;
      map.set(attachment.commitment_id, [...(map.get(attachment.commitment_id) ?? []), attachment]);
    }
    return map;
  }, [attachments]);

  const attachmentsBySession = useMemo(() => {
    const map = new Map<string, MissionAttachment[]>();
    for (const attachment of attachments) {
      if (!attachment.session_id) continue;
      map.set(attachment.session_id, [...(map.get(attachment.session_id) ?? []), attachment]);
    }
    return map;
  }, [attachments]);

  return {
    sessions,
    commitments,
    boardItems,
    attachments,
    uploads,
    latestSession,
    attachmentsByCommitment,
    attachmentsBySession,
    isLoading:
      sessionsQuery.isLoading ||
      commitmentsQuery.isLoading ||
      boardItemsQuery.isLoading ||
      attachmentsQuery.isLoading ||
      uploadsQuery.isLoading ||
      coachNotesQuery.isLoading,
    isRefetching:
      sessionsQuery.isFetching ||
      commitmentsQuery.isFetching ||
      boardItemsQuery.isFetching ||
      attachmentsQuery.isFetching ||
      uploadsQuery.isFetching ||
      coachNotesQuery.isFetching,
    error:
      sessionsQuery.error ||
      commitmentsQuery.error ||
      boardItemsQuery.error ||
      attachmentsQuery.error ||
      uploadsQuery.error ||
      coachNotesQuery.error ||
      null,
    coachNotes,
    createSession,
    updateSession,
    createCommitment,
    updateCommitment,
    createBoardItem,
    updateBoardItem,
    createAttachment,
    createCoachNote,
    updateCoachNote,
  };
}
