import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';

export interface SalesProcessContent {
  rapport: string[];
  coverage: string[];
  closing: string[];
}

export interface StandaloneSalesProcess {
  id: string;
  agency_id: string;
  status: 'not_started' | 'in_progress' | 'complete';
  content_json: SalesProcessContent;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SalesProcessSession {
  id: string;
  sales_process_id: string;
  user_id: string;
  messages_json: ChatMessage[];
  generated_content_json: SalesProcessContent | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  created_at: string;
  updated_at: string;
}

/**
 * Hook to check if user has access to the standalone Sales Process Builder
 */
export function useSalesProcessBuilderAccess() {
  const { session, user } = useAuth();

  return useQuery({
    queryKey: ['sales-process-builder-access', user?.id],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/standalone-sales-process`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: 'get' }),
        }
      );

      if (response.status === 403) {
        return { hasAccess: false, salesProcess: null, session: null };
      }

      if (!response.ok) {
        throw new Error('Failed to check access');
      }

      const data = await response.json();
      return {
        hasAccess: true,
        salesProcess: data.sales_process as StandaloneSalesProcess | null,
        session: data.session as SalesProcessSession | null,
      };
    },
    enabled: !!session?.access_token && !!user,
    staleTime: 60000,
    retry: false,
  });
}

/**
 * Hook to manage the standalone Sales Process Builder
 */
export function useStandaloneSalesProcessBuilder() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const callApi = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/standalone-sales-process`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }, [session?.access_token]);

  const startSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await callApi({ action: 'start' });
      queryClient.invalidateQueries({ queryKey: ['sales-process-builder-access'] });
      return data as { session: SalesProcessSession; sales_process: StandaloneSalesProcess };
    } finally {
      setIsLoading(false);
    }
  }, [callApi, queryClient]);

  const sendMessage = useCallback(async (sessionId: string, message: string) => {
    const data = await callApi({ action: 'message', session_id: sessionId, message });
    return data as { message: string; generated_content: SalesProcessContent | null };
  }, [callApi]);

  const applyContent = useCallback(async (sessionId: string) => {
    const data = await callApi({ action: 'apply', session_id: sessionId });
    queryClient.invalidateQueries({ queryKey: ['sales-process-builder-access'] });
    return data;
  }, [callApi, queryClient]);

  const saveContent = useCallback(async (content: SalesProcessContent, markComplete = false) => {
    const data = await callApi({ action: 'save', content, mark_complete: markComplete });
    queryClient.invalidateQueries({ queryKey: ['sales-process-builder-access'] });
    return data as { success: boolean; sales_process: StandaloneSalesProcess };
  }, [callApi, queryClient]);

  return {
    startSession,
    sendMessage,
    applyContent,
    saveContent,
    isLoading,
  };
}
