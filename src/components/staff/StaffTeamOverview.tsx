import { useState, useEffect } from 'react';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface PerformanceMetric {
  team_member_id: string;
  team_member_name: string;
  date: string;
  hits: number;
  pass: boolean;
  sold_items: number;
  quoted_count: number;
  talk_minutes: number;
}

function getPreviousBusinessDay(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay();
  
  let daysToSubtract = 1;
  if (dayOfWeek === 0) daysToSubtract = 2;
  else if (dayOfWeek === 1) daysToSubtract = 3;
  
  return subDays(today, daysToSubtract);
}

export function StaffTeamOverview() {
  const { user, sessionToken } = useStaffAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetric[]>([]);
  const [loading, setLoading] = useState(true);

  const previousBusinessDay = getPreviousBusinessDay();
  const displayDate = format(previousBusinessDay, 'EEEE, MMMM d');

  useEffect(() => {
    async function fetchTeamData() {
      if (!sessionToken || user?.role !== 'Manager') {
        setLoading(false);
        return;
      }

      try {
        // Fetch team members and performance in parallel
        const [membersRes, perfRes] = await Promise.all([
          supabase.functions.invoke('get_staff_team_data', {
            headers: { 'x-staff-session': sessionToken },
            body: { type: 'team_members' },
          }),
          supabase.functions.invoke('get_staff_team_data', {
            headers: { 'x-staff-session': sessionToken },
            body: { type: 'performance' },
          }),
        ]);

        if (membersRes.data?.team_members) {
          setTeamMembers(membersRes.data.team_members);
        }
        if (perfRes.data?.performance) {
          setPerformance(perfRes.data.performance);
        }
      } catch (err) {
        console.error('Error fetching team data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchTeamData();
  }, [sessionToken, user?.role]);

  // Only render for managers
  if (user?.role !== 'Manager') {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  // Calculate team stats from recent performance (last 7 days)
  const totalMembers = teamMembers.length;
  const totalSubmissions = performance.length;
  const passedSubmissions = performance.filter(p => p.pass).length;
  const passRate = totalSubmissions > 0 ? Math.round((passedSubmissions / totalSubmissions) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Overview
        </CardTitle>
        <CardDescription>Last 7 days performance • {displayDate}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg bg-muted/30">
            <div className="text-2xl font-bold">{totalMembers}</div>
            <div className="text-xs text-muted-foreground">Team Members</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted/30">
            <div className="text-2xl font-bold">{totalSubmissions}</div>
            <div className="text-xs text-muted-foreground">Submissions</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted/30">
            <div className={`text-2xl font-bold ${passRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
              {passRate}%
            </div>
            <div className="text-xs text-muted-foreground">Pass Rate</div>
          </div>
        </div>

        {/* Recent Performance Table */}
        {performance.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {performance.slice(0, 5).map((p, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="px-3 py-2">{p.team_member_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {format(new Date(p.date), 'MMM d')}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {p.pass ? (
                        <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {performance.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            No recent submissions from your team.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
