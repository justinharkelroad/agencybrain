import { useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Phone, PhoneOff, MessageSquare, Mail, FileText, Trophy,
  TrendingUp, ChevronLeft, ChevronRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import * as winbackApi from '@/lib/winbackApi';
import { startOfWeek, endOfWeek, format, addWeeks, subWeeks, isSameWeek } from 'date-fns';

interface ActivityStats {
  called: number;
  left_vm: number;
  texted: number;
  emailed: number;
  quoted: number;
  total: number;
}

interface WinbackActivityStatsProps {
  agencyId: string | null;
  wonBackCount: number;
}

export function WinbackActivityStats({ agencyId, wonBackCount }: WinbackActivityStatsProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [stats, setStats] = useState<ActivityStats>({
    called: 0,
    left_vm: 0,
    texted: 0,
    emailed: 0,
    quoted: 0,
    total: 0,
  });
  const [weeklyWonBack, setWeeklyWonBack] = useState(0);
  const [loading, setLoading] = useState(true);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const isCurrentWeek = isSameWeek(selectedDate, new Date(), { weekStartsOn: 1 });
  
  // Use ref to avoid stale closure in subscription callback
  const isCurrentWeekRef = useRef(isCurrentWeek);
  isCurrentWeekRef.current = isCurrentWeek;

  const fetchStats = useCallback(async () => {
    if (!agencyId) return;
    
    setLoading(true);
    try {
      const currentWeekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const currentWeekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
      
      const [counts, wonBack] = await Promise.all([
        winbackApi.getActivityStats(agencyId, currentWeekStart, currentWeekEnd),
        winbackApi.getWeeklyWonBackCount(agencyId, currentWeekStart, currentWeekEnd),
      ]);
      setStats(counts);
      setWeeklyWonBack(wonBack);
    } catch (err) {
      console.error('Error fetching activity stats:', err);
    } finally {
      setLoading(false);
    }
  }, [agencyId, selectedDate]);

  // Keep fetchStats ref current for subscription callback
  const fetchStatsRef = useRef(fetchStats);
  fetchStatsRef.current = fetchStats;

  // Initial fetch + refetch when date changes
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Separate subscription - only recreates when agencyId changes
  useEffect(() => {
    if (!agencyId) return;
    
    const channelName = `winback-activities-stats-${agencyId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'winback_activities',
          filter: `agency_id=eq.${agencyId}`,
        },
        () => {
          // Use refs to get current values (avoids stale closure)
          if (isCurrentWeekRef.current) {
            fetchStatsRef.current();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agencyId]);


  const handlePreviousWeek = () => {
    setSelectedDate(subWeeks(selectedDate, 1));
  };

  const handleNextWeek = () => {
    if (!isCurrentWeek) {
      setSelectedDate(addWeeks(selectedDate, 1));
    }
  };

  const formatDateRange = () => {
    const startStr = format(weekStart, 'MMM d');
    const endStr = format(weekEnd, 'MMM d, yyyy');
    return `${startStr} - ${endStr}`;
  };

  const statItems = [
    { key: 'called', label: 'Calls', icon: Phone, color: 'text-green-400', value: stats.called },
    { key: 'left_vm', label: 'VMs', icon: PhoneOff, color: 'text-yellow-400', value: stats.left_vm },
    { key: 'texted', label: 'Texts', icon: MessageSquare, color: 'text-cyan-400', value: stats.texted },
    { key: 'emailed', label: 'Emails', icon: Mail, color: 'text-blue-400', value: stats.emailed },
    { key: 'quoted', label: 'Quotes', icon: FileText, color: 'text-purple-400', value: stats.quoted },
  ];

  return (
    <div className="space-y-2">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handlePreviousWeek}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[160px] text-center">
            {formatDateRange()}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleNextWeek}
            disabled={isCurrentWeek}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {isCurrentWeek && (
          <span className="text-xs text-muted-foreground">This Week</span>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
        {/* Won Back Counter - Highlighted */}
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-green-400" />
              <div>
                <p className="text-lg font-bold text-green-400">{loading ? '-' : weeklyWonBack}</p>
                <p className="text-xs text-muted-foreground">Won Back</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Stats */}
        {statItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.key}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${item.color}`} />
                  <div>
                    <p className="text-lg font-bold">{loading ? '-' : item.value}</p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Total Activities */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <div>
                <p className="text-lg font-bold">{loading ? '-' : stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
