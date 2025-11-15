import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MonthlyMission {
  mission: string;
  why: string;
}

export interface TargetMissions {
  [month: string]: MonthlyMission;
}

export interface DomainMissions {
  target1?: TargetMissions;
  target2?: TargetMissions;
}

export interface MonthlyMissionsOutput {
  body?: DomainMissions;
  being?: DomainMissions;
  balance?: DomainMissions;
  business?: DomainMissions;
}

interface GenerateMissionsParams {
  quarter: string;
  body?: {
    target1?: string;
    target2?: string;
    narrative?: string;
  };
  being?: {
    target1?: string;
    target2?: string;
    narrative?: string;
  };
  balance?: {
    target1?: string;
    target2?: string;
    narrative?: string;
  };
  business?: {
    target1?: string;
    target2?: string;
    narrative?: string;
  };
}

export function useMonthlyMissions() {
  return useMutation({
    mutationFn: async (params: GenerateMissionsParams) => {
      console.log('Generating monthly missions...');

      const { data, error } = await supabase.functions.invoke('life_targets_monthly_missions', {
        body: params
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data.missions as MonthlyMissionsOutput;
    },
    onSuccess: () => {
      toast.success('Monthly missions generated');
    },
    onError: (error) => {
      console.error('Generate missions error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate missions');
    }
  });
}
