import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth, type AuthPreference } from '@/lib/staffRequest';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CallGapUpload {
  id: string;
  file_name: string;
  source_format: 'ringcentral' | 'ricochet';
  raw_call_count: number;
  record_count: number;
  date_range_start: string | null;
  date_range_end: string | null;
  created_at: string;
}

export interface CallGapRecord {
  agent_name: string;
  call_start: string;
  call_date: string;
  duration_seconds: number;
  direction: 'inbound' | 'outbound';
  contact_name: string;
  contact_phone: string;
  result: string;
}

export interface SaveUploadPayload {
  fileName: string;
  sourceFormat: 'ringcentral' | 'ricochet';
  rawCallCount: number;
  records: {
    agent_name: string;
    call_start: string;
    call_date: string;
    duration_seconds: number;
    direction: 'inbound' | 'outbound';
    contact_name: string;
    contact_phone: string;
    result: string;
  }[];
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useCallGapUploads(agencyId: string | undefined, prefer?: AuthPreference) {
  return useQuery({
    queryKey: ['call-gap-uploads', agencyId],
    queryFn: async () => {
      const res = await fetchWithAuth('call-gap-data', {
        body: { operation: 'get_uploads' },
        prefer,
      });
      if (!res.ok) throw new Error('Failed to fetch uploads');
      const data = await res.json();
      return data.uploads as CallGapUpload[];
    },
    enabled: !!agencyId,
  });
}

export function useCallGapRecords(agencyId: string | undefined, uploadId: string | undefined, prefer?: AuthPreference) {
  return useQuery({
    queryKey: ['call-gap-records', agencyId, uploadId],
    queryFn: async () => {
      const res = await fetchWithAuth('call-gap-data', {
        body: { operation: 'get_records', uploadId },
        prefer,
      });
      if (!res.ok) throw new Error('Failed to fetch records');
      const data = await res.json();
      return {
        records: data.records as CallGapRecord[],
        sourceFormat: data.sourceFormat as 'ringcentral' | 'ricochet',
      };
    },
    enabled: !!agencyId && !!uploadId,
  });
}

export function useSaveCallGapUpload(prefer?: AuthPreference) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SaveUploadPayload) => {
      const res = await fetchWithAuth('call-gap-data', {
        body: {
          operation: 'save_upload',
          fileName: payload.fileName,
          sourceFormat: payload.sourceFormat,
          rawCallCount: payload.rawCallCount,
          records: payload.records,
        },
        prefer,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save upload');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-gap-uploads'] });
    },
  });
}

export function useDeleteCallGapUpload(prefer?: AuthPreference) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (uploadId: string) => {
      const res = await fetchWithAuth('call-gap-data', {
        body: { operation: 'delete_upload', uploadId },
        prefer,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete upload');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-gap-uploads'] });
      queryClient.invalidateQueries({ queryKey: ['call-gap-records'] });
    },
  });
}
