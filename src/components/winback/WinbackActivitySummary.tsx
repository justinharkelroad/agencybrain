import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Phone, 
  Voicemail, 
  MessageSquare, 
  Mail, 
  StickyNote,
  Activity, 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Trophy,
} from 'lucide-react';
import { format, subDays, addDays, startOfDay, isToday, isFuture } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface WinbackActivitySummaryProps {
  agencyId: string | null;
}

interface ActivityByUser {
  userName: string;
  calls: number;
  voicemails: number;
  texts: number;
  emails: number;
  notes: number;
  wonBack: number;
}

// Get UTC timestamp strings for a local date's boundaries
function getLocalDayBoundsInUTC(localDate: Date) {
  const localStart = startOfDay(localDate);
  const localEnd = new Date(localStart);
  localEnd.setHours(23, 59, 59, 999);
  
  return {
    startUTC: localStart.toISOString(),
    endUTC: localEnd.toISOString(),
  };
}

export function WinbackActivitySummary({ agencyId }: WinbackActivitySummaryProps) {
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const displayDate = isToday(selectedDate) 
    ? 'Today' 
    : format(selectedDate, 'EEEE, MMM d');
  
  const { data: activities, isLoading, refetch } = useQuery({
    queryKey: ['winback-activity-summary', agencyId, dateStr],
    queryFn: async () => {
      if (!agencyId) return [];
      
      const { startUTC, endUTC } = getLocalDayBoundsInUTC(selectedDate);
      
      const { data, error } = await supabase
        .from('winback_activities')
        .select('id, activity_type, created_by_name, new_status, created_at')
        .eq('agency_id', agencyId)
        .gte('created_at', startUTC)
        .lte('created_at', endUTC);
      
      if (error) {
        console.error('Error fetching winback activities:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!agencyId,
    refetchInterval: isToday(selectedDate) ? 30000 : false,
  });

  // Subscribe to real-time updates when viewing today
  useEffect(() => {
    if (!agencyId || !isToday(selectedDate)) return;

    const channelName = `winback-activity-summary-${agencyId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'winback_activities',
        },
        (payload) => {
          if (payload.new && (payload.new as any).agency_id === agencyId) {
            refetch();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agencyId, selectedDate, refetch]);
  
  // Aggregate by user
  const activityByUser = useMemo(() => {
    if (!activities || activities.length === 0) return [];
    
    const userMap = new Map<string, ActivityByUser>();
    
    activities.forEach((activity) => {
      const userName = activity.created_by_name || 'Unknown';
      
      if (!userMap.has(userName)) {
        userMap.set(userName, {
          userName,
          calls: 0,
          voicemails: 0,
          texts: 0,
          emails: 0,
          notes: 0,
          wonBack: 0,
        });
      }
      
      const user = userMap.get(userName)!;
      
      switch (activity.activity_type) {
        case 'called':
          user.calls++;
          break;
        case 'left_vm':
          user.voicemails++;
          break;
        case 'texted':
          user.texts++;
          break;
        case 'emailed':
          user.emails++;
          break;
        case 'note':
          user.notes++;
          break;
        case 'status_change':
          // Count status changes to won_back
          if (activity.new_status === 'won_back') {
            user.wonBack++;
          }
          break;
      }
    });
    
    return Array.from(userMap.values()).sort((a, b) => 
      a.userName.localeCompare(b.userName)
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
        notes: acc.notes + user.notes,
        wonBack: acc.wonBack + user.wonBack,
      }),
      { calls: 0, voicemails: 0, texts: 0, emails: 0, notes: 0, wonBack: 0 }
    );
  }, [activityByUser]);
  
  const totalActivities = Object.values(totals).reduce((a, b) => a + b, 0);
  
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
                    <div className="flex items-center justify-center gap-1" title="Calls">
                      <Phone className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                  </th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">
                    <div className="flex items-center justify-center gap-1" title="Voicemails">
                      <Voicemail className="h-3.5 w-3.5 text-orange-500" />
                    </div>
                  </th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">
                    <div className="flex items-center justify-center gap-1" title="Texts">
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                  </th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">
                    <div className="flex items-center justify-center gap-1" title="Emails">
                      <Mail className="h-3.5 w-3.5 text-purple-500" />
                    </div>
                  </th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">
                    <div className="flex items-center justify-center gap-1" title="Notes">
                      <StickyNote className="h-3.5 w-3.5 text-gray-500" />
                    </div>
                  </th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">
                    <div className="flex items-center justify-center gap-1" title="Won Back">
                      <Trophy className="h-3.5 w-3.5 text-yellow-500" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {activityByUser.map((user) => (
                  <tr key={user.userName} className="border-b border-border/50">
                    <td className="py-2 px-2 text-foreground">{user.userName}</td>
                    <td className="py-2 px-2 text-center text-blue-500">{user.calls || '—'}</td>
                    <td className="py-2 px-2 text-center text-orange-500">{user.voicemails || '—'}</td>
                    <td className="py-2 px-2 text-center text-emerald-500">{user.texts || '—'}</td>
                    <td className="py-2 px-2 text-center text-purple-500">{user.emails || '—'}</td>
                    <td className="py-2 px-2 text-center text-gray-500">{user.notes || '—'}</td>
                    <td className="py-2 px-2 text-center text-yellow-500">{user.wonBack || '—'}</td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="bg-muted/50 font-medium">
                  <td className="py-2 px-2 text-foreground">TOTAL</td>
                  <td className="py-2 px-2 text-center text-blue-500">{totals.calls}</td>
                  <td className="py-2 px-2 text-center text-orange-500">{totals.voicemails}</td>
                  <td className="py-2 px-2 text-center text-emerald-500">{totals.texts}</td>
                  <td className="py-2 px-2 text-center text-purple-500">{totals.emails}</td>
                  <td className="py-2 px-2 text-center text-gray-500">{totals.notes}</td>
                  <td className="py-2 px-2 text-center text-yellow-500">{totals.wonBack}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
