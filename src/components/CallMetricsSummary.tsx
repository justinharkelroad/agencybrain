import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, PhoneIncoming, PhoneOutgoing, Clock } from 'lucide-react';

interface CallMetrics {
  total_calls: number;
  inbound_calls: number;
  outbound_calls: number;
  answered_calls: number;
  missed_calls: number;
  total_talk_seconds: number;
}

interface CallMetricsSummaryProps {
  teamMemberId?: string;
  date?: string;
  isStaffUser?: boolean;
  staffTeamMemberId?: string;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function CallMetricsSummary({
  teamMemberId,
  date,
  isStaffUser = false,
  staffTeamMemberId,
}: CallMetricsSummaryProps) {
  const targetDate = date || new Date().toISOString().split('T')[0];

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['call-metrics', teamMemberId, targetDate, isStaffUser, staffTeamMemberId],
    queryFn: async (): Promise<CallMetrics | null> => {
      // Staff portal users: use RPC functions
      if (isStaffUser && staffTeamMemberId) {
        const sessionToken = localStorage.getItem('staff_session_token');
        if (teamMemberId) {
          // Get metrics for a specific team member
          const { data, error } = await supabase.rpc('get_staff_call_metrics', {
            p_team_member_id: teamMemberId,
            p_start_date: targetDate,
            p_end_date: targetDate,
            p_staff_session_token: sessionToken,
          });

          if (error) throw error;
          return data?.[0] || null;
        } else {
          // Get aggregated metrics for entire agency
          const { data, error } = await supabase.rpc('get_agency_call_metrics', {
            p_team_member_id: staffTeamMemberId,
            p_start_date: targetDate,
            p_end_date: targetDate,
            p_staff_session_token: sessionToken,
          });

          if (error) throw error;

          // Aggregate all team members' metrics
          if (data && data.length > 0) {
            return data.reduce(
              (acc: CallMetrics, row: CallMetrics) => ({
                total_calls: acc.total_calls + (row.total_calls || 0),
                inbound_calls: acc.inbound_calls + (row.inbound_calls || 0),
                outbound_calls: acc.outbound_calls + (row.outbound_calls || 0),
                answered_calls: acc.answered_calls + (row.answered_calls || 0),
                missed_calls: acc.missed_calls + (row.missed_calls || 0),
                total_talk_seconds: acc.total_talk_seconds + (row.total_talk_seconds || 0),
              }),
              {
                total_calls: 0,
                inbound_calls: 0,
                outbound_calls: 0,
                answered_calls: 0,
                missed_calls: 0,
                total_talk_seconds: 0,
              }
            );
          }
          return null;
        }
      }

      // Agency owners/key employees: direct table access via RLS
      let query = supabase
        .from('call_metrics_daily')
        .select('total_calls, inbound_calls, outbound_calls, answered_calls, missed_calls, total_talk_seconds')
        .eq('date', targetDate);

      if (teamMemberId) {
        query = query.eq('team_member_id', teamMemberId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // If filtering by team member, return single record
      if (teamMemberId) {
        return data?.[0] || null;
      }

      // Otherwise aggregate all records for the agency
      if (data && data.length > 0) {
        return data.reduce(
          (acc, row) => ({
            total_calls: acc.total_calls + (row.total_calls || 0),
            inbound_calls: acc.inbound_calls + (row.inbound_calls || 0),
            outbound_calls: acc.outbound_calls + (row.outbound_calls || 0),
            answered_calls: acc.answered_calls + (row.answered_calls || 0),
            missed_calls: acc.missed_calls + (row.missed_calls || 0),
            total_talk_seconds: acc.total_talk_seconds + (row.total_talk_seconds || 0),
          }),
          {
            total_calls: 0,
            inbound_calls: 0,
            outbound_calls: 0,
            answered_calls: 0,
            missed_calls: 0,
            total_talk_seconds: 0,
          }
        );
      }

      return null;
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="animate-pulse space-y-2">
                <div className="h-4 w-20 bg-muted rounded" />
                <div className="h-8 w-16 bg-muted rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics || metrics.total_calls === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          No call data for {targetDate}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            Total Calls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.total_calls}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <PhoneIncoming className="h-4 w-4 text-green-500" />
            Inbound
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.inbound_calls}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <PhoneOutgoing className="h-4 w-4 text-blue-500" />
            Outbound
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.outbound_calls}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-500" />
            Talk Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatDuration(metrics.total_talk_seconds)}</div>
        </CardContent>
      </Card>
    </div>
  );
}
