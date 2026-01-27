import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Activity {
  id: string;
  contact_type: string;
  prospect_id: string;
  activity_type: string;
  activity_source: string | null;
  title: string | null;
  description: string | null;
  metadata: {
    duration_seconds?: number;
    [key: string]: unknown;
  } | null;
  occurred_at: string;
  created_at: string;
}

interface ProspectActivityTimelineProps {
  prospectId: string;
  isStaffUser?: boolean;
  staffTeamMemberId?: string;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

function getActivityIcon(activityType: string) {
  switch (activityType) {
    case 'call_inbound':
      return <PhoneIncoming className="h-4 w-4 text-green-500" />;
    case 'call_outbound':
      return <PhoneOutgoing className="h-4 w-4 text-blue-500" />;
    case 'call_missed':
      return <PhoneMissed className="h-4 w-4 text-red-500" />;
    default:
      return <Phone className="h-4 w-4 text-muted-foreground" />;
  }
}

export function ProspectActivityTimeline({
  prospectId,
  isStaffUser = false,
  staffTeamMemberId,
}: ProspectActivityTimelineProps) {
  const { data: activities, isLoading } = useQuery({
    queryKey: ['prospect-activities', prospectId, isStaffUser, staffTeamMemberId],
    queryFn: async (): Promise<Activity[]> => {
      // Staff portal users: use RPC function
      if (isStaffUser && staffTeamMemberId) {
        const { data, error } = await supabase.rpc('get_contact_activities', {
          p_team_member_id: staffTeamMemberId,
          p_prospect_id: prospectId,
          p_limit: 50,
        });

        if (error) throw error;
        return data || [];
      }

      // Agency owners/key employees: direct table access via RLS
      const { data, error } = await supabase
        .from('contact_activities')
        .select('*')
        .eq('prospect_id', prospectId)
        .order('occurred_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!prospectId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="h-4 w-4 bg-muted rounded mt-1" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="h-3 w-48 bg-muted rounded" />
                </div>
                <div className="h-3 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No activity recorded yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Activity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0"
            >
              <div className="mt-0.5">
                {getActivityIcon(activity.activity_type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">
                    {activity.title || activity.activity_type}
                  </span>
                  {activity.activity_source && (
                    <Badge variant="outline" className="text-xs">
                      {activity.activity_source}
                    </Badge>
                  )}
                </div>
                {activity.description && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {activity.description}
                  </p>
                )}
                {activity.metadata?.duration_seconds != null && activity.metadata.duration_seconds > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Duration: {formatDuration(activity.metadata.duration_seconds)}
                  </p>
                )}
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(activity.occurred_at), { addSuffix: true })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
