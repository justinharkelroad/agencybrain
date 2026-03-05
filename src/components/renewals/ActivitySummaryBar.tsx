import { useEffect, useMemo, useState, useCallback } from 'react';
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
import { getStaffSessionToken } from '@/lib/cancel-audit-api';
import { getLocalDayBoundsInUTC } from '@/lib/date-utils';

export interface RenewalActivityFilter {
  userId: string;
  displayName: string;
  activityType?: string;
  recordIds: Set<string>;
}

interface ActivitySummaryBarProps {
  agencyId: string | null;
  onActivityFilter?: (filter: RenewalActivityFilter | null) => void;
  activeFilter?: { userId: string; activityType?: string } | null;
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

// Maps display field names to activity_type values in the DB
const RENEWAL_ACTIVITY_TYPE_MAP: Record<string, string[]> = {
  calls: ['call', 'phone_call'],
  voicemails: ['voicemail'],
  texts: ['text'],
  emails: ['email'],
  reviewsDone: ['review_done'],
};

export function ActivitySummaryBar({ agencyId, onActivityFilter, activeFilter }: ActivitySummaryBarProps) {
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [calendarOpen, setCalendarOpen] = useState(false);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const displayDate = isToday(selectedDate)
    ? 'Today'
    : format(selectedDate, 'EEEE, MMM d');

  const staffSessionToken = getStaffSessionToken();

  // Clear filter when date changes
  useEffect(() => {
    onActivityFilter?.(null);
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps
  
  const { data: activities, isLoading } = useQuery({
    queryKey: ['renewal-activity-summary', agencyId, dateStr, !!staffSessionToken],
    queryFn: async () => {
      if (!agencyId) return [];
      
      // Get UTC bounds for the selected local date (handles timezone correctly)
      const { startUTC, endUTC } = getLocalDayBoundsInUTC(selectedDate);

      // Staff users: call edge function to bypass RLS
      if (staffSessionToken) {
        console.log('[ActivitySummaryBar] Staff user detected, calling edge function');
        const { data, error } = await supabase.functions.invoke('get_staff_renewal_activities', {
          body: { startDate: startUTC, endDate: endUTC, date: dateStr },
          headers: { 'x-staff-session': staffSessionToken }
        });

        if (error) {
          console.error('[ActivitySummaryBar] Edge function error:', error);
          return [];
        }

        console.log('[ActivitySummaryBar] Got activities from edge function:', data?.activities?.length);
        return data?.activities || [];
      }

      // Regular users: direct query
      const { data, error } = await supabase
        .from('renewal_activities')
        .select('id, activity_type, created_by, created_by_staff_id, created_by_display_name, created_at, renewal_record_id')
        .eq('agency_id', agencyId)
        .gte('created_at', startUTC)
        .lte('created_at', endUTC);
      
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
      // Skip system-generated entries (e.g. auto-resolved status changes)
      if (activity.activity_type === 'status_change' || activity.activity_type === 'note') return;

      // Group by staff ID or auth user ID so each person gets their own row
      const displayName = activity.created_by_display_name || 'Unknown User';
      const userId = activity.created_by || (activity.created_by_staff_id ? `staff:${activity.created_by_staff_id}` : `staff:${displayName}`);

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

  // Derive the grouping key for an activity (must match the aggregation logic above)
  const getActivityUserId = useCallback((a: any): string => {
    const dn = a.created_by_display_name || 'Unknown User';
    return a.created_by || (a.created_by_staff_id ? `staff:${a.created_by_staff_id}` : `staff:${dn}`);
  }, []);

  // Collect renewal_record_ids for a given user (optionally filtered by activity type)
  const getRecordIdsForFilter = useCallback(
    (userId: string, activityTypes?: string[]): Set<string> => {
      if (!activities) return new Set();
      const ids = new Set<string>();
      activities.forEach((a: any) => {
        if (getActivityUserId(a) !== userId) return;
        if (activityTypes && !activityTypes.includes(a.activity_type)) return;
        if (a.renewal_record_id) ids.add(a.renewal_record_id);
      });
      return ids;
    },
    [activities, getActivityUserId]
  );

  const handleNameClick = useCallback(
    (user: ActivityByUser) => {
      if (!onActivityFilter) return;
      if (activeFilter?.userId === user.userId && !activeFilter.activityType) {
        onActivityFilter(null);
        return;
      }
      onActivityFilter({
        userId: user.userId,
        displayName: user.displayName,
        recordIds: getRecordIdsForFilter(user.userId),
      });
    },
    [onActivityFilter, activeFilter, getRecordIdsForFilter]
  );

  const handleCellClick = useCallback(
    (user: ActivityByUser, fieldKey: string, count: number) => {
      if (!onActivityFilter || count === 0) return;
      const dbTypes = RENEWAL_ACTIVITY_TYPE_MAP[fieldKey];
      // Use the first type as the canonical type for toggle comparison
      const canonicalType = dbTypes[0];
      if (activeFilter?.userId === user.userId && activeFilter.activityType === canonicalType) {
        onActivityFilter(null);
        return;
      }
      onActivityFilter({
        userId: user.userId,
        displayName: user.displayName,
        activityType: canonicalType,
        recordIds: getRecordIdsForFilter(user.userId, dbTypes),
      });
    },
    [onActivityFilter, activeFilter, getRecordIdsForFilter]
  );

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
      <Card className="bg-card dark:bg-[#1a1f2e] border-border dark:border-gray-700">
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
    <Card className="bg-card dark:bg-[#1a1f2e] border-border dark:border-gray-700">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500 dark:text-blue-400" />
            <CardTitle className="text-base text-foreground">Activity Summary</CardTitle>
          </div>
          
          {/* Date Navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={goToPreviousDay}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-7 px-2 text-sm text-muted-foreground hover:text-foreground"
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
              className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
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
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-2">
            <span>No activity logged {isToday(selectedDate) ? 'yet today' : `on ${format(selectedDate, 'MMM d')}`}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border dark:border-gray-700">
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium">Team Member</th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">
                    <div className="flex items-center justify-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                      <span>Calls</span>
                    </div>
                  </th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">
                    <div className="flex items-center justify-center gap-1">
                      <Voicemail className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
                      <span>VM</span>
                    </div>
                  </th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">
                    <div className="flex items-center justify-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400" />
                      <span>Texts</span>
                    </div>
                  </th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">
                    <div className="flex items-center justify-center gap-1">
                      <Mail className="h-3.5 w-3.5 text-green-500 dark:text-green-400" />
                      <span>Emails</span>
                    </div>
                  </th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">
                    <div className="flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-yellow-500 dark:text-yellow-400" />
                      <span>Reviews</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {activityByUser.map((user) => {
                  const isRowActive = activeFilter?.userId === user.userId;
                  const cells: Array<{ key: string; count: number; color: string }> = [
                    { key: 'calls', count: user.calls, color: 'text-blue-500 dark:text-blue-400' },
                    { key: 'voicemails', count: user.voicemails, color: 'text-purple-500 dark:text-purple-400' },
                    { key: 'texts', count: user.texts, color: 'text-cyan-500 dark:text-cyan-400' },
                    { key: 'emails', count: user.emails, color: 'text-green-500 dark:text-green-400' },
                    { key: 'reviewsDone', count: user.reviewsDone, color: 'text-yellow-500 dark:text-yellow-400' },
                  ];
                  return (
                    <tr
                      key={user.userId}
                      className={cn(
                        'border-b border-border/50 dark:border-gray-700/50 transition-colors',
                        isRowActive && 'bg-primary/10'
                      )}
                    >
                      <td
                        className={cn(
                          'py-2 px-2 text-foreground',
                          onActivityFilter && 'cursor-pointer hover:underline'
                        )}
                        onClick={() => handleNameClick(user)}
                      >
                        {user.displayName}
                      </td>
                      {cells.map(({ key, count, color }) => {
                        const canonicalType = RENEWAL_ACTIVITY_TYPE_MAP[key][0];
                        const isCellActive = isRowActive && activeFilter?.activityType === canonicalType;
                        return (
                          <td
                            key={key}
                            className={cn(
                              'py-2 px-2 text-center',
                              color,
                              count > 0 && onActivityFilter && 'cursor-pointer hover:bg-muted/50 rounded',
                              isCellActive && 'font-bold ring-1 ring-primary/40 rounded bg-primary/10'
                            )}
                            onClick={() => handleCellClick(user, key, count)}
                          >
                            {count || '—'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr className="bg-muted/50 dark:bg-gray-800/50 font-medium">
                  <td className="py-2 px-2 text-foreground">TOTAL</td>
                  <td className="py-2 px-2 text-center text-blue-500 dark:text-blue-400">{totals.calls}</td>
                  <td className="py-2 px-2 text-center text-purple-500 dark:text-purple-400">{totals.voicemails}</td>
                  <td className="py-2 px-2 text-center text-cyan-500 dark:text-cyan-400">{totals.texts}</td>
                  <td className="py-2 px-2 text-center text-green-500 dark:text-green-400">{totals.emails}</td>
                  <td className="py-2 px-2 text-center text-yellow-500 dark:text-yellow-400">{totals.reviewsDone}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
