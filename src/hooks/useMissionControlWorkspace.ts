import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Json, Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type MissionSession = Tables<'mission_control_sessions'>;
export type MissionCommitment = Tables<'mission_control_commitments'>;
export type MissionBoardItem = Tables<'mission_control_board_items'>;
export type MissionCoachNote = Tables<'mission_control_coach_notes'>;
export type MissionAttachment = Tables<'mission_control_attachments'>;
export type MissionUpload = Tables<'uploads'>;

export interface MissionControlWorkspaceClient {
  agencyId: string;
  agencyName: string;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string | null;
}

interface MissionWorkspaceArgs {
  ownerUserId: string | null;
  enabled?: boolean;
  currentUserId?: string | null;
  includeCoachNotes?: boolean;
}

const workspaceKey = (ownerUserId: string | null | undefined) => ['mission-control-workspace', ownerUserId];

export function useMissionControlWorkspace({
  ownerUserId,
  enabled = true,
  currentUserId = null,
  includeCoachNotes = false,
}: MissionWorkspaceArgs) {
  const queryClient = useQueryClient();
  const queryEnabled = Boolean(enabled && ownerUserId);

  const clientQuery = useQuery({
    queryKey: [...workspaceKey(ownerUserId), 'client'],
    enabled: queryEnabled,
    staleTime: 60_000,
    queryFn: async (): Promise<MissionControlWorkspaceClient> => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, agency_id, full_name, email')
        .eq('id', ownerUserId!)
        .single();

      if (profileError) throw profileError;

      const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .select('name')
        .eq('id', profile.agency_id)
        .single();

      if (agencyError) throw agencyError;

      return {
        agencyId: profile.agency_id,
        agencyName: agency.name,
        ownerUserId: profile.id,
        ownerName: profile.full_name || profile.email || 'Unnamed owner',
        ownerEmail: profile.email ?? null,
      };
    },
  });

  const sessionsQuery = useQuery({
    queryKey: [...workspaceKey(ownerUserId), 'sessions'],
    enabled: queryEnabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mission_control_sessions')
        .select('*')
        .eq('owner_user_id', ownerUserId!)
        .order('session_date', { ascending: false });

      if (error) throw error;
      return data as MissionSession[];
    },
  });

  const commitmentsQuery = useQuery({
    queryKey: [...workspaceKey(ownerUserId), 'commitments'],
    enabled: queryEnabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mission_control_commitments')
        .select('*')
        .eq('owner_user_id', ownerUserId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MissionCommitment[];
    },
  });

  const boardItemsQuery = useQuery({
    queryKey: [...workspaceKey(ownerUserId), 'board-items'],
    enabled: queryEnabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mission_control_board_items')
        .select('*')
        .eq('owner_user_id', ownerUserId!)
        .order('column_status', { ascending: true })
        .order('column_order', { ascending: true });

      if (error) throw error;
      return data as MissionBoardItem[];
    },
  });

  const coachNotesQuery = useQuery({
    queryKey: [...workspaceKey(ownerUserId), 'coach-notes'],
    enabled: queryEnabled && includeCoachNotes,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mission_control_coach_notes')
        .select('*')
        .eq('owner_user_id', ownerUserId!)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as MissionCoachNote[];
    },
  });

  const attachmentsQuery = useQuery({
    queryKey: [...workspaceKey(ownerUserId), 'attachments'],
    enabled: queryEnabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mission_control_attachments')
        .select('*')
        .eq('owner_user_id', ownerUserId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MissionAttachment[];
    },
  });

  const uploadsQuery = useQuery({
    queryKey: [...workspaceKey(ownerUserId), 'uploads', currentUserId ?? 'none'],
    enabled: queryEnabled,
    staleTime: 30_000,
    queryFn: async () => {
      const userIds = Array.from(new Set([ownerUserId, currentUserId].filter(Boolean))) as string[];

      const { data, error } = await supabase
        .from('uploads')
        .select('*')
        .in('user_id', userIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MissionUpload[];
    },
  });

  const invalidateWorkspace = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [...workspaceKey(ownerUserId), 'client'] }),
      queryClient.invalidateQueries({ queryKey: [...workspaceKey(ownerUserId), 'sessions'] }),
      queryClient.invalidateQueries({ queryKey: [...workspaceKey(ownerUserId), 'commitments'] }),
      queryClient.invalidateQueries({ queryKey: [...workspaceKey(ownerUserId), 'board-items'] }),
      queryClient.invalidateQueries({ queryKey: [...workspaceKey(ownerUserId), 'coach-notes'] }),
      queryClient.invalidateQueries({ queryKey: [...workspaceKey(ownerUserId), 'attachments'] }),
      queryClient.invalidateQueries({ queryKey: [...workspaceKey(ownerUserId), 'uploads'] }),
    ]);
  };

  const createSession = useMutation({
    mutationFn: async (payload: {
      title: string;
      session_date: string;
      next_call_date?: string | null;
      summary_ai?: string | null;
      transcript_text?: string | null;
      key_points_json?: Json;
      wins_json?: Json;
      issues_json?: Json;
      top_commitments_json?: Json;
    }) => {
      if (!clientQuery.data) throw new Error('Client context unavailable');

      const insertPayload: TablesInsert<'mission_control_sessions'> = {
        agency_id: clientQuery.data.agencyId,
        owner_user_id: clientQuery.data.ownerUserId,
        created_by: currentUserId ?? clientQuery.data.ownerUserId,
        title: payload.title,
        session_date: payload.session_date,
        next_call_date: payload.next_call_date ?? null,
        summary_ai: payload.summary_ai ?? null,
        transcript_text: payload.transcript_text ?? null,
        key_points_json: payload.key_points_json ?? [],
        wins_json: payload.wins_json ?? [],
        issues_json: payload.issues_json ?? [],
        top_commitments_json: payload.top_commitments_json ?? [],
      };

      const { data, error } = await supabase
        .from('mission_control_sessions')
        .insert(insertPayload)
        .select('*')
        .single();

      if (error) throw error;
      return data as MissionSession;
    },
    onSuccess: async () => {
      await invalidateWorkspace();
      toast.success('Session saved');
    },
    onError: (error) => {
      console.error('Mission Control session save failed', error);
      toast.error('Could not save the session');
    },
  });

  const createCommitment = useMutation({
    mutationFn: async (
      payload: Omit<TablesInsert<'mission_control_commitments'>, 'agency_id' | 'owner_user_id'>
    ) => {
      if (!clientQuery.data) throw new Error('Client context unavailable');

      const { data, error } = await supabase
        .from('mission_control_commitments')
        .insert({
          ...payload,
          agency_id: clientQuery.data.agencyId,
          owner_user_id: clientQuery.data.ownerUserId,
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as MissionCommitment;
    },
    onSuccess: async () => {
      await invalidateWorkspace();
      toast.success('Commitment saved');
    },
    onError: (error) => {
      console.error('Mission Control commitment save failed', error);
      toast.error('Could not save the commitment');
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
      console.error('Mission Control commitment update failed', error);
      toast.error('Could not update the commitment');
    },
  });

  const createBoardItem = useMutation({
    mutationFn: async (
      payload: Omit<TablesInsert<'mission_control_board_items'>, 'agency_id' | 'owner_user_id' | 'column_order'> & {
        column_order?: number;
      }
    ) => {
      if (!clientQuery.data) throw new Error('Client context unavailable');

      const existingItems = boardItemsQuery.data ?? [];
      const nextOrder =
        payload.column_order ??
        existingItems.filter((item) => item.column_status === payload.column_status).length;

      const { data, error } = await supabase
        .from('mission_control_board_items')
        .insert({
          ...payload,
          agency_id: clientQuery.data.agencyId,
          owner_user_id: clientQuery.data.ownerUserId,
          column_order: nextOrder,
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as MissionBoardItem;
    },
    onSuccess: async () => {
      await invalidateWorkspace();
      toast.success('Board item saved');
    },
    onError: (error) => {
      console.error('Mission Control board item save failed', error);
      toast.error('Could not save the board item');
    },
  });

  const createCoachNote = useMutation({
    mutationFn: async (payload: Omit<TablesInsert<'mission_control_coach_notes'>, 'agency_id' | 'owner_user_id' | 'created_by'>) => {
      if (!clientQuery.data || !currentUserId) throw new Error('Client context unavailable');

      const { data, error } = await supabase
        .from('mission_control_coach_notes')
        .insert({
          ...payload,
          agency_id: clientQuery.data.agencyId,
          owner_user_id: clientQuery.data.ownerUserId,
          created_by: currentUserId,
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
      console.error('Mission Control coach note save failed', error);
      toast.error('Could not save the coach note');
    },
  });

  const createAttachment = useMutation({
    mutationFn: async (
      payload: Omit<TablesInsert<'mission_control_attachments'>, 'agency_id' | 'owner_user_id' | 'created_by'>
    ) => {
      if (!clientQuery.data) throw new Error('Client context unavailable');

      const { data, error } = await supabase
        .from('mission_control_attachments')
        .insert({
          ...payload,
          agency_id: clientQuery.data.agencyId,
          owner_user_id: clientQuery.data.ownerUserId,
          created_by: currentUserId ?? clientQuery.data.ownerUserId,
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as MissionAttachment;
    },
    onSuccess: async () => {
      await invalidateWorkspace();
      toast.success('Attachment linked');
    },
    onError: (error) => {
      console.error('Mission Control attachment save failed', error);
      toast.error('Could not link the upload');
    },
  });

  const sessions = sessionsQuery.data ?? [];
  const commitments = commitmentsQuery.data ?? [];
  const boardItems = boardItemsQuery.data ?? [];
  const coachNotes = coachNotesQuery.data ?? [];
  const attachments = attachmentsQuery.data ?? [];
  const uploads = uploadsQuery.data ?? [];

  return {
    client: clientQuery.data ?? null,
    sessions,
    commitments,
    boardItems,
    coachNotes,
    attachments,
    uploads,
    latestSession: sessions[0] ?? null,
    isLoading:
      clientQuery.isLoading ||
      sessionsQuery.isLoading ||
      commitmentsQuery.isLoading ||
      boardItemsQuery.isLoading ||
      coachNotesQuery.isLoading ||
      attachmentsQuery.isLoading ||
      uploadsQuery.isLoading,
    error:
      clientQuery.error ||
      sessionsQuery.error ||
      commitmentsQuery.error ||
      boardItemsQuery.error ||
      coachNotesQuery.error ||
      attachmentsQuery.error ||
      uploadsQuery.error ||
      null,
    createSession,
    createCommitment,
    updateCommitment,
    createBoardItem,
    createCoachNote,
    createAttachment,
  };
}
