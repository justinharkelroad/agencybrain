import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface LeaderboardEntry {
  team_member_id: string;
  name: string;
  premium: number;
  items: number;
  points: number;
  policies: number;
  households: number;
  rank?: number;
  isCurrentUser?: boolean;
}

export interface MyRank {
  rank: number;
  totalProducers: number;
  rankedBy: string;
}

export type RankMetric = "items" | "premium" | "points" | "policies" | "households";

interface UseSalesLeaderboardOptions {
  agencyId: string | null;
  currentTeamMemberId?: string | null;
  staffSessionToken?: string;
  startDate?: string;
  endDate?: string;
  rankBy?: RankMetric;
}

export function useSalesLeaderboard({
  agencyId,
  currentTeamMemberId,
  staffSessionToken,
  startDate,
  endDate,
  rankBy = "items",
}: UseSalesLeaderboardOptions) {
  // Default to current month if no dates provided
  const today = new Date();
  const defaultStart = format(startOfMonth(today), "yyyy-MM-dd");
  const defaultEnd = format(endOfMonth(today), "yyyy-MM-dd");
  const dateStart = startDate || defaultStart;
  const dateEnd = endDate || defaultEnd;

  return useQuery({
    queryKey: ["sales-leaderboard", agencyId, dateStart, dateEnd, staffSessionToken, rankBy, currentTeamMemberId],
    queryFn: async (): Promise<{
      leaderboard: LeaderboardEntry[];
      myRank: MyRank | null;
      topThree: LeaderboardEntry[];
    }> => {
      // Staff portal path - use edge function
      if (staffSessionToken) {
        const { data, error } = await supabase.functions.invoke("get_staff_sales", {
          headers: { "x-staff-session": staffSessionToken },
          body: {
            date_start: dateStart,
            date_end: dateEnd,
            include_leaderboard: true,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const rawLeaderboard: LeaderboardEntry[] = data.leaderboard || [];
        const teamMemberId = data.team_member_id;

        // Sort by the selected metric
        const sorted = sortLeaderboard(rawLeaderboard, rankBy);
        const rankedLeaderboard = addRanksAndCurrentUser(sorted, teamMemberId);
        const myRank = extractMyRank(rankedLeaderboard, teamMemberId, rankBy);
        const topThree = rankedLeaderboard.slice(0, 3);

        return { leaderboard: rankedLeaderboard, myRank, topThree };
      }

      // Owner portal path - direct RLS query
      if (!agencyId) {
        return { leaderboard: [], myRank: null, topThree: [] };
      }

      // Get all active team members (only those included in metrics)
      const { data: teamMembers, error: tmError } = await supabase
        .from("team_members")
        .select("id, name")
        .eq("agency_id", agencyId)
        .eq("status", "active")
        .eq("include_in_metrics", true);

      if (tmError) throw tmError;

      // Get all sales for the period
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select(`
          team_member_id,
          customer_name,
          total_premium,
          total_items,
          total_points,
          sale_policies(id)
        `)
        .eq("agency_id", agencyId)
        .gte("sale_date", dateStart)
        .lte("sale_date", dateEnd);

      if (salesError) throw salesError;

      // Aggregate by team member
      const aggregated: Record<string, LeaderboardEntry & { customerNames: Set<string> }> = {};

      for (const tm of teamMembers || []) {
        aggregated[tm.id] = {
          team_member_id: tm.id,
          name: tm.name,
          premium: 0,
          items: 0,
          points: 0,
          policies: 0,
          households: 0,
          customerNames: new Set(),
        };
      }

      for (const sale of sales || []) {
        const tmId = sale.team_member_id;
        if (tmId && aggregated[tmId]) {
          aggregated[tmId].premium += sale.total_premium || 0;
          aggregated[tmId].items += sale.total_items || 0;
          aggregated[tmId].points += sale.total_points || 0;
          aggregated[tmId].policies += (sale.sale_policies as any[])?.length || 0;

          const customerName = (sale as any).customer_name?.toLowerCase().trim();
          if (customerName) {
            aggregated[tmId].customerNames.add(customerName);
          }
        }
      }

      // Convert to array and calculate households
      const rawLeaderboard: LeaderboardEntry[] = Object.values(aggregated).map((entry) => ({
        team_member_id: entry.team_member_id,
        name: entry.name,
        premium: entry.premium,
        items: entry.items,
        points: entry.points,
        policies: entry.policies,
        households: entry.customerNames.size,
      }));

      // Sort and rank
      const sorted = sortLeaderboard(rawLeaderboard, rankBy);
      const rankedLeaderboard = addRanksAndCurrentUser(sorted, currentTeamMemberId || null);
      const myRank = extractMyRank(rankedLeaderboard, currentTeamMemberId || null, rankBy);
      const topThree = rankedLeaderboard.slice(0, 3);

      return { leaderboard: rankedLeaderboard, myRank, topThree };
    },
    enabled: !!agencyId || !!staffSessionToken,
  });
}

function sortLeaderboard(entries: LeaderboardEntry[], metric: RankMetric): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    switch (metric) {
      case "premium":
        return b.premium - a.premium;
      case "points":
        return b.points - a.points;
      case "policies":
        return b.policies - a.policies;
      case "households":
        return b.households - a.households;
      case "items":
      default:
        return b.items - a.items;
    }
  });
}

function addRanksAndCurrentUser(
  entries: LeaderboardEntry[],
  currentTeamMemberId: string | null
): LeaderboardEntry[] {
  return entries.map((entry, index) => ({
    ...entry,
    rank: index + 1,
    isCurrentUser: entry.team_member_id === currentTeamMemberId,
  }));
}

function extractMyRank(
  rankedEntries: LeaderboardEntry[],
  teamMemberId: string | null,
  rankBy: RankMetric
): MyRank | null {
  if (!teamMemberId) return null;

  const myEntry = rankedEntries.find((e) => e.team_member_id === teamMemberId);
  if (!myEntry || myEntry.rank === undefined) return null;

  return {
    rank: myEntry.rank,
    totalProducers: rankedEntries.length,
    rankedBy: rankBy,
  };
}
