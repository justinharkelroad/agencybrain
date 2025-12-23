import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { startOfWeek, endOfWeek, format, subDays, isAfter } from 'date-fns';

interface Core4Entry {
  id: string;
  user_id: string;
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

interface Core4Mission {
  id: string;
  user_id: string;
  domain: 'body' | 'being' | 'balance' | 'business';
  title: string;
  items: Array<{ text: string; completed: boolean }>;
  weekly_measurable: string | null;
  status: 'active' | 'completed' | 'archived';
  month_year: string;
}

interface TeamMemberCore4Stats {
  userId: string;
  teamMemberId: string;
  name: string;
  email: string | null;
  todayEntry: Core4Entry | null;
  weeklyPoints: number;
  streak: number;
  entries: Core4Entry[];
  missions: Core4Mission[];
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

      // Get team member names
      const teamMemberIds = staffUsers.map(s => s.team_member_id).filter(Boolean) as string[];
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('id, name, email')
        .in('id', teamMemberIds);

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

      // Fetch Core 4 entries for all staff users (last 30 days for streak calculation)
      const { data: entries, error: entriesError } = await supabase
        .from('core4_entries')
        .select('*')
        .in('user_id', staffUserIds)
        .gte('date', format(thirtyDaysAgo, 'yyyy-MM-dd'))
        .lte('date', format(today, 'yyyy-MM-dd'))
        .order('date', { ascending: false });

      if (entriesError) {
        console.error('Error fetching core4 entries:', entriesError);
      }

      // Fetch Core 4 missions for all staff users
      const currentMonthYear = format(today, 'yyyy-MM');
      const { data: missions, error: missionsError } = await supabase
        .from('core4_monthly_missions')
        .select('*')
        .in('user_id', staffUserIds)
        .eq('month_year', currentMonthYear)
        .eq('status', 'active');

      if (missionsError) {
        console.error('Error fetching core4 missions:', missionsError);
      }

      // Group entries and missions by user
      const entriesByUser = new Map<string, Core4Entry[]>();
      const missionsByUser = new Map<string, Core4Mission[]>();

      entries?.forEach(entry => {
        const existing = entriesByUser.get(entry.user_id) || [];
        entriesByUser.set(entry.user_id, [...existing, entry]);
      });

      missions?.forEach(mission => {
        const existing = missionsByUser.get(mission.user_id) || [];
        missionsByUser.set(mission.user_id, [...existing, mission]);
      });

      // Calculate stats for each team member
      const members: TeamMemberCore4Stats[] = staffUsers.map(staff => {
        const teamMember = staff.team_member_id ? teamMemberMap.get(staff.team_member_id) : undefined;
        const userEntries = entriesByUser.get(staff.id) || [];
        const userMissions = missionsByUser.get(staff.id) || [];
        
        const todayStr = format(today, 'yyyy-MM-dd');
        const todayEntry = userEntries.find(e => e.date === todayStr) || null;

        // Calculate weekly points (sum of completed domains this week)
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

        // Calculate streak (consecutive days with 4/4)
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

        return {
          userId: staff.id,
          teamMemberId: staff.team_member_id!,
          name: teamMember?.name ?? staff.email ?? 'Unknown',
          email: staff.email ?? teamMember?.email ?? null,
          todayEntry,
          weeklyPoints,
          streak,
          entries: userEntries,
          missions: userMissions,
        };
      }).filter(m => m.teamMemberId); // Only include users with team member links

      return { members };
    },
    enabled: !!user?.id && (isAgencyOwner || isKeyEmployee),
    staleTime: 30000, // 30 seconds
  });

  const members = data?.members || [];
  const teamTotal = members.reduce((sum, m) => sum + m.weeklyPoints, 0);
  const teamGoal = members.length * 28; // 4 domains * 7 days

  return {
    members,
    teamTotal,
    teamGoal,
    loading: isLoading,
    error: error as Error | null,
  };
}
