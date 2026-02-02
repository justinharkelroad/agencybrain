import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import type { DeliverableContent, DeliverableSession } from './useSalesExperienceDeliverables';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Hook for managing the AI builder conversation for a deliverable
 */
export function useDeliverableBuilder(deliverableId: string | undefined) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [isStreaming, setIsStreaming] = useState(false);

  // Fetch existing session
  const {
    data: existingSession,
    isLoading: sessionLoading,
    refetch: refetchSession,
  } = useQuery({
    queryKey: ['deliverable-session', deliverableId],
    queryFn: async () => {
      if (!deliverableId) return null;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deliverable-builder-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'get_session',
            deliverable_id: deliverableId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch session');
      }

      const data = await response.json();
      return data.session as DeliverableSession | null;
    },
    enabled: !!session?.access_token && !!deliverableId,
    staleTime: 30000,
  });

  // Start new session
  const startSessionMutation = useMutation({
    mutationFn: async () => {
      if (!deliverableId) throw new Error('No deliverable ID');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deliverable-builder-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'start',
            deliverable_id: deliverableId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start session');
      }

      const data = await response.json();
      return data.session as DeliverableSession;
    },
    onSuccess: () => {
      refetchSession();
      queryClient.invalidateQueries({ queryKey: ['sales-experience-deliverables'] });
    },
  });

  // Send message
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const sessionId = existingSession?.id;
      if (!sessionId) throw new Error('No active session');

      setIsStreaming(true);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deliverable-builder-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'message',
            session_id: sessionId,
            message,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      const data = await response.json();
      return data as {
        message: string;
        generated_content: DeliverableContent | null;
      };
    },
    onSuccess: () => {
      refetchSession();
    },
    onSettled: () => {
      setIsStreaming(false);
    },
  });

  // Apply generated content
  const applyContentMutation = useMutation({
    mutationFn: async () => {
      const sessionId = existingSession?.id;
      if (!sessionId) throw new Error('No active session');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deliverable-builder-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'apply',
            session_id: sessionId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to apply content');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-experience-deliverables'] });
      queryClient.invalidateQueries({ queryKey: ['deliverable-session'] });
    },
  });

  // Helper to get current messages
  const messages = existingSession?.messages_json || [];
  const generatedContent = existingSession?.generated_content_json;
  const sessionStatus = existingSession?.status;
  const hasActiveSession = existingSession && sessionStatus === 'in_progress';

  const startSession = useCallback(() => {
    return startSessionMutation.mutateAsync();
  }, [startSessionMutation]);

  const sendMessage = useCallback(
    (message: string) => {
      return sendMessageMutation.mutateAsync(message);
    },
    [sendMessageMutation]
  );

  const applyContent = useCallback(() => {
    return applyContentMutation.mutateAsync();
  }, [applyContentMutation]);

  return {
    // State
    messages,
    generatedContent,
    sessionStatus,
    hasActiveSession,
    isLoading: sessionLoading,
    isStarting: startSessionMutation.isPending,
    isSending: sendMessageMutation.isPending || isStreaming,
    isApplying: applyContentMutation.isPending,

    // Actions
    startSession,
    sendMessage,
    applyContent,

    // Errors
    startError: startSessionMutation.error,
    sendError: sendMessageMutation.error,
    applyError: applyContentMutation.error,
  };
}
