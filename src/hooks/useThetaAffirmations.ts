import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AffirmationSet {
  body: string[];
  being: string[];
  balance: string[];
  business: string[];
}

interface GenerateAffirmationsParams {
  targets: {
    body: string;
    being: string;
    balance: string;
    business: string;
  };
  tone: string;
}

export function useGenerateAffirmations() {
  return useMutation({
    mutationFn: async ({ targets, tone }: GenerateAffirmationsParams) => {
      console.log('Generating affirmations with tone:', tone);
      
      const { data, error } = await supabase.functions.invoke('generate_affirmations', {
        body: { targets, tone }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data.affirmations as AffirmationSet;
    },
    onError: (error) => {
      console.error('Generate affirmations error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate affirmations');
    }
  });
}

export function useSaveAffirmations() {
  return useMutation({
    mutationFn: async ({
      sessionId,
      affirmations
    }: {
      sessionId: string;
      affirmations: AffirmationSet;
    }) => {
      // Flatten affirmations into individual records
      const records = Object.entries(affirmations).flatMap(([category, texts]) =>
        texts.map((text, index) => ({
          session_id: sessionId,
          category,
          text,
          order_index: index
        }))
      );

      const { data, error } = await supabase
        .from('theta_affirmations')
        .insert(records)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Affirmations saved successfully');
    },
    onError: (error) => {
      console.error('Save affirmations error:', error);
      toast.error('Failed to save affirmations');
    }
  });
}

export function useGetAffirmations(sessionId: string) {
  return useQuery({
    queryKey: ['theta-affirmations', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('theta_affirmations')
        .select('*')
        .eq('session_id', sessionId)
        .order('order_index');

      if (error) throw error;

      // Group by category
      const grouped: AffirmationSet = {
        body: [],
        being: [],
        balance: [],
        business: []
      };

      data.forEach((aff) => {
        if (aff.category in grouped) {
          grouped[aff.category as keyof AffirmationSet].push(aff.text);
        }
      });

      return grouped;
    },
    enabled: !!sessionId
  });
}
