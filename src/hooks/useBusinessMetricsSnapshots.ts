import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { BusinessMetricsSnapshot } from '@/lib/growth-center/types';

async function fetchSnapshots(agencyId: string): Promise<BusinessMetricsSnapshot[]> {
  const { data, error } = await supabase
    .from('business_metrics_snapshots' as never)
    .select('*')
    .eq('agency_id', agencyId)
    .order('report_month', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as BusinessMetricsSnapshot[];
}

export function useBusinessMetricsSnapshots() {
  const { agencyId } = useUserPermissions();

  const query = useQuery({
    queryKey: ['growth-center', 'snapshots', agencyId],
    queryFn: () => fetchSnapshots(agencyId as string),
    enabled: Boolean(agencyId),
  });

  const latestSnapshot = useMemo(() => {
    if (!query.data || query.data.length === 0) {
      return null;
    }
    return query.data[query.data.length - 1];
  }, [query.data]);

  return {
    ...query,
    snapshots: query.data ?? [],
    latestSnapshot,
  };
}
