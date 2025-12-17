import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { useStaffPermissions } from '@/hooks/useStaffPermissions';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart3, TrendingUp, Users, CheckCircle, XCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface TeamMetric {
  team_member_id: string;
  team_member_name: string;
  date: string;
  hits: number;
  pass: boolean | null;
  sold_items: number | null;
  quoted_count: number | null;
  talk_minutes: number | null;
}

export default function StaffTeamPerformance() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useStaffAuth();
  const { isManager, loading: permissionsLoading } = useStaffPermissions();
  const [metrics, setMetrics] = useState<TeamMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Redirect non-managers
    if (!permissionsLoading && !isManager) {
      navigate('/staff/dashboard');
    }
  }, [isManager, permissionsLoading, navigate]);

  useEffect(() => {
    const fetchTeamMetrics = async () => {
      if (!user?.agency_id || !isManager) return;

      try {
        const token = localStorage.getItem('staff_session_token');
        const { data, error } = await supabase.functions.invoke('get_staff_team_data', {
          body: { type: 'performance' },
          headers: token ? { 'x-staff-session': token } : {}
        });

        if (error) throw error;
        setMetrics(data?.metrics || []);
      } catch (err) {
        console.error('Error fetching team metrics:', err);
      } finally {
        setLoading(false);
      }
    };

    if (isManager && user?.agency_id) {
      fetchTeamMetrics();
    }
  }, [user?.agency_id, isManager]);

  if (authLoading || permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isManager) {
    return null;
  }

  // Aggregate metrics by team member
  const aggregatedMetrics = metrics.reduce((acc, m) => {
    if (!acc[m.team_member_id]) {
      acc[m.team_member_id] = {
        name: m.team_member_name,
        totalDays: 0,
        passDays: 0,
        totalSold: 0,
        totalQuoted: 0,
        totalTalkMinutes: 0
      };
    }
    acc[m.team_member_id].totalDays++;
    if (m.pass) acc[m.team_member_id].passDays++;
    acc[m.team_member_id].totalSold += m.sold_items || 0;
    acc[m.team_member_id].totalQuoted += m.quoted_count || 0;
    acc[m.team_member_id].totalTalkMinutes += m.talk_minutes || 0;
    return acc;
  }, {} as Record<string, { name: string; totalDays: number; passDays: number; totalSold: number; totalQuoted: number; totalTalkMinutes: number }>);

  const teamSummary = Object.entries(aggregatedMetrics).map(([id, data]) => ({
    id,
    ...data,
    passRate: data.totalDays > 0 ? Math.round((data.passDays / data.totalDays) * 100) : 0
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team Performance</h1>
        <p className="text-muted-foreground">View your team's recent metrics</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{teamSummary.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{metrics.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Pass Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">
                {teamSummary.length > 0
                  ? Math.round(teamSummary.reduce((acc, t) => acc + t.passRate, 0) / teamSummary.length)
                  : 0}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Team Summary (Last 7 Days)
          </CardTitle>
          <CardDescription>
            Performance metrics aggregated by team member
          </CardDescription>
        </CardHeader>
        <CardContent>
          {teamSummary.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No metrics data available</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead className="text-right">Pass Rate</TableHead>
                    <TableHead className="text-right">Items Sold</TableHead>
                    <TableHead className="text-right">Quoted</TableHead>
                    <TableHead className="text-right">Talk Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamSummary.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell className="text-right">{member.totalDays}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={member.passRate >= 80 ? 'default' : member.passRate >= 60 ? 'secondary' : 'destructive'}>
                          {member.passRate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{member.totalSold}</TableCell>
                      <TableCell className="text-right">{member.totalQuoted}</TableCell>
                      <TableCell className="text-right">{member.totalTalkMinutes} min</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Submissions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Submissions</CardTitle>
          <CardDescription>Latest daily submissions from your team</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No recent submissions</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Quoted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.slice(0, 20).map((m, idx) => (
                    <TableRow key={`${m.team_member_id}-${m.date}-${idx}`}>
                      <TableCell className="font-medium">{m.team_member_name}</TableCell>
                      <TableCell>{new Date(m.date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-center">
                        {m.pass ? (
                          <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-right">{m.sold_items ?? '—'}</TableCell>
                      <TableCell className="text-right">{m.quoted_count ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
