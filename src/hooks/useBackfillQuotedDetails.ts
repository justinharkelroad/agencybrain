import { useState } from 'react';
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

interface BackfillResult {
  success: boolean;
  result?: {
    processed_count: number;
    error_count: number;
    agency_id: string;
    days_back: number;
  };
  error?: string;
}

export function useBackfillQuotedDetails() {
  const [isLoading, setIsLoading] = useState(false);

  const backfill = async (agencySlug: string, daysBack: number = 30): Promise<BackfillResult> => {
    setIsLoading(true);
    
    try {
      // Get current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("No authentication session found");
      }

      // Call the backfill edge function
      const response = await fetch(
        `https://wjqyccbytctqwceuhzhk.supabase.co/functions/v1/backfill_quoted_details`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcXljY2J5dGN0cXdjZXVoemhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyNjQwODEsImV4cCI6MjA2OTg0MDA4MX0.GN9SjnDf3jwFTzsO_83ZYe4iqbkRQJutGZJtapq6-Tw",
          },
          body: JSON.stringify({ agencySlug, daysBack })
        }
      );

      if (!response.ok) {
        throw new Error(`Backfill API error ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        toast.success(`Backfill completed: ${result.result.processed_count} submissions processed`);
      } else {
        toast.error(`Backfill failed: ${result.error}`);
      }

      return result;

    } catch (error) {
      console.error('Backfill error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Backfill failed: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    backfill,
    isLoading
  };
}