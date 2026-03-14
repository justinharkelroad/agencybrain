import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { format, startOfWeek, addDays } from "date-fns";
import { getWeekKey } from "@/lib/date-utils";

export interface PlaybookStats {
  weeklyPoints: number;
  todayCompleted: number;
  dailyCompleted: Record<string, number>;
  loading: boolean;
}

export function usePlaybookStats(): PlaybookStats {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["playbook-stats", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const today = new Date();
      const monday = startOfWeek(today, { weekStartsOn: 1 });
      const friday = addDays(monday, 4);
      const todayStr = format(today, "yyyy-MM-dd");
      const mondayStr = format(monday, "yyyy-MM-dd");
      const fridayStr = format(friday, "yyyy-MM-dd");

      // Fetch completed power plays
      const { data: items, error } = await supabase
        .from("focus_items")
        .select("scheduled_date, completed")
        .eq("user_id", user.id)
        .eq("zone", "power_play")
        .eq("completed", true)
        .gte("scheduled_date", mondayStr)
        .lte("scheduled_date", fridayStr);

      if (error) throw error;

      // Check if One Big Thing is completed this week
      const weekKey = getWeekKey(monday);
      const { data: obtItems } = await supabase
        .from("focus_items")
        .select("completed")
        .eq("user_id", user.id)
        .eq("zone", "one_big_thing")
        .eq("week_key", weekKey)
        .eq("completed", true)
        .limit(1);

      const obtPoint = (obtItems && obtItems.length > 0) ? 1 : 0;

      const dailyCompleted: Record<string, number> = {};
      let todayCompleted = 0;

      (items || []).forEach((item) => {
        const d = item.scheduled_date!;
        dailyCompleted[d] = (dailyCompleted[d] || 0) + 1;
        if (d === todayStr) todayCompleted++;
      });

      // Max 4 per day × 5 days = 20, plus 1 for OBT = 21 max
      const powerPlayPoints = Object.values(dailyCompleted).reduce(
        (sum, count) => sum + Math.min(count, 4),
        0
      );

      return { weeklyPoints: Math.min(powerPlayPoints, 20) + obtPoint, todayCompleted, dailyCompleted };
    },
    enabled: !!user?.id,
  });

  return {
    weeklyPoints: data?.weeklyPoints ?? 0,
    todayCompleted: data?.todayCompleted ?? 0,
    dailyCompleted: data?.dailyCompleted ?? {},
    loading: isLoading,
  };
}
