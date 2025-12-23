import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { startOfWeek, startOfDay, subDays, format, isToday, parseISO, isSameDay, addDays } from 'date-fns';

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

export interface StaffCore4Stats {
  todayEntry: StaffCore4Entry | null;
  todayPoints: number;
  weeklyPoints: number;
  weeklyGoal: number;
  currentStreak: number;
  loading: boolean;
  toggleDomain: (domain: Core4Domain) => Promise<void>;
  refetch: () => void;
}

export function useStaffCore4Stats(): StaffCore4Stats {
  const { user, sessionToken } = useStaffAuth();
  const [entries, setEntries] = useState<StaffCore4Entry[]>([]);
  const [loading, setLoading] = useState(true);

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

  const toggleDomain = useCallback(async (domain: Core4Domain) => {
    if (!user?.id || !sessionToken) return;

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const existingEntry = entries.find(e => e.date === todayStr);
    const domainKey = `${domain}_completed` as keyof StaffCore4Entry;
    const newValue = existingEntry ? !existingEntry[domainKey] : true;

    // Optimistic update
    if (existingEntry) {
      setEntries(prev => prev.map(e => 
        e.date === todayStr ? { ...e, [domainKey]: newValue } : e
      ));
    } else {
      const newEntry: StaffCore4Entry = {
        id: 'temp-' + Date.now(),
        staff_user_id: user.id,
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
      const { data, error } = await supabase.functions.invoke('get_staff_core4_entries', {
        headers: {
          'x-staff-session': sessionToken,
        },
        body: { action: 'toggle', domain },
      });

      if (error) throw error;

      // Replace with real entry from server
      if (data?.entry) {
        setEntries(prev => {
          const filtered = prev.filter(e => e.date !== todayStr || !e.id.startsWith('temp-'));
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
  }, [user?.id, sessionToken, entries, fetchEntries]);

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

    // Calculate current streak (consecutive days with 4/4)
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

    return {
      todayEntry,
      todayPoints,
      weeklyPoints,
      weeklyGoal: 28,
      currentStreak,
    };
  }, [entries]);

  return {
    ...stats,
    loading,
    toggleDomain,
    refetch: fetchEntries,
  };
}
