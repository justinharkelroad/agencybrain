import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { format, startOfWeek, addDays, subWeeks, startOfYear } from "date-fns";
import { getWeekKey } from "@/lib/date-utils";

export interface WeeklyScoreSnapshot {
  week_key: string;
  total_points: number;
  core4_points: number;
  flow_points: number;
  playbook_points: number;
}

export interface DailyBreakdown {
  date: string;
  dayLabel: string;
  core4: number; // 0-4
  flow: number; // 0 or 1
  playbook: number; // 0-4 power plays completed
}

export interface CategoryStats {
  current: number;
  max: number;
  pct: number;
  delta: number; // vs previous week, in points
  deltaPct: number; // vs previous week, in percentage points
}

export interface DebriefStatsData {
  // Current week
  total: CategoryStats;
  core4: CategoryStats;
  flow: CategoryStats;
  playbook: CategoryStats;
  // Compare to
  previousWeek: number;
  fourWeekAvg: number;
  yearAvg: number;
  overallAvg: number;
  // Daily breakdown for current week
  dailyBreakdown: DailyBreakdown[];
  // Historical averages per weekday (Mon-Sun)
  weekdayAverages: Array<{ day: string; core4: number; flow: number; playbook: number }>;
  // Loading
  loading: boolean;
}

export function useDebriefStats(weekKey: string): DebriefStatsData {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["debrief-stats", user?.id, weekKey],
    queryFn: async () => {
      if (!user?.id) return null;

      // 1. Fetch all completed weekly reviews for historical data
      const { data: reviews } = await supabase
        .from("weekly_reviews")
        .select("week_key, total_points, core4_points, flow_points, playbook_points")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("week_key", { ascending: false });

      const allReviews = (reviews || []) as WeeklyScoreSnapshot[];

      // 2. Get current week's live data
      const now = new Date();
      const monday = startOfWeek(now, { weekStartsOn: 1 });

      // Core4 entries for the week
      const mondayStr = format(monday, "yyyy-MM-dd");
      const sundayStr = format(addDays(monday, 6), "yyyy-MM-dd");

      const { data: core4Entries } = await supabase
        .from("core4_entries")
        .select("date, body_completed, being_completed, balance_completed, business_completed")
        .eq("user_id", user.id)
        .gte("date", mondayStr)
        .lte("date", sundayStr);

      // Flow sessions for the week
      const { data: flowSessions } = await supabase
        .from("flow_sessions")
        .select("completed_at")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .not("completed_at", "is", null)
        .gte("completed_at", mondayStr + "T00:00:00")
        .lte("completed_at", sundayStr + "T23:59:59");

      // Power plays completed for the week
      const { data: powerPlays } = await supabase
        .from("focus_items")
        .select("scheduled_date, completed")
        .eq("user_id", user.id)
        .eq("zone", "power_play")
        .eq("completed", true)
        .gte("scheduled_date", mondayStr)
        .lte("scheduled_date", sundayStr);

      // OBT completion
      const { data: obtItems } = await supabase
        .from("focus_items")
        .select("completed")
        .eq("user_id", user.id)
        .eq("zone", "one_big_thing")
        .eq("week_key", weekKey)
        .eq("completed", true)
        .limit(1);

      const obtPoint = (obtItems && obtItems.length > 0) ? 1 : 0;

      // Build daily breakdown
      const dailyBreakdown: DailyBreakdown[] = [];
      const flowDates = new Set<string>();
      (flowSessions || []).forEach((s) => {
        const d = format(new Date(s.completed_at), "yyyy-MM-dd");
        flowDates.add(d);
      });

      const ppByDay: Record<string, number> = {};
      (powerPlays || []).forEach((pp) => {
        if (pp.scheduled_date) {
          ppByDay[pp.scheduled_date] = (ppByDay[pp.scheduled_date] || 0) + 1;
        }
      });

      let currentCore4 = 0;
      let currentFlow = 0;
      let currentPlaybook = 0;

      for (let i = 0; i < 7; i++) {
        const date = addDays(monday, i);
        const dateStr = format(date, "yyyy-MM-dd");
        const dayLabel = format(date, "EEE");

        const c4Entry = (core4Entries || []).find((e) => e.date === dateStr);
        const c4Points = c4Entry
          ? (c4Entry.body_completed ? 1 : 0) +
            (c4Entry.being_completed ? 1 : 0) +
            (c4Entry.balance_completed ? 1 : 0) +
            (c4Entry.business_completed ? 1 : 0)
          : 0;

        const flowPoint = flowDates.has(dateStr) ? 1 : 0;
        const ppCount = Math.min(ppByDay[dateStr] || 0, 4);

        currentCore4 += c4Points;
        currentFlow += flowPoint;
        currentPlaybook += ppCount;

        dailyBreakdown.push({
          date: dateStr,
          dayLabel,
          core4: c4Points,
          flow: flowPoint,
          playbook: ppCount,
        });
      }

      currentPlaybook += obtPoint; // Add OBT to playbook total
      const currentTotal = currentCore4 + currentFlow + currentPlaybook;

      // Fetch historical raw tracking data for comparison scores
      // (covers weeks before the debrief feature existed)
      const lookbackStart = format(subWeeks(monday, 52), "yyyy-MM-dd");

      const [histC4Res, histFlowRes, histPPRes, histOBTRes] = await Promise.all([
        supabase.from("core4_entries")
          .select("date, body_completed, being_completed, balance_completed, business_completed")
          .eq("user_id", user.id)
          .gte("date", lookbackStart),
        supabase.from("flow_sessions")
          .select("completed_at")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .not("completed_at", "is", null)
          .gte("completed_at", lookbackStart + "T00:00:00"),
        supabase.from("focus_items")
          .select("scheduled_date")
          .eq("user_id", user.id)
          .eq("zone", "power_play")
          .eq("completed", true)
          .gte("scheduled_date", lookbackStart),
        supabase.from("focus_items")
          .select("week_key")
          .eq("user_id", user.id)
          .eq("zone", "one_big_thing")
          .eq("completed", true),
      ]);

      // Group raw data into synthetic weekly totals
      const syntheticWeeks = new Map<string, { core4: number; flow: number; playbook: number }>();

      (histC4Res.data || []).forEach((e) => {
        const wk = getWeekKey(new Date(e.date + "T12:00:00"));
        if (!syntheticWeeks.has(wk)) syntheticWeeks.set(wk, { core4: 0, flow: 0, playbook: 0 });
        syntheticWeeks.get(wk)!.core4 +=
          (e.body_completed ? 1 : 0) + (e.being_completed ? 1 : 0) +
          (e.balance_completed ? 1 : 0) + (e.business_completed ? 1 : 0);
      });

      // Deduplicate flow sessions by date (max 1 point per day)
      const flowByWeek = new Map<string, Set<string>>();
      (histFlowRes.data || []).forEach((s) => {
        const d = format(new Date(s.completed_at), "yyyy-MM-dd");
        const wk = getWeekKey(new Date(s.completed_at));
        if (!flowByWeek.has(wk)) flowByWeek.set(wk, new Set());
        flowByWeek.get(wk)!.add(d);
      });
      flowByWeek.forEach((dates, wk) => {
        if (!syntheticWeeks.has(wk)) syntheticWeeks.set(wk, { core4: 0, flow: 0, playbook: 0 });
        syntheticWeeks.get(wk)!.flow = dates.size;
      });

      (histPPRes.data || []).forEach((pp) => {
        if (!pp.scheduled_date) return;
        const wk = getWeekKey(new Date(pp.scheduled_date + "T12:00:00"));
        if (!syntheticWeeks.has(wk)) syntheticWeeks.set(wk, { core4: 0, flow: 0, playbook: 0 });
        syntheticWeeks.get(wk)!.playbook += 1;
      });

      (histOBTRes.data || []).forEach((obt) => {
        if (!obt.week_key) return;
        if (!syntheticWeeks.has(obt.week_key))
          syntheticWeeks.set(obt.week_key, { core4: 0, flow: 0, playbook: 0 });
        syntheticWeeks.get(obt.week_key)!.playbook += 1;
      });

      // Merge: prefer completed weekly_reviews, fall back to synthetic scores
      const reviewWeekSet = new Set(allReviews.map((r) => r.week_key));
      const allWeekKeys = new Set([...Array.from(syntheticWeeks.keys()), ...Array.from(reviewWeekSet)]);
      const mergedSnapshots: WeeklyScoreSnapshot[] = [];
      allWeekKeys.forEach((wk) => {
        if (wk === weekKey) return; // Exclude current week
        const review = allReviews.find((r) => r.week_key === wk);
        if (review) {
          mergedSnapshots.push(review);
        } else {
          const s = syntheticWeeks.get(wk);
          if (s && s.core4 + s.flow + s.playbook > 0) {
            mergedSnapshots.push({
              week_key: wk,
              core4_points: s.core4,
              flow_points: s.flow,
              playbook_points: s.playbook,
              total_points: s.core4 + s.flow + s.playbook,
            });
          }
        }
      });

      // Find previous week in merged data
      const prevWeekMatch = weekKey.match(/^(\d{4})-W(\d{2})$/);
      let prevWeekKey = "";
      if (prevWeekMatch) {
        const yr = parseInt(prevWeekMatch[1]);
        const wk = parseInt(prevWeekMatch[2]);
        prevWeekKey = wk <= 1 ? `${yr - 1}-W52` : `${yr}-W${String(wk - 1).padStart(2, "0")}`;
      }

      const prevReview = mergedSnapshots.find((r) => r.week_key === prevWeekKey);
      const prevTotal = prevReview?.total_points ?? 0;
      const prevCore4 = prevReview?.core4_points ?? 0;
      const prevFlow = prevReview?.flow_points ?? 0;
      const prevPlaybook = prevReview?.playbook_points ?? 0;

      // Calculate averages from merged data (reviews + synthetic)
      const recentSnapshots = mergedSnapshots.filter((r) => r.week_key >= getWeekKey(subWeeks(now, 4)));
      const yearSnapshots = mergedSnapshots.filter((r) => r.week_key >= getWeekKey(startOfYear(now)));

      const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

      const fourWeekAvg = avg(recentSnapshots.map((r) => r.total_points));
      const yearAvg = avg(yearSnapshots.map((r) => r.total_points));
      const overallAvg = avg(mergedSnapshots.map((r) => r.total_points));

      // Weekday averages from historical Core4 data (reuse already-fetched data)
      const weekdayTotals: Array<{ core4Sum: number; count: number }> = Array.from({ length: 7 }, () => ({
        core4Sum: 0,
        count: 0,
      }));

      (histC4Res.data || []).forEach((entry) => {
        const d = new Date(entry.date + "T12:00:00");
        const dow = (d.getDay() + 6) % 7; // Convert Sun=0 to Mon=0
        const pts =
          (entry.body_completed ? 1 : 0) +
          (entry.being_completed ? 1 : 0) +
          (entry.balance_completed ? 1 : 0) +
          (entry.business_completed ? 1 : 0);
        weekdayTotals[dow].core4Sum += pts;
        weekdayTotals[dow].count++;
      });

      const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const weekdayAverages = dayLabels.map((day, i) => ({
        day,
        core4: weekdayTotals[i].count > 0 ? parseFloat((weekdayTotals[i].core4Sum / weekdayTotals[i].count).toFixed(1)) : 0,
        flow: 0,
        playbook: 0,
      }));

      const makeStat = (current: number, max: number, prev: number): CategoryStats => ({
        current,
        max,
        pct: max > 0 ? Math.round((current / max) * 100) : 0,
        delta: current - prev,
        deltaPct: max > 0 ? Math.round(((current - prev) / max) * 100) : 0,
      });

      return {
        total: makeStat(currentTotal, 56, prevTotal),
        core4: makeStat(currentCore4, 28, prevCore4),
        flow: makeStat(currentFlow, 7, prevFlow),
        playbook: makeStat(currentPlaybook, 21, prevPlaybook),
        previousWeek: prevTotal,
        fourWeekAvg: parseFloat(fourWeekAvg.toFixed(1)),
        yearAvg: parseFloat(yearAvg.toFixed(1)),
        overallAvg: parseFloat(overallAvg.toFixed(1)),
        dailyBreakdown,
        weekdayAverages,
      };
    },
    enabled: !!user?.id,
  });

  if (!data) {
    return {
      total: { current: 0, max: 56, pct: 0, delta: 0, deltaPct: 0 },
      core4: { current: 0, max: 28, pct: 0, delta: 0, deltaPct: 0 },
      flow: { current: 0, max: 7, pct: 0, delta: 0, deltaPct: 0 },
      playbook: { current: 0, max: 21, pct: 0, delta: 0, deltaPct: 0 },
      previousWeek: 0,
      fourWeekAvg: 0,
      yearAvg: 0,
      overallAvg: 0,
      dailyBreakdown: [],
      weekdayAverages: [],
      loading: isLoading,
    };
  }

  return { ...data, loading: isLoading };
}
