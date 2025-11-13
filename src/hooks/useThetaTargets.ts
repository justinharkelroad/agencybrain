import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CreateTargetsData {
  sessionId: string;
  body: string;
  being: string;
  balance: string;
  business: string;
}

export function useCreateTargets() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateTargetsData) => {
      const { data: result, error } = await supabase
        .from('theta_targets')
        .insert([{
          session_id: data.sessionId,
          body: data.body,
          being: data.being,
          balance: data.balance,
          business: data.business
        }])
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['theta-targets'] });
    }
  });
}

export function useGetTargetsBySession(sessionId: string) {
  return useQuery({
    queryKey: ['theta-targets', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('theta_targets')
        .select('*')
        .eq('session_id', sessionId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId
  });
}

export function useUpdateTargets() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateTargetsData & { id: string }) => {
      const { data: result, error } = await supabase
        .from('theta_targets')
        .update({
          body: data.body,
          being: data.being,
          balance: data.balance,
          business: data.business
        })
        .eq('id', data.id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['theta-targets'] });
    }
  });
}
