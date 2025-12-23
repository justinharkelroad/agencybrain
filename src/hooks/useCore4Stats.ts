import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { startOfWeek, startOfDay, subDays, format, isToday, parseISO, isSameDay, addDays } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

export type Core4Domain = 'body' | 'being' | 'balance' | 'business';

export interface Core4Entry {
  id: string;
  user_id: string;
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

export interface WeekDay {
  date: Date;
  dateStr: string;
  dayLabel: string;
  points: number;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
}

export interface Core4Stats {
  todayEntry: Core4Entry | null;
  todayPoints: number;
  weeklyPoints: number;
  weeklyGoal: number; // 28 (4 domains × 7 days)
  currentStreak: number;
  longestStreak: number;
  totalPoints: number;
  weeklyActivity: WeekDay[];
  loading: boolean;
  toggleDomain: (domain: Core4Domain) => Promise<void>;
  refetch: () => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  selectedWeekStart: Date;
  navigateWeek: (direction: 'prev' | 'next') => void;
  getEntryForDate: (dateStr: string) => Core4Entry | null;
}

export function useCore4Stats(): Core4Stats {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<Core4Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  // Fetch entries for the last 90 days
  const fetchEntries = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const ninetyDaysAgo = format(subDays(new Date(), 90), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('core4_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', ninetyDaysAgo)
        .order('date', { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (err) {
      console.error('Error fetching Core 4 entries:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchEntries();
    }
  }, [user?.id, fetchEntries]);

  // Get entry for a specific date
  const getEntryForDate = useCallback((dateStr: string): Core4Entry | null => {
    return entries.find(e => e.date === dateStr) || null;
  }, [entries]);

  // Calculate points for an entry
  const getEntryPoints = (entry: Core4Entry | null): number => {
    if (!entry) return 0;
    return (
      (entry.body_completed ? 1 : 0) +
      (entry.being_completed ? 1 : 0) +
      (entry.balance_completed ? 1 : 0) +
      (entry.business_completed ? 1 : 0)
    );
  };

  // Toggle a domain for today
  const toggleDomain = useCallback(async (domain: Core4Domain) => {
    if (!user?.id) return;

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const existingEntry = entries.find(e => e.date === todayStr);
    const domainKey = `${domain}_completed` as keyof Core4Entry;
    const newValue = existingEntry ? !existingEntry[domainKey] : true;

    // Optimistic update
    if (existingEntry) {
      setEntries(prev => prev.map(e => 
        e.date === todayStr ? { ...e, [domainKey]: newValue } : e
      ));
    } else {
      const newEntry: Core4Entry = {
        id: 'temp-' + Date.now(),
        user_id: user.id,
        date: todayStr,
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
      if (existingEntry) {
        // Update existing entry
        const { error } = await supabase
          .from('core4_entries')
          .update({ [domainKey]: newValue, updated_at: new Date().toISOString() })
          .eq('id', existingEntry.id);

        if (error) throw error;
      } else {
        // Insert new entry
        const { data, error } = await supabase
          .from('core4_entries')
          .insert({
            user_id: user.id,
            date: todayStr,
            [domainKey]: true,
          })
          .select()
          .single();

        if (error) throw error;
        
        // Replace temp entry with real one
        if (data) {
          setEntries(prev => prev.map(e => 
            e.id.startsWith('temp-') && e.date === todayStr ? data : e
          ));
        }
      }

      // Invalidate team stats query if exists
      queryClient.invalidateQueries({ queryKey: ['teamCore4Stats'] });
    } catch (err) {
      console.error('Error toggling domain:', err);
      // Revert on error
      fetchEntries();
    }
  }, [user?.id, entries, fetchEntries, queryClient]);

  // Navigate weeks
  const navigateWeek = useCallback((direction: 'prev' | 'next') => {
    setSelectedWeekStart(prev => {
      const newStart = direction === 'prev' 
        ? subDays(prev, 7) 
        : addDays(prev, 7);
      return newStart;
    });
  }, []);

  // Calculate all stats
  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const todayStr = format(today, 'yyyy-MM-dd');
    const todayEntry = entries.find(e => e.date === todayStr) || null;
    const todayPoints = getEntryPoints(todayEntry);

    // Weekly points (current week starting Monday)
    const mondayOfWeek = startOfWeek(today, { weekStartsOn: 1 });
    let weeklyPoints = 0;
    for (let i = 0; i < 7; i++) {
      const dayStr = format(addDays(mondayOfWeek, i), 'yyyy-MM-dd');
      const entry = entries.find(e => e.date === dayStr);
      weeklyPoints += getEntryPoints(entry);
    }

    // Build weekly activity for selected week
    const weeklyActivity: WeekDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(selectedWeekStart, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const entry = entries.find(e => e.date === dateStr);
      const points = getEntryPoints(entry);

      weeklyActivity.push({
        date,
        dateStr,
        dayLabel: format(date, 'EEE').charAt(0),
        points,
        isToday: isToday(date),
        isPast: date < today && !isToday(date),
        isFuture: date > today,
      });
    }

    // Calculate current streak (consecutive days with 4/4)
    let currentStreak = 0;
    let checkDate = today;
    const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');
    
    // Check if today has 4/4
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

    // Calculate longest streak
    const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    let longestStreak = 0;
    let tempStreak = 0;
    let prevDate: Date | null = null;

    sortedEntries.forEach(entry => {
      if (getEntryPoints(entry) === 4) {
        const date = parseISO(entry.date);
        if (prevDate && isSameDay(subDays(date, 1), prevDate)) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
        longestStreak = Math.max(longestStreak, tempStreak);
        prevDate = date;
      } else {
        tempStreak = 0;
        prevDate = null;
      }
    });

    // Total points (all time)
    const totalPoints = entries.reduce((sum, entry) => sum + getEntryPoints(entry), 0);

    return {
      todayEntry,
      todayPoints,
      weeklyPoints,
      weeklyGoal: 28,
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
      totalPoints,
      weeklyActivity,
    };
  }, [entries, selectedWeekStart]);

  return {
    ...stats,
    loading,
    toggleDomain,
    refetch: fetchEntries,
    selectedDate,
    setSelectedDate,
    selectedWeekStart,
    navigateWeek,
    getEntryForDate,
  };
}
