import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { format, startOfWeek, addDays } from "date-fns";
import type { PlaybookStats } from "./usePlaybookStats";

export function useStaffPlaybookStats(): PlaybookStats {
  const { sessionToken, user } = useStaffAuth();
  const teamMemberId = user?.team_member_id;

  const { data, isLoading } = useQuery({
    queryKey: ["staff-playbook-stats", teamMemberId],
    queryFn: async () => {
      if (!sessionToken || !teamMemberId) return null;

      const today = new Date();
      const monday = startOfWeek(today, { weekStartsOn: 1 });
      const friday = addDays(monday, 4);
      const todayStr = format(today, "yyyy-MM-dd");
      const mondayStr = format(monday, "yyyy-MM-dd");
      const fridayStr = format(friday, "yyyy-MM-dd");

      const { data: result, error } = await supabase.functions.invoke("get_staff_team_data", {
        headers: { "x-staff-session": sessionToken },
        body: {
          type: "playbook_stats",
          monday: mondayStr,
          friday: fridayStr,
        },
      });

      if (error) throw error;

      const items = (result?.items || []) as Array<{ scheduled_date: string; completed: boolean }>;
      const dailyCompleted: Record<string, number> = {};
      let todayCompleted = 0;

      items.forEach((item) => {
        const d = item.scheduled_date;
        dailyCompleted[d] = (dailyCompleted[d] || 0) + 1;
        if (d === todayStr) todayCompleted++;
      });

      const weeklyPoints = Object.values(dailyCompleted).reduce(
        (sum, count) => sum + Math.min(count, 4),
        0
      );

      return { weeklyPoints: Math.min(weeklyPoints, 20), todayCompleted, dailyCompleted };
    },
    enabled: !!sessionToken && !!teamMemberId,
  });

  return {
    weeklyPoints: data?.weeklyPoints ?? 0,
    todayCompleted: data?.todayCompleted ?? 0,
    dailyCompleted: data?.dailyCompleted ?? {},
    loading: isLoading,
  };
}
