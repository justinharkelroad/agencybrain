import { useMemo } from "react";
import { useCore4Stats } from "./useCore4Stats";
import { useFlowStats } from "./useFlowStats";
import { usePlaybookStats } from "./usePlaybookStats";
import { useFocusItems } from "./useFocusItems";
import { addDays, format, startOfISOWeek, setISOWeek, setISOWeekYear } from "date-fns";

export interface DomainAccomplishments {
  core4Days: number; // how many days that domain was checked
  powerPlays: Array<{ id: string; title: string; completed: boolean; domain: string | null }>;
}

export interface WeekSummaryData {
  core4Points: number;
  flowPoints: number;
  playbookPoints: number;
  totalPoints: number;
  // Per-domain breakdowns
  domains: Record<"body" | "being" | "balance" | "business", DomainAccomplishments>;
  // Completed items grouped
  completedPowerPlays: Array<{ id: string; title: string; domain: string | null; scheduled_date: string | null }>;
  oneBigThing: { title: string; completed: boolean } | null;
  flowSessionCount: number;
  core4Entries: Array<{ date: string; body: boolean; being: boolean; balance: boolean; business: boolean }>;
  loading: boolean;
}

export function useWeekSummary(weekKey: string): WeekSummaryData {
  const core4Stats = useCore4Stats();
  const flowStats = useFlowStats();
  const playbookStats = usePlaybookStats();
  const { items, isLoading: focusLoading } = useFocusItems(weekKey);

  return useMemo(() => {
    // Parse weekKey to get Monday date using date-fns ISO week functions
    const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
    let mondayDate: Date;
    if (match) {
      const year = parseInt(match[1]);
      const week = parseInt(match[2]);
      // Create a date in the target ISO year, then set ISO week, then get Monday
      let d = new Date(year, 0, 4); // Jan 4 is always in ISO week 1
      d = setISOWeekYear(d, year);
      d = setISOWeek(d, week);
      mondayDate = startOfISOWeek(d);
    } else {
      mondayDate = startOfISOWeek(new Date());
    }

    // Core4: count per-domain days for this week
    const domainDays: Record<string, number> = { body: 0, being: 0, balance: 0, business: 0 };
    const core4Entries: WeekSummaryData["core4Entries"] = [];
    for (let i = 0; i < 7; i++) {
      const dateStr = format(addDays(mondayDate, i), "yyyy-MM-dd");
      const entry = core4Stats.getEntryForDate(dateStr);
      if (entry) {
        if (entry.body_completed) domainDays.body++;
        if (entry.being_completed) domainDays.being++;
        if (entry.balance_completed) domainDays.balance++;
        if (entry.business_completed) domainDays.business++;
        core4Entries.push({
          date: dateStr,
          body: entry.body_completed,
          being: entry.being_completed,
          balance: entry.balance_completed,
          business: entry.business_completed,
        });
      }
    }

    // Focus items: group completed power plays by domain
    const completedPowerPlays = items
      .filter((item) => item.zone === "power_play" && item.completed)
      .map((item) => ({
        id: item.id,
        title: item.title,
        domain: item.domain,
        scheduled_date: item.scheduled_date,
      }));

    const obtItem = items.find((item) => item.zone === "one_big_thing");
    const oneBigThing = obtItem ? { title: obtItem.title, completed: obtItem.completed } : null;

    // Build domain accomplishments
    const domainKeys = ["body", "being", "balance", "business"] as const;
    const domains = {} as Record<"body" | "being" | "balance" | "business", DomainAccomplishments>;
    for (const dk of domainKeys) {
      domains[dk] = {
        core4Days: domainDays[dk] || 0,
        powerPlays: items
          .filter((item) => item.domain === dk && item.zone === "power_play")
          .map((item) => ({
            id: item.id,
            title: item.title,
            completed: item.completed,
            domain: item.domain,
          })),
      };
    }

    // Flow sessions count for this week
    const flowSessionCount = flowStats.weeklyProgress;

    return {
      core4Points: core4Stats.weeklyPoints,
      flowPoints: flowStats.weeklyProgress,
      playbookPoints: playbookStats.weeklyPoints,
      totalPoints: core4Stats.weeklyPoints + flowStats.weeklyProgress + playbookStats.weeklyPoints,
      domains,
      completedPowerPlays,
      oneBigThing,
      flowSessionCount,
      core4Entries,
      loading: core4Stats.loading || flowStats.loading || playbookStats.loading || focusLoading,
    };
  }, [core4Stats, flowStats, playbookStats, items, focusLoading, weekKey]);
}
