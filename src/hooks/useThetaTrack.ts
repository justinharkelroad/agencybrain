import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GenerateTrackParams {
  sessionId: string;
  voiceId: string;
  affirmations: any;
}

export function useGenerateThetaTrack() {
  return useMutation({
    mutationFn: async ({ sessionId, voiceId, affirmations }: GenerateTrackParams) => {
      console.log('Generating theta track...');
      
      const { data, error } = await supabase.functions.invoke('generate_theta_track', {
        body: { sessionId, voiceId, affirmations }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onError: (error) => {
      console.error('Generate track error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate track');
    }
  });
}

export function useGetTrackStatus(trackId: string | null) {
  return useQuery({
    queryKey: ['theta-track-status', trackId],
    queryFn: async () => {
      if (!trackId) return null;

      const { data, error } = await supabase
        .from('theta_tracks')
        .select('*')
        .eq('id', trackId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!trackId,
    refetchInterval: (query) => {
      // Stop polling when completed or failed
      if (query.state.data?.status === 'completed' || query.state.data?.status === 'failed') {
        return false;
      }
      return 3000; // Poll every 3 seconds
    }
  });
}
