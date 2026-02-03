import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";

export interface DailyMetricRow {
  id: string;
  date: string;
  team_member_id: string;
  team_member_name: string;
  outbound_calls: number;
  talk_minutes: number;
  quoted_count: number;
  sold_items: number;
  sold_policies: number;
  sold_premium_cents: number;
  cross_sells_uncovered: number;
  mini_reviews: number;
  pass: boolean;
  daily_score: number;
  streak_count: number;
  role: string | null;
}

export interface DailyMetricsSummary {
  totalDays: number;
  totalCalls: number;
  totalTalkMinutes: number;
  totalQuoted: number;
  totalSoldItems: number;
  totalSoldPolicies: number;
  totalPremium: number;
  totalCrossSells: number;
  totalMiniReviews: number;
  passDays: number;
  passRate: number;
  avgDailyScore: number;
}

interface UseSalespersonDailyMetricsOptions {
  agencyId: string;
  teamMemberId?: string | null;
  startDate: Date;
  endDate: Date;
  role?: "Sales" | "Service";
}

export function useSalespersonDailyMetrics({
  agencyId,
  teamMemberId,
  startDate,
  endDate,
  role,
}: UseSalespersonDailyMetricsOptions) {
  return useQuery({
    queryKey: [
      "salesperson-daily-metrics",
      agencyId,
      teamMemberId,
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
      role,
    ],
    queryFn: async (): Promise<{ rows: DailyMetricRow[]; summary: DailyMetricsSummary }> => {
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      // Build query with team_members join
      let query = supabase
        .from("metrics_daily")
        .select(`
          id,
          date,
          team_member_id,
          outbound_calls,
          talk_minutes,
          quoted_count,
          sold_items,
          sold_policies,
          sold_premium_cents,
          cross_sells_uncovered,
          mini_reviews,
          pass,
          daily_score,
          streak_count,
          role,
          team_members!inner(name)
        `)
        .eq("agency_id", agencyId)
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .order("date", { ascending: false });

      // Filter by team member if specified
      if (teamMemberId) {
        query = query.eq("team_member_id", teamMemberId);
      }

      // Filter by role if specified
      if (role) {
        query = query.eq("role", role);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Define the shape of the raw row from Supabase
      type RawMetricRow = {
        id: string;
        date: string;
        team_member_id: string;
        outbound_calls: number | null;
        talk_minutes: number | null;
        quoted_count: number | null;
        sold_items: number | null;
        sold_policies: number | null;
        sold_premium_cents: number | null;
        cross_sells_uncovered: number | null;
        mini_reviews: number | null;
        pass: boolean | null;
        daily_score: number | null;
        streak_count: number | null;
        role: string | null;
        team_members: { name: string } | null;
      };

      // Transform data to include team_member_name
      const rows: DailyMetricRow[] = (data || []).map((row: RawMetricRow) => ({
        id: row.id,
        date: row.date,
        team_member_id: row.team_member_id,
        team_member_name: row.team_members?.name || "Unknown",
        outbound_calls: row.outbound_calls || 0,
        talk_minutes: row.talk_minutes || 0,
        quoted_count: row.quoted_count || 0,
        sold_items: row.sold_items || 0,
        sold_policies: row.sold_policies || 0,
        sold_premium_cents: row.sold_premium_cents || 0,
        cross_sells_uncovered: row.cross_sells_uncovered || 0,
        mini_reviews: row.mini_reviews || 0,
        pass: row.pass || false,
        daily_score: row.daily_score || 0,
        streak_count: row.streak_count || 0,
        role: row.role,
      }));

      // Calculate summary
      const summary = calculateSummary(rows);

      return { rows, summary };
    },
    enabled: !!agencyId,
    staleTime: 30000, // 30 seconds
  });
}

function calculateSummary(rows: DailyMetricRow[]): DailyMetricsSummary {
  // Count unique dates (not total rows, since multiple team members can have entries per day)
  const uniqueDates = new Set(rows.map((r) => r.date));
  const totalDays = uniqueDates.size;

  // Count pass days - a day counts as a pass if ANY team member passed that day
  // For individual view, this is straightforward; for "all team members" view,
  // we count how many unique dates had at least one pass
  const datesWithPass = new Set(rows.filter((r) => r.pass).map((r) => r.date));
  const passDays = datesWithPass.size;

  // Total submissions (rows) for calculating averages per submission
  const totalSubmissions = rows.length;

  return {
    totalDays,
    totalCalls: rows.reduce((sum, r) => sum + r.outbound_calls, 0),
    totalTalkMinutes: rows.reduce((sum, r) => sum + r.talk_minutes, 0),
    totalQuoted: rows.reduce((sum, r) => sum + r.quoted_count, 0),
    totalSoldItems: rows.reduce((sum, r) => sum + r.sold_items, 0),
    totalSoldPolicies: rows.reduce((sum, r) => sum + r.sold_policies, 0),
    totalPremium: rows.reduce((sum, r) => sum + r.sold_premium_cents, 0),
    totalCrossSells: rows.reduce((sum, r) => sum + r.cross_sells_uncovered, 0),
    totalMiniReviews: rows.reduce((sum, r) => sum + r.mini_reviews, 0),
    passDays,
    passRate: totalDays > 0 ? Math.round((passDays / totalDays) * 100) : 0,
    avgDailyScore:
      totalSubmissions > 0
        ? Math.round((rows.reduce((sum, r) => sum + r.daily_score, 0) / totalSubmissions) * 10) / 10
        : 0,
  };
}
