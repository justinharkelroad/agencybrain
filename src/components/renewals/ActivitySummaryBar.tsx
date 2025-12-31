import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, Voicemail, MessageSquare, Mail, CheckCircle2, Activity, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, subDays, addDays, startOfDay, isToday, isFuture } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

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

export function ActivitySummaryBar({ agencyId }: ActivitySummaryBarProps) {
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const displayDate = isToday(selectedDate) 
    ? 'Today' 
    : format(selectedDate, 'EEEE, MMM d');
  
  const { data: activities, isLoading } = useQuery({
    queryKey: ['renewal-activity-summary', agencyId, dateStr],
    queryFn: async () => {
      if (!agencyId) return [];
      
      const startOfDayStr = `${dateStr}T00:00:00`;
      const endOfDayStr = `${dateStr}T23:59:59`;
      
      // First get all renewal record IDs for this agency
      const { data: renewalRecords, error: recordsError } = await supabase
        .from('renewal_records')
        .select('id')
        .eq('agency_id', agencyId);
      
      if (recordsError) {
        console.error('Error fetching renewal records:', recordsError);
        return [];
      }
      
      if (!renewalRecords || renewalRecords.length === 0) return [];
      
      const recordIds = renewalRecords.map(r => r.id);
      
      // Then get activities for those records on the selected date
      const { data, error } = await supabase
        .from('renewal_activities')
        .select('id, activity_type, created_by_user_id, created_by_display_name, created_at')
        .in('renewal_record_id', recordIds)
        .gte('created_at', startOfDayStr)
        .lte('created_at', endOfDayStr);
      
      if (error) {
        console.error('Error fetching activities:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!agencyId,
    refetchInterval: isToday(selectedDate) ? 30000 : false,
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
  
  // Navigation handlers
  const goToPreviousDay = () => {
    setSelectedDate(prev => subDays(prev, 1));
  };
  
  const goToNextDay = () => {
    const nextDay = addDays(selectedDate, 1);
    if (!isFuture(nextDay) || isToday(nextDay)) {
      setSelectedDate(nextDay);
    }
  };
  
  const goToToday = () => {
    setSelectedDate(startOfDay(new Date()));
  };
  
  const canGoNext = !isToday(selectedDate);
  
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
  
  return (
    <Card className="bg-[#1a1f2e] border-gray-700">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-400" />
            <CardTitle className="text-base text-white">Activity Summary</CardTitle>
          </div>
          
          {/* Date Navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-white"
              onClick={goToPreviousDay}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-7 px-2 text-sm text-gray-300 hover:text-white"
                >
                  <Calendar className="h-3.5 w-3.5 mr-1.5" />
                  {displayDate}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(startOfDay(date));
                      setCalendarOpen(false);
                    }
                  }}
                  disabled={(date) => isFuture(date) && !isToday(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-white disabled:opacity-30"
              onClick={goToNextDay}
              disabled={!canGoNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            
            {!isToday(selectedDate) && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs ml-1"
                onClick={goToToday}
              >
                Today
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Empty state */}
        {totalActivities === 0 ? (
          <div className="flex items-center justify-center gap-2 text-gray-400 py-2">
            <span>No activity logged {isToday(selectedDate) ? 'yet today' : `on ${format(selectedDate, 'MMM d')}`}</span>
          </div>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}
