import { useEffect, useRef } from "react";
import { useLifeTargetsStore } from "@/lib/lifeTargetsStore";
import { useQuarterlyTargetsHistory } from "./useQuarterlyTargetsHistory";
import { toast } from "sonner";
import { formatQuarterDisplay } from "@/lib/quarterUtils";

/**
 * Hook to automatically switch to a quarter with data if current quarter is empty.
 * Only auto-switches ONCE per session to prevent race conditions.
 */
export function useQuarterAutoSwitch(currentQuarterHasData: boolean, isLoading: boolean) {
  const { currentQuarter, setCurrentQuarter, hasAutoSwitchedThisSession, setHasAutoSwitchedThisSession } = useLifeTargetsStore();
  const { data: history } = useQuarterlyTargetsHistory();
  const currentQuarterRef = useRef(currentQuarter);

  // Update ref without triggering re-render
  useEffect(() => {
    currentQuarterRef.current = currentQuarter;
  }, [currentQuarter]);

  useEffect(() => {
    // GATE: Only auto-switch once per session
    if (hasAutoSwitchedThisSession) {
      return;
    }

    // Don't auto-switch while loading or if current quarter has data
    if (isLoading || currentQuarterHasData) return;
    
    // Check if user has data in any other quarters
    if (history && history.length > 0) {
      const quartersWithData = history.filter(h => h.quarter !== currentQuarterRef.current);
      
      if (quartersWithData.length > 0) {
        // Switch to the most recent quarter with data
        const mostRecentQuarter = quartersWithData[0].quarter;
        
        console.log(`Auto-switching from ${currentQuarterRef.current} (empty) to ${mostRecentQuarter} (has data)`);
        
        setCurrentQuarter(mostRecentQuarter);
        setHasAutoSwitchedThisSession(true);
        
        toast.info(
          `Switched to ${formatQuarterDisplay(mostRecentQuarter)} where your plan is stored`,
          { duration: 5000 }
        );
      }
    }
    // Intentionally NOT including currentQuarter in deps to prevent race condition
  }, [currentQuarterHasData, isLoading, history, setCurrentQuarter, hasAutoSwitchedThisSession, setHasAutoSwitchedThisSession]);
}
