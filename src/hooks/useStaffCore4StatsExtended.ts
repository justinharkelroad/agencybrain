import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { startOfWeek, startOfDay, subDays, format, isToday, addDays, isFuture, isBefore, isAfter } from 'date-fns';

export type Core4Domain = 'body' | 'being' | 'balance' | 'business';

export interface StaffCore4Entry {
  id: string;
  staff_user_id: string;
  date: string;
  body_completed: boolean;
  being_completed: boolean;
  balance_completed: boolean;
  business_completed: boolean;
  body_note: string | null;
  being_note: string | null;
  balance_note: string | null;
  business_note: string | null;
}

export interface WeekDayActivity {
  date: Date;
  dateStr: string;
  dayLabel: string;
  points: number;
  isToday: boolean;
  isFuture: boolean;
}

export interface StaffCore4StatsExtended {
  todayEntry: StaffCore4Entry | null;
  todayPoints: number;
  weeklyPoints: number;
  weeklyGoal: number;
  currentStreak: number;
  longestStreak: number;
  totalPoints: number;
  weeklyActivity: WeekDayActivity[];
  entries: StaffCore4Entry[];
  loading: boolean;
  toggleDomain: (domain: Core4Domain, date?: Date) => Promise<void>;
  isDateEditable: (date: Date) => boolean;
  refetch: () => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  selectedWeekStart: Date;
  navigateWeek: (direction: 'prev' | 'next') => void;
  getEntryForDate: (dateStr: string) => StaffCore4Entry | null;
}

export function useStaffCore4StatsExtended(): StaffCore4StatsExtended {
  const { user, sessionToken } = useStaffAuth();
  const [entries, setEntries] = useState<StaffCore4Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const fetchEntries = useCallback(async () => {
    if (!user?.id || !sessionToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get_staff_core4_entries', {
        headers: {
          'x-staff-session': sessionToken,
        },
        body: { action: 'fetch' },
      });

      if (error) throw error;
      setEntries(data?.entries || []);
    } catch (err) {
      console.error('Error fetching staff Core 4 entries:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, sessionToken]);

  useEffect(() => {
    if (user?.id && sessionToken) {
      fetchEntries();
    }
  }, [user?.id, sessionToken, fetchEntries]);

  const getEntryPoints = (entry: StaffCore4Entry | null): number => {
    if (!entry) return 0;
    return (
      (entry.body_completed ? 1 : 0) +
      (entry.being_completed ? 1 : 0) +
      (entry.balance_completed ? 1 : 0) +
      (entry.business_completed ? 1 : 0)
    );
  };

  const getEntryForDate = useCallback((dateStr: string): StaffCore4Entry | null => {
    return entries.find(e => e.date === dateStr) || null;
  }, [entries]);

  const navigateWeek = useCallback((direction: 'prev' | 'next') => {
    setSelectedWeekStart(prev => {
      const newStart = direction === 'prev' 
        ? subDays(prev, 7) 
        : addDays(prev, 7);
      return newStart;
    });
  }, []);

  // Check if a date is editable (within current week, not future)
  const isDateEditable = useCallback((date: Date): boolean => {
    const today = startOfDay(new Date());
    const targetDate = startOfDay(date);
    
    // Cannot edit future days
    if (isAfter(targetDate, today)) return false;
    
    // Get current week's Monday (week starts on Monday)
    const currentWeekMonday = startOfWeek(today, { weekStartsOn: 1 });
    
    // Can only edit dates from current week's Monday onwards
    return !isBefore(targetDate, currentWeekMonday);
  }, []);

  const toggleDomain = useCallback(async (domain: Core4Domain, date?: Date) => {
    if (!user?.id || !sessionToken) return;

    const targetDate = date || selectedDate;
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    
    // Validate the date is editable
    if (!isDateEditable(targetDate)) return;

    const existingEntry = entries.find(e => e.date === dateStr);
    const domainKey = `${domain}_completed` as keyof StaffCore4Entry;
    const newValue = existingEntry ? !existingEntry[domainKey] : true;

    // Optimistic update
    if (existingEntry) {
      setEntries(prev => prev.map(e => 
        e.date === dateStr ? { ...e, [domainKey]: newValue } : e
      ));
    } else {
      const newEntry: StaffCore4Entry = {
        id: 'temp-' + Date.now(),
        staff_user_id: user.id,
        date: dateStr,
        body_completed: domain === 'body',
        being_completed: domain === 'being',
        balance_completed: domain === 'balance',
        business_completed: domain === 'business',
        body_note: null,
        being_note: null,
        balance_note: null,
        business_note: null,
      };
      setEntries(prev => [newEntry, ...prev]);
    }

    try {
      const { data, error } = await supabase.functions.invoke('get_staff_core4_entries', {
        headers: {
          'x-staff-session': sessionToken,
        },
        body: { action: 'toggle', domain, date: dateStr },
      });

      if (error) throw error;

      if (data?.entry) {
        setEntries(prev => {
          const filtered = prev.filter(e => e.date !== dateStr || !e.id.startsWith('temp-'));
          const exists = filtered.some(e => e.id === data.entry.id);
          if (exists) {
            return filtered.map(e => e.id === data.entry.id ? data.entry : e);
          }
          return [data.entry, ...filtered];
        });
      }
    } catch (err) {
      console.error('Error toggling domain:', err);
      fetchEntries();
    }
  }, [user?.id, sessionToken, entries, selectedDate, isDateEditable, fetchEntries]);

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const todayStr = format(today, 'yyyy-MM-dd');
    const todayEntry = entries.find(e => e.date === todayStr) || null;
    const todayPoints = getEntryPoints(todayEntry);

    // Weekly points for selected week
    let weeklyPoints = 0;
    for (let i = 0; i < 7; i++) {
      const dayStr = format(addDays(selectedWeekStart, i), 'yyyy-MM-dd');
      const entry = entries.find(e => e.date === dayStr);
      weeklyPoints += getEntryPoints(entry);
    }

    // Weekly activity for display
    const weeklyActivity: WeekDayActivity[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(selectedWeekStart, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const entry = entries.find(e => e.date === dateStr);
      weeklyActivity.push({
        date,
        dateStr,
        dayLabel: format(date, 'EEE'),
        points: getEntryPoints(entry),
        isToday: isToday(date),
        isFuture: isFuture(date),
      });
    }

    // Calculate current streak
    let currentStreak = 0;
    let checkDate = today;
    const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');
    
    const todayFull = todayPoints === 4;
    const yesterdayEntry = entries.find(e => e.date === yesterdayStr);
    const yesterdayFull = getEntryPoints(yesterdayEntry) === 4;

    if (!todayFull && !yesterdayFull) {
      currentStreak = 0;
    } else {
      if (!todayFull) {
        checkDate = subDays(today, 1);
      }
      
      while (true) {
        const dateStr = format(checkDate, 'yyyy-MM-dd');
        const entry = entries.find(e => e.date === dateStr);
        if (getEntryPoints(entry) === 4) {
          currentStreak++;
          checkDate = subDays(checkDate, 1);
        } else {
          break;
        }
      }
    }

    // Calculate longest streak and total points
    let longestStreak = 0;
    let tempStreak = 0;
    let totalPoints = 0;
    
    const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    let prevDate: Date | null = null;
    
    for (const entry of sortedEntries) {
      const points = getEntryPoints(entry);
      totalPoints += points;
      
      if (points === 4) {
        const entryDate = new Date(entry.date);
        if (prevDate && (entryDate.getTime() - prevDate.getTime()) === 86400000) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
        longestStreak = Math.max(longestStreak, tempStreak);
        prevDate = entryDate;
      } else {
        tempStreak = 0;
        prevDate = null;
      }
    }

    return {
      todayEntry,
      todayPoints,
      weeklyPoints,
      weeklyGoal: 28,
      currentStreak,
      longestStreak,
      totalPoints,
      weeklyActivity,
    };
  }, [entries, selectedWeekStart]);

  return {
    ...stats,
    entries,
    loading,
    toggleDomain,
    isDateEditable,
    refetch: fetchEntries,
    selectedDate,
    setSelectedDate,
    selectedWeekStart,
    navigateWeek,
    getEntryForDate,
  };
}
