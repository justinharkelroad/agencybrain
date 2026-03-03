import { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Phone, 
  Voicemail, 
  MessageSquare, 
  Mail, 
  MessageCircle, 
  DollarSign, 
  HandCoins,
  StickyNote,
  Activity, 
  ChevronLeft, 
  ChevronRight, 
  Calendar 
} from 'lucide-react';
import { format, subDays, addDays, startOfDay, isToday, isFuture } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { getStaffSessionToken, callCancelAuditApi } from '@/lib/cancel-audit-api';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { getLocalDayBoundsInUTC } from '@/lib/date-utils';

export interface ActivityFilter {
  userId: string;
  displayName: string;
  activityType?: string;
  recordIds: Set<string>;
}

interface CancelAuditActivitySummaryProps {
  agencyId: string | null;
  onActivityFilter?: (filter: ActivityFilter | null) => void;
  activeFilter?: { userId: string; activityType?: string } | null;
}

interface ActivityByUser {
  userId: string;
  displayName: string;
  attemptedCalls: number;
  voicemails: number;
  texts: number;
  emails: number;
  spoke: number;
  paid: number;
  promised: number;
  notes: number;
}

// Maps display field names to activity_type values in the DB
const ACTIVITY_TYPE_MAP: Record<string, string> = {
  attemptedCalls: 'attempted_call',
  voicemails: 'voicemail_left',
  texts: 'text_sent',
  emails: 'email_sent',
  spoke: 'spoke_with_client',
  paid: 'payment_made',
  promised: 'payment_promised',
  notes: 'note',
};

export function CancelAuditActivitySummary({ agencyId, onActivityFilter, activeFilter }: CancelAuditActivitySummaryProps) {
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [calendarOpen, setCalendarOpen] = useState(false);

  const staffSessionToken = getStaffSessionToken();

  // Clear filter when date changes
  useEffect(() => {
    onActivityFilter?.(null);
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const displayDate = isToday(selectedDate)
    ? 'Today'
    : format(selectedDate, 'EEEE, MMM d');

  const { data: activities, isLoading } = useQuery({
    queryKey: ['cancel-audit-activity-summary', agencyId, dateStr, !!staffSessionToken],
    queryFn: async () => {
      if (!agencyId) return [];

      // Get UTC bounds for the selected local date (handles timezone correctly)
      const { startUTC, endUTC } = getLocalDayBoundsInUTC(selectedDate);

      // Staff users: call edge function to bypass RLS
      if (staffSessionToken) {
        console.log('[CancelAuditActivitySummary] Staff user, calling edge function');
        try {
          const result = await callCancelAuditApi({
            operation: 'get_activity_summary',
            params: {
              startDate: startUTC,
              endDate: endUTC,
            },
            sessionToken: staffSessionToken,
          });
          console.log('[CancelAuditActivitySummary] Edge function result:', result);
          return result?.activities || [];
        } catch (error) {
          console.error('[CancelAuditActivitySummary] Edge function error:', error);
          return [];
        }
      }

      // Regular users: direct Supabase query
      const { data, error } = await supabase
        .from('cancel_audit_activities')
        .select('id, activity_type, user_id, user_display_name, created_at, record_id')
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
      const displayName = activity.user_display_name || 'Unknown User';
      const userId = activity.user_id || displayName; // Use display name as fallback key
      
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          displayName,
          attemptedCalls: 0,
          voicemails: 0,
          texts: 0,
          emails: 0,
          spoke: 0,
          paid: 0,
          promised: 0,
          notes: 0,
        });
      }
      
      const user = userMap.get(userId)!;
      
      switch (activity.activity_type) {
        case 'attempted_call':
          user.attemptedCalls++;
          break;
        case 'voicemail_left':
          user.voicemails++;
          break;
        case 'text_sent':
          user.texts++;
          break;
        case 'email_sent':
          user.emails++;
          break;
        case 'spoke_with_client':
          user.spoke++;
          break;
        case 'payment_made':
          user.paid++;
          break;
        case 'payment_promised':
          user.promised++;
          break;
        case 'note':
          user.notes++;
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
        attemptedCalls: acc.attemptedCalls + user.attemptedCalls,
        voicemails: acc.voicemails + user.voicemails,
        texts: acc.texts + user.texts,
        emails: acc.emails + user.emails,
        spoke: acc.spoke + user.spoke,
        paid: acc.paid + user.paid,
        promised: acc.promised + user.promised,
        notes: acc.notes + user.notes,
      }),
      { attemptedCalls: 0, voicemails: 0, texts: 0, emails: 0, spoke: 0, paid: 0, promised: 0, notes: 0 }
    );
  }, [activityByUser]);
  
  const totalActivities = Object.values(totals).reduce((a, b) => a + b, 0);

  // Collect record_ids for a given user (optionally filtered by activity type)
  // IMPORTANT: userId derivation must match the aggregation logic above
  // (user_id || user_display_name || 'Unknown User')
  const getRecordIdsForFilter = useCallback(
    (userId: string, activityType?: string): Set<string> => {
      if (!activities) return new Set();
      const ids = new Set<string>();
      activities.forEach((a: any) => {
        const aUserId = a.user_id || a.user_display_name || 'Unknown User';
        if (aUserId !== userId) return;
        if (activityType && a.activity_type !== activityType) return;
        if (a.record_id) ids.add(a.record_id);
      });
      return ids;
    },
    [activities]
  );

  const handleNameClick = useCallback(
    (user: ActivityByUser) => {
      if (!onActivityFilter) return;
      // Toggle off if same user already active (no specific type)
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
      const dbType = ACTIVITY_TYPE_MAP[fieldKey];
      // Toggle off if same user + same type
      if (activeFilter?.userId === user.userId && activeFilter.activityType === dbType) {
        onActivityFilter(null);
        return;
      }
      onActivityFilter({
        userId: user.userId,
        displayName: user.displayName,
        activityType: dbType,
        recordIds: getRecordIdsForFilter(user.userId, dbType),
      });
    },
    [onActivityFilter, activeFilter, getRecordIdsForFilter]
  );

  // Navigation handlers
  const goToPreviousDay = () => setSelectedDate(prev => subDays(prev, 1));
  
  const goToNextDay = () => {
    const nextDay = addDays(selectedDate, 1);
    if (!isFuture(nextDay) || isToday(nextDay)) {
      setSelectedDate(nextDay);
    }
  };
  
  const goToToday = () => setSelectedDate(startOfDay(new Date()));
  
  const canGoNext = !isToday(selectedDate);
  
  if (isLoading) {
    return (
      <Card className="bg-card border-border">
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
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="text-base text-foreground">Daily Activity Summary</CardTitle>
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
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium">Team Member</th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">
                    <div className="flex items-center justify-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                  </th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">
                    <div className="flex items-center justify-center gap-1">
                      <Voicemail className="h-3.5 w-3.5 text-orange-500" />
                    </div>
                  </th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">
                    <div className="flex items-center justify-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                  </th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">
                    <div className="flex items-center justify-center gap-1">
                      <Mail className="h-3.5 w-3.5 text-purple-500" />
                    </div>
                  </th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">
                    <div className="flex items-center justify-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5 text-cyan-500" />
                    </div>
                  </th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">
                    <div className="flex items-center justify-center gap-1">
                      <DollarSign className="h-3.5 w-3.5 text-green-500" />
                    </div>
                  </th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">
                    <div className="flex items-center justify-center gap-1">
                      <HandCoins className="h-3.5 w-3.5 text-yellow-500" />
                    </div>
                  </th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">
                    <div className="flex items-center justify-center gap-1">
                      <StickyNote className="h-3.5 w-3.5 text-gray-500" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {activityByUser.map((user) => {
                  const isRowActive = activeFilter?.userId === user.userId;
                  const cells: Array<{ key: string; count: number; color: string }> = [
                    { key: 'attemptedCalls', count: user.attemptedCalls, color: 'text-blue-500' },
                    { key: 'voicemails', count: user.voicemails, color: 'text-orange-500' },
                    { key: 'texts', count: user.texts, color: 'text-emerald-500' },
                    { key: 'emails', count: user.emails, color: 'text-purple-500' },
                    { key: 'spoke', count: user.spoke, color: 'text-cyan-500' },
                    { key: 'paid', count: user.paid, color: 'text-green-500' },
                    { key: 'promised', count: user.promised, color: 'text-yellow-500' },
                    { key: 'notes', count: user.notes, color: 'text-gray-500' },
                  ];
                  return (
                    <tr
                      key={user.userId}
                      className={cn(
                        'border-b border-border/50 transition-colors',
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
                        const isCellActive = isRowActive && activeFilter?.activityType === ACTIVITY_TYPE_MAP[key];
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
                <tr className="bg-muted/50 font-medium">
                  <td className="py-2 px-2 text-foreground">TOTAL</td>
                  <td className="py-2 px-2 text-center text-blue-500">{totals.attemptedCalls}</td>
                  <td className="py-2 px-2 text-center text-orange-500">{totals.voicemails}</td>
                  <td className="py-2 px-2 text-center text-emerald-500">{totals.texts}</td>
                  <td className="py-2 px-2 text-center text-purple-500">{totals.emails}</td>
                  <td className="py-2 px-2 text-center text-cyan-500">{totals.spoke}</td>
                  <td className="py-2 px-2 text-center text-green-500">{totals.paid}</td>
                  <td className="py-2 px-2 text-center text-yellow-500">{totals.promised}</td>
                  <td className="py-2 px-2 text-center text-gray-500">{totals.notes}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
