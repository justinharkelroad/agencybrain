import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { startOfWeek, startOfDay, subDays, format, isToday, parseISO, isSameDay } from 'date-fns';

export interface FlowStats {
  currentStreak: number;
  longestStreak: number;
  totalFlows: number;
  weeklyProgress: number;
  weeklyGoal: number;
  weeklyActivity: WeekDay[];
  todayCompleted: boolean;
  milestones: Milestone[];
  loading: boolean;
}

export interface WeekDay {
  date: Date;
  dayLabel: string;
  completed: number;
  isToday: boolean;
  isPast: boolean;
}

export interface Milestone {
  days: number;
  label: string;
  icon: string;
  achieved: boolean;
  achievedDate?: string;
}

const MILESTONES = [
  { days: 7, label: '1 Week', icon: '🔥' },
  { days: 30, label: '1 Month', icon: '⭐' },
  { days: 100, label: '100 Days', icon: '💎' },
  { days: 365, label: '1 Year', icon: '👑' },
];

export function useFlowStats(): FlowStats {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<{ completed_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchCompletedSessions();
    }
  }, [user?.id]);

  const fetchCompletedSessions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('flow_sessions')
        .select('completed_at')
        .eq('user_id', user!.id)
        .eq('status', 'completed')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error('Error fetching flow sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (loading || !sessions.length) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalFlows: sessions.length,
        weeklyProgress: 0,
        weeklyGoal: 7,
        weeklyActivity: getEmptyWeek(),
        todayCompleted: false,
        milestones: MILESTONES.map(m => ({ ...m, achieved: false })),
        loading,
      };
    }

    // Get unique dates with completed flows
    const completedDates = new Set<string>();
    sessions.forEach(s => {
      const date = format(parseISO(s.completed_at), 'yyyy-MM-dd');
      completedDates.add(date);
    });

    // Calculate current streak
    const today = startOfDay(new Date());
    const yesterday = startOfDay(subDays(today, 1));
    const todayStr = format(today, 'yyyy-MM-dd');
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

    let currentStreak = 0;
    let checkDate = today;

    // Start from today or yesterday if today hasn't been completed yet
    const todayCompleted = completedDates.has(todayStr);
    if (!todayCompleted && !completedDates.has(yesterdayStr)) {
      // Streak is broken - neither today nor yesterday completed
      currentStreak = 0;
    } else {
      // Start counting from today if completed, otherwise from yesterday
      if (!todayCompleted) {
        checkDate = yesterday;
      }
      
      while (completedDates.has(format(checkDate, 'yyyy-MM-dd'))) {
        currentStreak++;
        checkDate = subDays(checkDate, 1);
      }
    }

    // Calculate longest streak
    const sortedDates = Array.from(completedDates).sort();
    let longestStreak = 0;
    let tempStreak = 0;
    let prevDate: Date | null = null;

    sortedDates.forEach(dateStr => {
      const date = parseISO(dateStr);
      if (prevDate && isSameDay(subDays(date, 1), prevDate)) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
      longestStreak = Math.max(longestStreak, tempStreak);
      prevDate = date;
    });

    // Calculate weekly progress (Monday = start of week)
    const mondayOfWeek = startOfWeek(today, { weekStartsOn: 1 });
    let weeklyProgress = 0;
    sessions.forEach(s => {
      const sessionDate = parseISO(s.completed_at);
      if (sessionDate >= mondayOfWeek && sessionDate <= today) {
        weeklyProgress++;
      }
    });

    // Build weekly activity (Mon-Sun)
    const weeklyActivity: WeekDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(mondayOfWeek);
      date.setDate(mondayOfWeek.getDate() + i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayLabel = format(date, 'EEE').charAt(0); // M, T, W, T, F, S, S
      
      // Count flows completed on this day
      const completed = sessions.filter(s => 
        format(parseISO(s.completed_at), 'yyyy-MM-dd') === dateStr
      ).length;

      weeklyActivity.push({
        date,
        dayLabel,
        completed,
        isToday: isToday(date),
        isPast: date < today && !isToday(date),
      });
    }

    // Calculate milestones
    const milestones = MILESTONES.map(m => ({
      ...m,
      achieved: longestStreak >= m.days,
      achievedDate: longestStreak >= m.days ? 'Achieved!' : undefined,
    }));

    return {
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
      totalFlows: sessions.length,
      weeklyProgress,
      weeklyGoal: 7,
      weeklyActivity,
      todayCompleted,
      milestones,
      loading,
    };
  }, [sessions, loading]);

  return stats;
}

function getEmptyWeek(): WeekDay[] {
  const today = new Date();
  const monday = startOfWeek(today, { weekStartsOn: 1 });
  const week: WeekDay[] = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    week.push({
      date,
      dayLabel: format(date, 'EEE').charAt(0),
      completed: 0,
      isToday: isToday(date),
      isPast: date < today && !isToday(date),
    });
  }
  
  return week;
}
