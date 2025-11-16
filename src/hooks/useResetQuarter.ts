import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDeleteQuarterlyTargets } from "./useQuarterlyTargetsHistory";
import { useClearBrainstormSession } from "./useBrainstormTargets";
import { useLifeTargetsStore } from "@/lib/lifeTargetsStore";
import { generateSessionId } from "@/lib/sessionUtils";

interface ResetQuarterParams {
  quarter: string;
  quarterlyTargetId: string | null;
  sessionId: string | null;
}

export function useResetQuarter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const deleteQuarterlyTargets = useDeleteQuarterlyTargets();
  const clearBrainstormSession = useClearBrainstormSession();
  const { reset: resetStore, setCurrentSessionId } = useLifeTargetsStore();

  return useMutation({
    mutationFn: async (params: ResetQuarterParams) => {
      const { quarterlyTargetId, sessionId, quarter } = params;
      
      // Delete saved quarterly targets if they exist
      if (quarterlyTargetId) {
        await deleteQuarterlyTargets.mutateAsync(quarterlyTargetId);
      }
      
      // Clear brainstorm session if it exists
      if (sessionId) {
        await clearBrainstormSession.mutateAsync({ quarter, sessionId });
      }
    },
    onSuccess: (_, params) => {
      // Reset store state
      resetStore();
      
      // Generate new session ID
      const newSessionId = generateSessionId();
      setCurrentSessionId(newSessionId);
      
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['quarterly-targets'] });
      queryClient.invalidateQueries({ queryKey: ['quarterly-targets-history'] });
      queryClient.invalidateQueries({ queryKey: ['brainstorm-targets'] });
      
      // Navigate to targets page to start fresh
      navigate('/life-targets/targets');
      
      toast.success('Quarter reset. Starting fresh!');
    },
    onError: (error) => {
      console.error('Error resetting quarter:', error);
      toast.error('Failed to reset quarter. Please try again.');
    },
  });
}
