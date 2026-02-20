import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getStaffSessionToken } from '@/lib/cancel-audit-api';
import { toast } from 'sonner';
import type { AICancelAuditQueryResponse, AICancelAuditConversationMessage } from '@/types/cancelAuditAIQuery';

interface UseCancelAuditAIQueryOptions {
  teamMembers: { id: string; name: string }[];
  /** Distinct values from loaded records — helps AI return exact matches */
  distinctValues?: {
    productNames?: string[];
    companyCodes?: string[];
    cities?: string[];
    states?: string[];
    agentNumbers?: string[];
  };
}

export function useCancelAuditAIQuery({ teamMembers, distinctValues }: UseCancelAuditAIQueryOptions) {
  const [conversation, setConversation] = useState<AICancelAuditConversationMessage[]>([]);
  const [currentResult, setCurrentResult] = useState<AICancelAuditQueryResponse | null>(null);
  const [resultVersion, setResultVersion] = useState(0);
  const isActive = currentResult !== null;

  const mutation = useMutation({
    mutationFn: async (query: string): Promise<{ result: AICancelAuditQueryResponse; usage?: { input_tokens: number; output_tokens: number } }> => {
      const staffSessionToken = getStaffSessionToken();

      const headers: Record<string, string> = {};
      if (staffSessionToken) {
        headers['x-staff-session'] = staffSessionToken;
      }

      const { data, error } = await supabase.functions.invoke('parse_cancel_audit_query', {
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
      return data as { result: AICancelAuditQueryResponse; usage?: { input_tokens: number; output_tokens: number } };
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
      console.error('[useCancelAuditAIQuery] Error:', error);
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
