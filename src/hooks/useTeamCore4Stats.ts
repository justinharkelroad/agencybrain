import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { startOfWeek, endOfWeek, format, subDays, isAfter, startOfDay } from 'date-fns';

interface StaffCore4Entry {
  id: string;
  staff_user_id: string;
  date: string;
  body_completed: boolean;
  being_completed: boolean;
  balance_completed: boolean;
  business_completed: boolean;
  body_note: string | null;
  being_note: string | null;
  balance_note: string | null;
  business_note: string | null;
}

interface StaffCore4Mission {
  id: string;
  staff_user_id: string;
  domain: 'body' | 'being' | 'balance' | 'business';
  title: string;
  items: Array<{ text: string; completed: boolean }>;
  weekly_measurable: string | null;
  status: 'active' | 'completed' | 'archived';
  month_year: string;
}

interface FlowSession {
  id: string;
  user_id: string;
  status: string;
  completed_at: string | null;
}

interface TeamMemberCore4Stats {
  staffUserId: string;
  teamMemberId: string;
  name: string;
  email: string | null;
  todayEntry: StaffCore4Entry | null;
  weeklyPoints: number;
  flowWeeklyProgress: number;
  combinedWeeklyPoints: number;
  streak: number;
  flowStreak: number;
  entries: StaffCore4Entry[];
  missions: StaffCore4Mission[];
}

interface TeamCore4Data {
  members: TeamMemberCore4Stats[];
  teamTotal: number;
  teamGoal: number;
  loading: boolean;
  error: Error | null;
}

export function useTeamCore4Stats(): TeamCore4Data {
  const { user, isAgencyOwner, isKeyEmployee, keyEmployeeAgencyId } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['team-core4-stats', user?.id, isAgencyOwner, isKeyEmployee],
    queryFn: async () => {
      if (!user?.id) return { members: [] };
      if (!isAgencyOwner && !isKeyEmployee) return { members: [] };

      // Get the agency ID
      let agencyId: string | null = null;

      if (isAgencyOwner) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('id', user.id)
          .maybeSingle();
        agencyId = profile?.agency_id || null;
      } else if (isKeyEmployee) {
        agencyId = keyEmployeeAgencyId;
      }

      if (!agencyId) return { members: [] };

      // Get all staff users for this agency with their team member info
      const { data: staffUsers, error: staffError } = await supabase
        .from('staff_users')
        .select('id, email, team_member_id')
        .eq('agency_id', agencyId)
        .eq('is_active', true);

      if (staffError || !staffUsers?.length) {
        console.error('Error fetching staff users:', staffError);
        return { members: [] };
      }

      // Get team member names (only those included in metrics)
      const teamMemberIds = staffUsers.map(s => s.team_member_id).filter(Boolean) as string[];
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('id, name, email')
        .in('id', teamMemberIds)
        .eq('include_in_metrics', true);

      interface TeamMemberData { id: string; name: string; email: string | null }
      const teamMemberMap = new Map<string, TeamMemberData>(
        (teamMembers || []).map(tm => [tm.id, { id: tm.id, name: tm.name, email: tm.email }])
      );

      // Calculate date ranges
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 }); // Sunday
      const thirtyDaysAgo = subDays(today, 30);

      const staffUserIds = staffUsers.map(s => s.id);
      // Note: staff_users table doesn't have a user_id column linking to auth.users
      // Flow sessions are tracked separately - this feature needs a schema update to work
      const authUserIds: string[] = [];

      // Fetch Staff Core 4 entries for all staff users (last 30 days for streak calculation)
      const { data: entries, error: entriesError } = await supabase
        .from('staff_core4_entries')
        .select('*')
        .in('staff_user_id', staffUserIds)
        .gte('date', format(thirtyDaysAgo, 'yyyy-MM-dd'))
        .lte('date', format(today, 'yyyy-MM-dd'))
        .order('date', { ascending: false });

      if (entriesError) {
        console.error('Error fetching staff core4 entries:', entriesError);
      }

      // Fetch Staff Core 4 missions for all staff users
      const currentMonthYear = format(today, 'yyyy-MM');
      const { data: missions, error: missionsError } = await supabase
        .from('staff_core4_monthly_missions')
        .select('*')
        .in('staff_user_id', staffUserIds)
        .eq('month_year', currentMonthYear)
        .eq('status', 'active');

      if (missionsError) {
        console.error('Error fetching staff core4 missions:', missionsError);
      }

      // Fetch flow sessions for staff users (using their auth user_id)
      let flowSessions: FlowSession[] = [];
      if (authUserIds.length > 0) {
        const { data: flows, error: flowsError } = await supabase
          .from('flow_sessions')
          .select('id, user_id, status, completed_at')
          .in('user_id', authUserIds)
          .eq('status', 'completed')
          .not('completed_at', 'is', null)
          .gte('completed_at', format(thirtyDaysAgo, 'yyyy-MM-dd'))
          .order('completed_at', { ascending: false });

        if (flowsError) {
          console.error('Error fetching flow sessions:', flowsError);
        } else {
          flowSessions = flows || [];
        }
      }

      // Group entries, missions, and flows by user
      const entriesByUser = new Map<string, StaffCore4Entry[]>();
      const missionsByUser = new Map<string, StaffCore4Mission[]>();
      const flowsByAuthUser = new Map<string, FlowSession[]>();

      entries?.forEach(entry => {
        const existing = entriesByUser.get(entry.staff_user_id) || [];
        entriesByUser.set(entry.staff_user_id, [...existing, entry as StaffCore4Entry]);
      });

      missions?.forEach(mission => {
        const existing = missionsByUser.get(mission.staff_user_id) || [];
        missionsByUser.set(mission.staff_user_id, [...existing, mission as StaffCore4Mission]);
      });

      flowSessions.forEach(flow => {
        const existing = flowsByAuthUser.get(flow.user_id) || [];
        flowsByAuthUser.set(flow.user_id, [...existing, flow]);
      });

      // Calculate stats for each team member (only those included in metrics)
      const members: TeamMemberCore4Stats[] = staffUsers
        .filter(staff => staff.team_member_id && teamMemberMap.has(staff.team_member_id))
        .map(staff => {
        const teamMember = teamMemberMap.get(staff.team_member_id!)!;
        const userEntries = entriesByUser.get(staff.id) || [];
        const userMissions = missionsByUser.get(staff.id) || [];
        const userFlows = staff.user_id ? (flowsByAuthUser.get(staff.user_id) || []) : [];
        
        const todayStr = format(today, 'yyyy-MM-dd');
        const todayEntry = userEntries.find(e => e.date === todayStr) || null;

        // Calculate weekly Core 4 points (sum of completed domains this week)
        const weeklyPoints = userEntries
          .filter(e => {
            const entryDate = new Date(e.date);
            return isAfter(entryDate, weekStart) || e.date === format(weekStart, 'yyyy-MM-dd');
          })
          .reduce((sum, entry) => {
            let points = 0;
            if (entry.body_completed) points++;
            if (entry.being_completed) points++;
            if (entry.balance_completed) points++;
            if (entry.business_completed) points++;
            return sum + points;
          }, 0);

        // Calculate weekly Flow progress (unique days with completed flows)
        const weekFlowDates = new Set<string>();
        userFlows.forEach(flow => {
          if (flow.completed_at) {
            const flowDate = new Date(flow.completed_at);
            const flowDay = startOfDay(flowDate);
            if (flowDay >= weekStart && flowDay <= today) {
              weekFlowDates.add(format(flowDay, 'yyyy-MM-dd'));
            }
          }
        });
        const flowWeeklyProgress = weekFlowDates.size;

        // Combined weekly points
        const combinedWeeklyPoints = weeklyPoints + flowWeeklyProgress;

        // Calculate Core 4 streak (consecutive days with 4/4)
        let streak = 0;
        const sortedEntries = [...userEntries].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        
        for (const entry of sortedEntries) {
          const isPerfect = entry.body_completed && 
                           entry.being_completed && 
                           entry.balance_completed && 
                           entry.business_completed;
          if (isPerfect) {
            streak++;
          } else {
            break;
          }
        }

        // Calculate Flow streak
        let flowStreak = 0;
        const flowDates = new Set<string>();
        userFlows.forEach(f => {
          if (f.completed_at) {
            flowDates.add(format(new Date(f.completed_at), 'yyyy-MM-dd'));
          }
        });
        
        let checkDate = startOfDay(today);
        const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');
        const todayHasFlow = flowDates.has(todayStr);
        
        if (!todayHasFlow && !flowDates.has(yesterdayStr)) {
          flowStreak = 0;
        } else {
          if (!todayHasFlow) {
            checkDate = subDays(checkDate, 1);
          }
          while (flowDates.has(format(checkDate, 'yyyy-MM-dd'))) {
            flowStreak++;
            checkDate = subDays(checkDate, 1);
          }
        }

        return {
          staffUserId: staff.id,
          teamMemberId: staff.team_member_id!,
          name: teamMember.name,
          email: staff.email ?? teamMember.email ?? null,
          todayEntry,
          weeklyPoints,
          flowWeeklyProgress,
          combinedWeeklyPoints,
          streak,
          flowStreak,
          entries: userEntries,
          missions: userMissions,
        };
      });

      return { members };
    },
    enabled: !!user?.id && (isAgencyOwner || isKeyEmployee),
    staleTime: 30000, // 30 seconds
  });

  const members = data?.members || [];
  const teamTotal = members.reduce((sum, m) => sum + m.combinedWeeklyPoints, 0);
  const teamGoal = members.length * 35; // 4 domains * 7 days + 7 flow days = 35

  return {
    members,
    teamTotal,
    teamGoal,
    loading: isLoading,
    error: error as Error | null,
  };
}
