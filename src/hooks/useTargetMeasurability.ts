import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ItemAnalysis {
  original: string;
  clarity_score: number;
  rewritten_target: string;
}

export interface MeasurabilityAnalysis {
  body: ItemAnalysis[];
  being: ItemAnalysis[];
  balance: ItemAnalysis[];
  business: ItemAnalysis[];
}

interface AnalyzeTargetsParams {
  targets: {
    body: string[];
    being: string[];
    balance: string[];
    business: string[];
  };
}

export function useTargetMeasurability() {
  return useMutation({
    mutationFn: async ({ targets }: AnalyzeTargetsParams) => {
      console.log('Analyzing target measurability...');

      const { data, error } = await supabase.functions.invoke('life_targets_measurability', {
        body: { targets }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data.analysis as MeasurabilityAnalysis;
    },
    onSuccess: () => {
      toast.success('Analysis complete');
    },
    onError: (error) => {
      console.error('Measurability analysis error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to analyze targets');
    }
  });
}
