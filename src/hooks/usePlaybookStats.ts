import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { format, startOfWeek, addDays } from "date-fns";

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

      const { data: items, error } = await supabase
        .from("focus_items")
        .select("scheduled_date, completed")
        .eq("user_id", user.id)
        .eq("zone", "power_play")
        .eq("completed", true)
        .gte("scheduled_date", mondayStr)
        .lte("scheduled_date", fridayStr);

      if (error) throw error;

      const dailyCompleted: Record<string, number> = {};
      let todayCompleted = 0;

      (items || []).forEach((item) => {
        const d = item.scheduled_date!;
        dailyCompleted[d] = (dailyCompleted[d] || 0) + 1;
        if (d === todayStr) todayCompleted++;
      });

      // Max 4 per day, max 20 per week (5 business days × 4)
      const weeklyPoints = Object.values(dailyCompleted).reduce(
        (sum, count) => sum + Math.min(count, 4),
        0
      );

      return { weeklyPoints: Math.min(weeklyPoints, 20), todayCompleted, dailyCompleted };
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
