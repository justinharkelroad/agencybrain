import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTargetMeasurability, MeasurabilityAnalysis } from "./useTargetMeasurability";

export interface BrainstormTarget {
  id: string;
  user_id: string;
  quarter: string;
  domain: string;
  target_text: string;
  clarity_score: number | null;
  rewritten_target: string | null;
  is_selected: boolean;
  is_primary: boolean;
  session_id: string;
  created_at: string;
  updated_at: string;
}

interface SaveBrainstormTargetParams {
  quarter: string;
  domain: string;
  target_text: string;
  session_id: string;
}

interface UpdateBrainstormTargetParams {
  id: string;
  target_text?: string;
  is_selected?: boolean;
  is_primary?: boolean;
  clarity_score?: number;
  rewritten_target?: string;
}

interface BatchAnalysisResult {
  success: boolean;
  analyzed_count: number;
}

// Fetch all brainstorm targets for current session
export function useBrainstormTargets(quarter: string, sessionId: string | null) {
  // Get current user for cache key
  const { data: currentUser } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
    staleTime: Infinity,
  });

  return useQuery({
    queryKey: ['brainstorm-targets', currentUser?.id, quarter, sessionId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('life_targets_brainstorm')
        .select('*')
        .eq('user_id', user.id)
        .eq('quarter', quarter)
        .order('created_at', { ascending: true });

      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as BrainstormTarget[];
    },
    enabled: !!quarter && !!sessionId,
  });
}

// Save a new brainstorm target
export function useSaveBrainstormTarget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: SaveBrainstormTargetParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('life_targets_brainstorm')
        .insert({
          user_id: user.id,
          quarter: params.quarter,
          domain: params.domain,
          target_text: params.target_text,
          session_id: params.session_id,
          is_selected: false,
          is_primary: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BrainstormTarget;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['brainstorm-targets'] });
      toast.success('Target added');
    },
    onError: (error: any) => {
      console.error('Error saving brainstorm target:', error);
      // Check for unique constraint violation (duplicate target)
      if (error?.code === '23505') {
        toast.error('This target already exists. Try different wording.');
      } else {
        const details = (error?.message || error?.details || '').toString();
        toast.error(`Failed to save target${details ? `: ${details}` : ''}`);
      }
    }
  });
}

// Update an existing brainstorm target
export function useUpdateBrainstormTarget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: UpdateBrainstormTargetParams) => {
      const { id, ...updates } = params;

      const { data, error } = await supabase
        .from('life_targets_brainstorm')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BrainstormTarget;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brainstorm-targets'] });
    },
    onError: (error) => {
      console.error('Error updating brainstorm target:', error);
      toast.error('Failed to update target');
    }
  });
}

// Delete a brainstorm target
export function useDeleteBrainstormTarget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('life_targets_brainstorm')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brainstorm-targets'] });
      toast.success('Target removed');
    },
    onError: (error) => {
      console.error('Error deleting brainstorm target:', error);
      toast.error('Failed to delete target');
    }
  });
}

// Batch analyze all targets for a session
export function useBatchAnalyzeBrainstorm() {
  const queryClient = useQueryClient();
  const { mutateAsync: analyzeMeasurability } = useTargetMeasurability();
  
  return useMutation({
    mutationFn: async ({ quarter, sessionId }: { quarter: string; sessionId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch all targets for this session
      const { data: targets, error: fetchError } = await supabase
        .from('life_targets_brainstorm')
        .select('*')
        .eq('user_id', user.id)
        .eq('quarter', quarter)
        .eq('session_id', sessionId);

      if (fetchError) throw fetchError;
      if (!targets || targets.length === 0) {
        throw new Error('No targets to analyze');
      }

      // Group targets by domain
      const targetsByDomain = targets.reduce((acc, target) => {
        if (!acc[target.domain]) acc[target.domain] = [];
        acc[target.domain].push(target.target_text);
        return acc;
      }, {} as Record<string, string[]>);

      // Ensure all 4 domains exist (even if empty)
      const allDomains = {
        body: targetsByDomain.body || [],
        being: targetsByDomain.being || [],
        balance: targetsByDomain.balance || [],
        business: targetsByDomain.business || [],
      };

      // Call AI analysis
      const analysis = await analyzeMeasurability({ targets: allDomains });

      // Update each target with its analysis results
      let updatedCount = 0;
      for (const domain of ['body', 'being', 'balance', 'business'] as const) {
        const domainTargets = targets.filter(t => t.domain === domain);
        const domainAnalysis = analysis[domain];

        for (let i = 0; i < domainTargets.length; i++) {
          const target = domainTargets[i];
          const analysisResult = domainAnalysis[i];

          if (analysisResult) {
            const { error: updateError } = await supabase
              .from('life_targets_brainstorm')
              .update({
                clarity_score: analysisResult.clarity_score,
                rewritten_target: analysisResult.rewritten_target,
              })
              .eq('id', target.id);

            if (!updateError) updatedCount++;
          }
        }
      }

      return { success: true, analyzed_count: updatedCount } as BatchAnalysisResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['brainstorm-targets'] });
      toast.success(`Analyzed ${result.analyzed_count} targets`);
    },
    onError: (error) => {
      console.error('Error analyzing targets:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to analyze targets');
    }
  });
}

// Lock in selected targets to quarterly table
export function useLockInSelections() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ quarter, sessionId }: { quarter: string; sessionId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch selected targets
      const { data: selectedTargets, error: fetchError } = await supabase
        .from('life_targets_brainstorm')
        .select('*')
        .eq('user_id', user.id)
        .eq('quarter', quarter)
        .eq('session_id', sessionId)
        .eq('is_selected', true)
        .order('domain', { ascending: true })
        .order('is_primary', { ascending: false });

      if (fetchError) throw fetchError;
      if (!selectedTargets || selectedTargets.length === 0) {
        throw new Error('No targets selected. Please select at least one target per domain.');
      }

      // Group by domain and validate
      const byDomain = selectedTargets.reduce((acc, target) => {
        if (!acc[target.domain]) acc[target.domain] = [];
        acc[target.domain].push(target);
        return acc;
      }, {} as Record<string, BrainstormTarget[]>);

      // Validate: each domain must have at least 1 selected
      const domains = ['body', 'being', 'balance', 'business'];
      for (const domain of domains) {
        if (!byDomain[domain] || byDomain[domain].length === 0) {
          throw new Error(`Please select at least one target for ${domain}`);
        }
        if (byDomain[domain].length > 2) {
          throw new Error(`Cannot select more than 2 targets for ${domain}`);
        }
      }

      // Build quarterly targets object
      const quarterlyData: Record<string, any> = {
        user_id: user.id,
        quarter,
      };

      for (const domain of domains) {
        const domainTargets = byDomain[domain];
        
        // Primary target (first selected or marked as primary)
        const primary = domainTargets.find(t => t.is_primary) || domainTargets[0];
        quarterlyData[`${domain}_target`] = primary.target_text;
        
        // Secondary target (if exists)
        const secondary = domainTargets.find(t => t.id !== primary.id);
        if (secondary) {
          quarterlyData[`${domain}_target2`] = secondary.target_text;
        }
      }

      // Upsert into quarterly table
      const { data, error } = await supabase
        .from('life_targets_quarterly')
        .upsert(quarterlyData, {
          onConflict: 'user_id,quarter',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quarterly-targets'] });
      queryClient.invalidateQueries({ queryKey: ['brainstorm-targets'] });
      toast.success('Targets locked in successfully!');
    },
    onError: (error) => {
      console.error('Error locking in selections:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to lock in selections');
    }
  });
}

// Helper: Clear all targets for a session (start fresh)
export function useClearBrainstormSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ quarter, sessionId }: { quarter: string; sessionId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('life_targets_brainstorm')
        .delete()
        .eq('user_id', user.id)
        .eq('quarter', quarter)
        .eq('session_id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brainstorm-targets'] });
      toast.success('Session cleared');
    },
    onError: (error) => {
      console.error('Error clearing session:', error);
      toast.error('Failed to clear session');
    }
  });
}
