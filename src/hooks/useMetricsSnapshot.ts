import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth, type AuthPreference } from '@/lib/staffRequest';

export interface MetricsSnapshotInfo {
  id: string;
  date: string;
  version: number;
  lockType: 'soft_close' | 'hard_lock' | 'manual';
  status: 'pending' | 'locked' | 'superseded';
}

export interface MetricsSnapshotRow {
  teamMemberId: string;
  teamMemberName: string;
  teamMemberRole: string;
  role: string | null;
  metrics: Record<string, unknown>;
  targets: Record<string, unknown>;
  attainment: Record<string, unknown>;
  source: Record<string, unknown>;
  status: Record<string, unknown>;
}

interface MetricsSnapshotResponse {
  snapshot: MetricsSnapshotInfo;
  scope: {
    mode: 'staff' | 'supabase';
    teamView: boolean;
    roleFilter: string | null;
    teamMemberFilter: string | null;
  };
  rows: MetricsSnapshotRow[];
}

interface UseMetricsSnapshotOptions {
  date: string;
  role?: 'Sales' | 'Service';
  teamMemberId?: string;
  prefer?: AuthPreference;
  enabled?: boolean;
}

async function fetchMetricsSnapshot({
  date,
  role,
  teamMemberId,
  prefer = 'supabase',
}: Omit<UseMetricsSnapshotOptions, 'enabled'>): Promise<MetricsSnapshotResponse> {
  const queryParams: Record<string, string> = { date };
  if (role) queryParams.role = role;
  if (teamMemberId) queryParams.teamMemberId = teamMemberId;

  const response = await fetchWithAuth('get_metrics_snapshot', {
    method: 'GET',
    prefer,
    queryParams,
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Failed to load snapshot (${response.status})`;
    throw new Error(message);
  }

  return payload as MetricsSnapshotResponse;
}

export function useMetricsSnapshot(options: UseMetricsSnapshotOptions) {
  const {
    date,
    role,
    teamMemberId,
    prefer = 'supabase',
    enabled = true,
  } = options;

  return useQuery({
    queryKey: ['metrics-snapshot', date, role || 'all', teamMemberId || 'all', prefer],
    queryFn: () => fetchMetricsSnapshot({ date, role, teamMemberId, prefer }),
    enabled: enabled && Boolean(date),
    staleTime: 30_000,
    retry: 1,
  });
}
