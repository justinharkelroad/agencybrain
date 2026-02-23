import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getStaffToken } from '@/lib/staffRequest';
import { toast } from 'sonner';
import type { AIWinbackQueryResponse, AIWinbackConversationMessage } from '@/types/winbackAIQuery';

interface UseWinbackAIQueryOptions {
  teamMembers: { id: string; name: string }[];
}

export function useWinbackAIQuery({ teamMembers }: UseWinbackAIQueryOptions) {
  const [conversation, setConversation] = useState<AIWinbackConversationMessage[]>([]);
  const [currentResult, setCurrentResult] = useState<AIWinbackQueryResponse | null>(null);
  const [resultVersion, setResultVersion] = useState(0);
  const isActive = currentResult !== null;

  const mutation = useMutation({
    mutationFn: async (query: string): Promise<{ result: AIWinbackQueryResponse; usage?: { input_tokens: number; output_tokens: number } }> => {
      const staffSessionToken = getStaffToken();

      const headers: Record<string, string> = {};
      if (staffSessionToken) {
        headers['x-staff-session'] = staffSessionToken;
      }

      const { data, error } = await supabase.functions.invoke('parse_winback_query', {
        body: {
          query,
          conversation,
          teamMembers,
        },
        headers,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { result: AIWinbackQueryResponse; usage?: { input_tokens: number; output_tokens: number } };
    },
    onSuccess: (data, query) => {
      const { result } = data;
      setConversation(prev => [
        ...prev,
        { role: 'user', content: query },
        { role: 'assistant', content: JSON.stringify(result) },
      ]);
      setCurrentResult(result);
      setResultVersion(v => v + 1);
    },
    onError: (error: Error) => {
      console.error('[useWinbackAIQuery] Error:', error);
      toast.error('AI query failed. Try again or use manual filters.');
    },
  });

  const sendQuery = useCallback((query: string) => {
    mutation.mutate(query);
  }, [mutation]);

  const clearAIQuery = useCallback(() => {
    setConversation([]);
    setCurrentResult(null);
  }, []);

  return {
    sendQuery,
    clearAIQuery,
    currentResult,
    resultVersion,
    conversation,
    isActive,
    isLoading: mutation.isPending,
    turnCount: Math.floor(conversation.length / 2),
  };
}
