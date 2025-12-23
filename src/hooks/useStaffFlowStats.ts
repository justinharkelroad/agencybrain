import { useState, useEffect, useMemo } from 'react';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { startOfWeek, startOfDay, subDays, format, isToday, parseISO, isSameDay } from 'date-fns';

export interface StaffFlowStats {
  currentStreak: number;
  longestStreak: number;
  totalFlows: number;
  weeklyProgress: number;
  weeklyGoal: number;
  todayCompleted: boolean;
  loading: boolean;
}

export function useStaffFlowStats(): StaffFlowStats {
  const { user, sessionToken } = useStaffAuth();
  const [sessions, setSessions] = useState<{ completed_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionToken && user?.id) {
      fetchCompletedSessions();
    }
  }, [sessionToken, user?.id]);

  const fetchCompletedSessions = async () => {
    if (!sessionToken) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get_staff_flows`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-staff-session': sessionToken,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch flow sessions');
      }

      const data = await response.json();
      // Filter for completed sessions with completed_at
      const completedSessions = (data.sessions || [])
        .filter((s: any) => s.status === 'completed' && s.completed_at)
        .map((s: any) => ({ completed_at: s.completed_at }));
      
      setSessions(completedSessions);
    } catch (err) {
      console.error('Error fetching staff flow sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (loading) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalFlows: 0,
        weeklyProgress: 0,
        weeklyGoal: 7,
        todayCompleted: false,
        loading,
      };
    }

    if (!sessions.length) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalFlows: 0,
        weeklyProgress: 0,
        weeklyGoal: 7,
        todayCompleted: false,
        loading,
      };
    }

    // Get unique dates with completed flows
    const completedDates = new Set<string>();
    sessions.forEach(s => {
      const sessionDate = new Date(s.completed_at);
      const date = format(sessionDate, 'yyyy-MM-dd');
      completedDates.add(date);
    });

    // Calculate current streak
    const today = startOfDay(new Date());
    const yesterday = startOfDay(subDays(today, 1));
    const todayStr = format(today, 'yyyy-MM-dd');
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

    let currentStreak = 0;
    let checkDate = today;

    const todayCompleted = completedDates.has(todayStr);
    if (!todayCompleted && !completedDates.has(yesterdayStr)) {
      currentStreak = 0;
    } else {
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
    
    // Count unique days with flows this week (max 1 per day = 7 max)
    const weekDates = new Set<string>();
    sessions.forEach(s => {
      const sessionDate = new Date(s.completed_at);
      const sessionDay = startOfDay(sessionDate);
      if (sessionDay >= mondayOfWeek && sessionDay <= today) {
        weekDates.add(format(sessionDay, 'yyyy-MM-dd'));
      }
    });
    weeklyProgress = weekDates.size;

    return {
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
      totalFlows: sessions.length,
      weeklyProgress,
      weeklyGoal: 7,
      todayCompleted,
      loading,
    };
  }, [sessions, loading]);

  return stats;
}
