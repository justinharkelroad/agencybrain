import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type MissionPulsePeriod = Tables<'periods'>;

export function useMissionControlBusinessPulse(userId: string | null, enabled = true) {
  const query = useQuery({
    queryKey: ['mission-control-business-pulse', userId],
    enabled: Boolean(enabled && userId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('periods')
        .select('*')
        .eq('user_id', userId!)
        .not('form_data', 'is', null)
        .order('start_date', { ascending: false })
        .limit(6);

      if (error) throw error;
      return (data ?? []) as MissionPulsePeriod[];
    },
  });

  const latestPeriod = query.data?.[0] ?? null;
  const previousPeriod = query.data?.[1] ?? null;

  return useMemo(
    () => ({
      periods: query.data ?? [],
      latestPeriod,
      previousPeriod,
      isLoading: query.isLoading,
      error: query.error ?? null,
    }),
    [latestPeriod, previousPeriod, query.data, query.error, query.isLoading]
  );
}
