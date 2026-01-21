import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";

export interface SalesStreak {
  current: number;
  longest: number;
  lastSaleDate: string | null;
}

interface UseSalesStreakOptions {
  agencyId: string | null;
  teamMemberId?: string | null;
}

function calculateStreak(saleDates: string[]): SalesStreak {
  if (saleDates.length === 0) {
    return { current: 0, longest: 0, lastSaleDate: null };
  }

  // Get unique dates and sort descending (most recent first)
  const uniqueDates = [...new Set(saleDates)].sort((a, b) => b.localeCompare(a));
  const lastSaleDate = uniqueDates[0];

  // Calculate current streak (consecutive days from most recent)
  let currentStreak = 1;
  const today = format(new Date(), "yyyy-MM-dd");

  // If last sale wasn't today or yesterday, streak is broken
  const lastSale = new Date(lastSaleDate);
  const todayDate = new Date(today);
  const daysDiff = Math.floor(
    (todayDate.getTime() - lastSale.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysDiff > 1) {
    // Streak is broken (more than 1 day gap)
    currentStreak = 0;
  } else {
    // Count consecutive days backwards
    for (let i = 1; i < uniqueDates.length; i++) {
      const prevDate = new Date(uniqueDates[i - 1]);
      const currDate = new Date(uniqueDates[i]);
      const diff = Math.floor(
        (prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diff === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak ever
  let longestStreak = 1;
  let tempStreak = 1;

  // Sort ascending for longest streak calculation
  const sortedAsc = [...uniqueDates].sort((a, b) => a.localeCompare(b));

  for (let i = 1; i < sortedAsc.length; i++) {
    const prevDate = new Date(sortedAsc[i - 1]);
    const currDate = new Date(sortedAsc[i]);
    const diff = Math.floor(
      (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diff === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }

  return {
    current: currentStreak,
    longest: Math.max(longestStreak, currentStreak),
    lastSaleDate,
  };
}

export function useSalesStreak({
  agencyId,
  teamMemberId,
}: UseSalesStreakOptions) {
  // Look back 90 days for streak calculation
  const lookbackDate = format(subDays(new Date(), 90), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["sales-streak", agencyId, teamMemberId, lookbackDate],
    queryFn: async (): Promise<SalesStreak> => {
      if (!agencyId) {
        return { current: 0, longest: 0, lastSaleDate: null };
      }

      let query = supabase
        .from("sales")
        .select("sale_date")
        .eq("agency_id", agencyId)
        .gte("sale_date", lookbackDate)
        .order("sale_date", { ascending: false });

      if (teamMemberId) {
        query = query.eq("team_member_id", teamMemberId);
      }

      const { data: sales, error } = await query;

      if (error) {
        throw error;
      }

      const saleDates = (sales || []).map((s) => s.sale_date);
      return calculateStreak(saleDates);
    },
    enabled: !!agencyId,
  });
}
