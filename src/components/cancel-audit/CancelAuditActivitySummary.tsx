import { useMemo, useState } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface CancelAuditActivitySummaryProps {
  agencyId: string | null;
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

export function CancelAuditActivitySummary({ agencyId }: CancelAuditActivitySummaryProps) {
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const displayDate = isToday(selectedDate) 
    ? 'Today' 
    : format(selectedDate, 'EEEE, MMM d');
  
  const { data: activities, isLoading } = useQuery({
    queryKey: ['cancel-audit-activity-summary', agencyId, dateStr],
    queryFn: async () => {
      if (!agencyId) return [];
      
      const startOfDayStr = `${dateStr}T00:00:00`;
      const endOfDayStr = `${dateStr}T23:59:59`;
      
      const { data, error } = await supabase
        .from('cancel_audit_activities')
        .select('id, activity_type, user_id, user_display_name, created_at')
        .eq('agency_id', agencyId)
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
                {activityByUser.map((user) => (
                  <tr key={user.userId} className="border-b border-border/50">
                    <td className="py-2 px-2 text-foreground">{user.displayName}</td>
                    <td className="py-2 px-2 text-center text-blue-500">{user.attemptedCalls || '—'}</td>
                    <td className="py-2 px-2 text-center text-orange-500">{user.voicemails || '—'}</td>
                    <td className="py-2 px-2 text-center text-emerald-500">{user.texts || '—'}</td>
                    <td className="py-2 px-2 text-center text-purple-500">{user.emails || '—'}</td>
                    <td className="py-2 px-2 text-center text-cyan-500">{user.spoke || '—'}</td>
                    <td className="py-2 px-2 text-center text-green-500">{user.paid || '—'}</td>
                    <td className="py-2 px-2 text-center text-yellow-500">{user.promised || '—'}</td>
                    <td className="py-2 px-2 text-center text-gray-500">{user.notes || '—'}</td>
                  </tr>
                ))}
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
