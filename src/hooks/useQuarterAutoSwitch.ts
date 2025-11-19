import { useEffect } from "react";
import { useLifeTargetsStore } from "@/lib/lifeTargetsStore";
import { useQuarterlyTargetsHistory } from "./useQuarterlyTargetsHistory";
import { toast } from "sonner";
import { formatQuarterDisplay } from "@/lib/quarterUtils";

/**
 * Hook to automatically switch to a quarter with data if current quarter is empty
 */
export function useQuarterAutoSwitch(currentQuarterHasData: boolean, isLoading: boolean) {
  const { currentQuarter, setCurrentQuarter } = useLifeTargetsStore();
  const { data: history } = useQuarterlyTargetsHistory();

  useEffect(() => {
    // Don't auto-switch while loading or if current quarter has data
    if (isLoading || currentQuarterHasData) return;
    
    // Check if user has data in any other quarters
    if (history && history.length > 0) {
      const quartersWithData = history.filter(h => h.quarter !== currentQuarter);
      
      if (quartersWithData.length > 0) {
        // Switch to the most recent quarter with data
        const mostRecentQuarter = quartersWithData[0].quarter;
        
        console.log(`Auto-switching from ${currentQuarter} (empty) to ${mostRecentQuarter} (has data)`);
        
        setCurrentQuarter(mostRecentQuarter);
        
        toast.info(
          `Switched to ${formatQuarterDisplay(mostRecentQuarter)} where your plan is stored`,
          { duration: 5000 }
        );
      }
    }
  }, [currentQuarterHasData, isLoading, history, currentQuarter, setCurrentQuarter]);
}
