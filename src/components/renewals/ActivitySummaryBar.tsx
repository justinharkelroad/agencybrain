import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Voicemail, MessageSquare, Mail, CheckCircle2, Activity } from 'lucide-react';
import { format, subDays, getDay, startOfDay } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface ActivitySummaryBarProps {
  agencyId: string | null;
}

interface ActivityByUser {
  userId: string;
  displayName: string;
  calls: number;
  voicemails: number;
  texts: number;
  emails: number;
  reviewsDone: number;
}

// Get previous business day (skip weekends)
function getPreviousBusinessDay(date: Date): Date {
  let prevDay = subDays(date, 1);
  
  // If previous day is Sunday, go back to Friday
  if (getDay(prevDay) === 0) {
    prevDay = subDays(prevDay, 2);
  }
  // If previous day is Saturday, go back to Friday
  else if (getDay(prevDay) === 6) {
    prevDay = subDays(prevDay, 1);
  }
  
  return startOfDay(prevDay);
}

export function ActivitySummaryBar({ agencyId }: ActivitySummaryBarProps) {
  const today = startOfDay(new Date());
  const previousBusinessDay = getPreviousBusinessDay(today);
  const dateStr = format(previousBusinessDay, 'yyyy-MM-dd');
  const displayDate = format(previousBusinessDay, 'EEEE, MMM d');
  
  // Don't show on weekends
  const todayDayOfWeek = getDay(today);
  const isWeekendToday = todayDayOfWeek === 0 || todayDayOfWeek === 6;
  
  const { data: activities, isLoading } = useQuery({
    queryKey: ['renewal-activity-summary', agencyId, dateStr],
    queryFn: async () => {
      if (!agencyId) return [];
      
      const startOfPrevDay = `${dateStr}T00:00:00`;
      const endOfPrevDay = `${dateStr}T23:59:59`;
      
      const { data, error } = await supabase
        .from('renewal_activities')
        .select(`
          id,
          activity_type,
          created_by_user_id,
          created_by_display_name,
          created_at,
          renewal_record:renewal_records!inner(agency_id)
        `)
        .eq('renewal_record.agency_id', agencyId)
        .gte('created_at', startOfPrevDay)
        .lte('created_at', endOfPrevDay);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!agencyId && !isWeekendToday,
  });
  
  // Aggregate by user
  const activityByUser = useMemo(() => {
    if (!activities || activities.length === 0) return [];
    
    const userMap = new Map<string, ActivityByUser>();
    
    activities.forEach((activity) => {
      const userId = activity.created_by_user_id || 'unknown';
      const displayName = activity.created_by_display_name || 'Unknown User';
      
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          displayName,
          calls: 0,
          voicemails: 0,
          texts: 0,
          emails: 0,
          reviewsDone: 0,
        });
      }
      
      const user = userMap.get(userId)!;
      
      // Match existing activity types in database
      switch (activity.activity_type) {
        case 'call':
        case 'phone_call':
          user.calls++;
          break;
        case 'voicemail':
          user.voicemails++;
          break;
        case 'text':
          user.texts++;
          break;
        case 'email':
          user.emails++;
          break;
        case 'review_done':
          user.reviewsDone++;
          break;
      }
    });
    
    return Array.from(userMap.values()).sort((a, b) => 
      a.displayName.localeCompare(b.displayName)
    );
  }, [activities]);
  
  // Calculate totals
  const totals = useMemo(() => {
    return activityByUser.reduce(
      (acc, user) => ({
        calls: acc.calls + user.calls,
        voicemails: acc.voicemails + user.voicemails,
        texts: acc.texts + user.texts,
        emails: acc.emails + user.emails,
        reviewsDone: acc.reviewsDone + user.reviewsDone,
      }),
      { calls: 0, voicemails: 0, texts: 0, emails: 0, reviewsDone: 0 }
    );
  }, [activityByUser]);
  
  const totalActivities = totals.calls + totals.voicemails + totals.texts + totals.emails + totals.reviewsDone;
  
  // Don't render on weekends
  if (isWeekendToday) {
    return null;
  }
  
  if (isLoading) {
    return (
      <Card className="bg-[#1a1f2e] border-gray-700">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  // Empty state
  if (totalActivities === 0) {
    return (
      <Card className="bg-[#1a1f2e] border-gray-700">
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <Activity className="h-5 w-5" />
            <span>No activity logged on {displayDate}</span>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="bg-[#1a1f2e] border-gray-700">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-400" />
          <CardTitle className="text-base text-white">Activity Summary</CardTitle>
          <span className="text-sm text-gray-400">— {displayDate}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-2 text-gray-400 font-medium">Team Member</th>
                <th className="text-center py-2 px-2 text-gray-400 font-medium">
                  <div className="flex items-center justify-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-blue-400" />
                    <span>Calls</span>
                  </div>
                </th>
                <th className="text-center py-2 px-2 text-gray-400 font-medium">
                  <div className="flex items-center justify-center gap-1">
                    <Voicemail className="h-3.5 w-3.5 text-purple-400" />
                    <span>VM</span>
                  </div>
                </th>
                <th className="text-center py-2 px-2 text-gray-400 font-medium">
                  <div className="flex items-center justify-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Texts</span>
                  </div>
                </th>
                <th className="text-center py-2 px-2 text-gray-400 font-medium">
                  <div className="flex items-center justify-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-green-400" />
                    <span>Emails</span>
                  </div>
                </th>
                <th className="text-center py-2 px-2 text-gray-400 font-medium">
                  <div className="flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-yellow-400" />
                    <span>Reviews</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {activityByUser.map((user) => (
                <tr key={user.userId} className="border-b border-gray-700/50">
                  <td className="py-2 px-2 text-white">{user.displayName}</td>
                  <td className="py-2 px-2 text-center text-blue-400">{user.calls || '—'}</td>
                  <td className="py-2 px-2 text-center text-purple-400">{user.voicemails || '—'}</td>
                  <td className="py-2 px-2 text-center text-cyan-400">{user.texts || '—'}</td>
                  <td className="py-2 px-2 text-center text-green-400">{user.emails || '—'}</td>
                  <td className="py-2 px-2 text-center text-yellow-400">{user.reviewsDone || '—'}</td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-gray-800/50 font-medium">
                <td className="py-2 px-2 text-white">TOTAL</td>
                <td className="py-2 px-2 text-center text-blue-400">{totals.calls}</td>
                <td className="py-2 px-2 text-center text-purple-400">{totals.voicemails}</td>
                <td className="py-2 px-2 text-center text-cyan-400">{totals.texts}</td>
                <td className="py-2 px-2 text-center text-green-400">{totals.emails}</td>
                <td className="py-2 px-2 text-center text-yellow-400">{totals.reviewsDone}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
