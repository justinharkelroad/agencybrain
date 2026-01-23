import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Users, CheckCircle, Target, Flame } from "lucide-react";

export function ChallengeAnalyticsTab() {
  // Fetch overall stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ["challenge-analytics"],
    queryFn: async () => {
      // Get assignment counts
      const { data: assignments } = await supabase
        .from("challenge_assignments")
        .select("id, status");

      // Get progress data
      const { data: progress } = await supabase
        .from("challenge_progress")
        .select("id, status, completed_at");

      // Get Core 4 logs
      const { data: core4Logs } = await supabase
        .from("challenge_core4_logs")
        .select("id, body, being, balance, business");

      const totalAssignments = assignments?.length || 0;
      const activeAssignments = assignments?.filter(a => a.status === 'active').length || 0;
      const completedAssignments = assignments?.filter(a => a.status === 'completed').length || 0;

      const totalLessonsCompleted = progress?.filter(p => p.status === 'completed').length || 0;
      const totalLessonsStarted = progress?.filter(p => p.status === 'in_progress' || p.status === 'completed').length || 0;

      // Core 4 completion stats
      const core4Total = core4Logs?.length || 0;
      const core4FullDays = core4Logs?.filter(
        log => log.body && log.being && log.balance && log.business
      ).length || 0;

      return {
        totalAssignments,
        activeAssignments,
        completedAssignments,
        completionRate: totalAssignments > 0 
          ? Math.round((completedAssignments / totalAssignments) * 100) 
          : 0,
        totalLessonsCompleted,
        totalLessonsStarted,
        core4Total,
        core4FullDays,
        core4Rate: core4Total > 0 
          ? Math.round((core4FullDays / core4Total) * 100) 
          : 0,
      };
    },
  });

  // Fetch completion by week
  const { data: weeklyProgress } = useQuery({
    queryKey: ["challenge-weekly-progress"],
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_progress")
        .select(`
          status,
          challenge_lessons!inner (
            week_number
          )
        `)
        .eq("status", "completed");

      // Group by week
      const weekCounts: Record<number, number> = {};
      data?.forEach((p: any) => {
        const week = p.challenge_lessons?.week_number || 1;
        weekCounts[week] = (weekCounts[week] || 0) + 1;
      });

      return Array.from({ length: 6 }, (_, i) => ({
        week: i + 1,
        completions: weekCounts[i + 1] || 0,
      }));
    },
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Total Participants</CardDescription>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalAssignments || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.activeAssignments || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Completion Rate</CardDescription>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.completionRate || 0}%</div>
            <Progress value={stats?.completionRate || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Lessons Completed</CardDescription>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalLessonsCompleted || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.totalLessonsStarted || 0} started
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Core 4 Completion</CardDescription>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.core4Rate || 0}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.core4FullDays || 0} perfect days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Progress by Week
          </CardTitle>
          <CardDescription>Lesson completions per week across all participants</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {weeklyProgress?.map((week) => (
              <div key={week.week} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Week {week.week}</span>
                  <span className="text-muted-foreground">{week.completions} completions</span>
                </div>
                <Progress 
                  value={weeklyProgress ? (week.completions / Math.max(...weeklyProgress.map(w => w.completions), 1)) * 100 : 0} 
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
