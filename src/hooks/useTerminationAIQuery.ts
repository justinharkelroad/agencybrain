import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getStaffToken } from '@/lib/staffRequest';
import { toast } from 'sonner';
import type { AITerminationQueryResponse, AIWinbackConversationMessage } from '@/types/winbackAIQuery';

interface UseTerminationAIQueryOptions {
  teamMembers: { id: string; name: string; agentNumber?: string }[];
  distinctValues?: {
    productNames?: string[];
    agentNumbers?: string[];
    terminationReasons?: string[];
  };
}

export function useTerminationAIQuery({ teamMembers, distinctValues }: UseTerminationAIQueryOptions) {
  const [conversation, setConversation] = useState<AIWinbackConversationMessage[]>([]);
  const [currentResult, setCurrentResult] = useState<AITerminationQueryResponse | null>(null);
  const [resultVersion, setResultVersion] = useState(0);
  const isActive = currentResult !== null;

  const mutation = useMutation({
    mutationFn: async (query: string): Promise<{ result: AITerminationQueryResponse; usage?: { input_tokens: number; output_tokens: number } }> => {
      const staffSessionToken = getStaffToken();

      const headers: Record<string, string> = {};
      if (staffSessionToken) {
        headers['x-staff-session'] = staffSessionToken;
      }

      const { data, error } = await supabase.functions.invoke('parse_termination_query', {
        body: {
          query,
          conversation,
          teamMembers,
          distinctValues,
        },
        headers,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { result: AITerminationQueryResponse; usage?: { input_tokens: number; output_tokens: number } };
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
      console.error('[useTerminationAIQuery] Error:', error);
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
