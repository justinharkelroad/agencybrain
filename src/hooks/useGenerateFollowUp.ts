import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface GenerateFollowUpParams {
  callId: string;
  templateType: 'email' | 'text' | 'both';
}

interface GenerateFollowUpResponse {
  success: boolean;
  call_id: string;
  templates: {
    email?: string;
    text?: string;
  };
  generated_at: string;
}

export function useGenerateFollowUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ callId, templateType }: GenerateFollowUpParams): Promise<GenerateFollowUpResponse> => {
      const { data, error } = await supabase.functions.invoke('generate-follow-up-templates', {
        body: {
          call_id: callId,
          template_type: templateType,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate follow-up templates');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Unknown error generating templates');
      }

      return data as GenerateFollowUpResponse;
    },
    onSuccess: (data) => {
      // Invalidate call queries to refresh with new templates
      queryClient.invalidateQueries({ queryKey: ['agency-calls'] });
      queryClient.invalidateQueries({ queryKey: ['call', data.call_id] });
    },
  });
}
