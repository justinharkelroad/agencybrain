import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CallOutcomeBreakdown {
  connected: number;
  voicemail: number;
  no_answer: number;
  wrong_number: number;
  callback_requested: number;
}

export interface TeamMemberStats {
  id: string;
  name: string;
  type: 'staff' | 'user';
  due_today: number;
  completed_today: number;
  overdue: number;
  upcoming: number;
  completion_rate: number;
  call_outcomes: CallOutcomeBreakdown;
}

export interface SequenceBreakdown {
  type: string;
  name: string;
  due_today: number;
  completed_today: number;
  overdue: number;
}

export interface TeamStatsData {
  target_date: string;
  team_members: TeamMemberStats[];
  totals: {
    due_today: number;
    completed_today: number;
    overdue: number;
    upcoming: number;
    completion_rate: number;
  };
  by_sequence: SequenceBreakdown[];
}

export function useSequenceTeamStats(agencyId: string | null, date?: string) {
  return useQuery({
    queryKey: ['sequence-team-stats', agencyId, date],
    queryFn: async (): Promise<TeamStatsData> => {
      const { data, error } = await supabase.rpc('get_sequence_team_stats', {
        p_agency_id: agencyId!,
        p_date: date || null,
      });

      if (error) throw error;

      // The RPC returns JSONB — Supabase SDK auto-parses it
      return data as TeamStatsData;
    },
    enabled: !!agencyId,
    refetchInterval: 60_000, // Auto-refresh every minute
  });
}
