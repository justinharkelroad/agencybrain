import { useMemo } from "react";
import { useStaffCore4Stats } from "./useStaffCore4Stats";
import { useStaffFlowStats } from "./useStaffFlowStats";
import { useStaffPlaybookStats } from "./useStaffPlaybookStats";
import { useStaffFocusItems } from "./useStaffFocusItems";
import type { WeekSummaryData, DomainAccomplishments } from "./useWeekSummary";

export function useStaffWeekSummary(weekKey: string): WeekSummaryData {
  const core4Stats = useStaffCore4Stats();
  const flowStats = useStaffFlowStats();
  const playbookStats = useStaffPlaybookStats();
  const { items, isLoading: focusLoading } = useStaffFocusItems(weekKey);

  return useMemo(() => {
    // Focus items: group completed power plays
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

    // Build domain accomplishments (Core4 entries not available for staff in detail, use points)
    const domainKeys = ["body", "being", "balance", "business"] as const;
    const domains = {} as Record<"body" | "being" | "balance" | "business", DomainAccomplishments>;
    for (const dk of domainKeys) {
      domains[dk] = {
        core4Days: 0, // staff core4 stats don't expose per-day breakdown easily
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

    return {
      core4Points: core4Stats.weeklyPoints,
      flowPoints: flowStats.weeklyProgress,
      playbookPoints: playbookStats.weeklyPoints,
      totalPoints: core4Stats.weeklyPoints + flowStats.weeklyProgress + playbookStats.weeklyPoints,
      domains,
      completedPowerPlays,
      oneBigThing,
      flowSessionCount: flowStats.weeklyProgress,
      core4Entries: [],
      loading: core4Stats.loading || flowStats.loading || playbookStats.loading || focusLoading,
    };
  }, [core4Stats, flowStats, playbookStats, items, focusLoading]);
}
