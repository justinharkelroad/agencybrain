import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, isSameDay, parseISO } from 'date-fns';

interface OverlappingPeriod {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface PeriodOverlapInfo {
  hasOverlap: boolean;
  overlappingPeriod: OverlappingPeriod | null;
  isExactMatch: boolean;
  loading: boolean;
}

export function usePeriodOverlap(
  startDate: Date | undefined,
  endDate: Date | undefined,
  currentPeriodId?: string,
  userId?: string
) {
  const [overlapInfo, setOverlapInfo] = useState<PeriodOverlapInfo>({
    hasOverlap: false,
    overlappingPeriod: null,
    isExactMatch: false,
    loading: false,
  });

  const checkForOverlap = useCallback(async () => {
    if (!startDate || !endDate || !userId) {
      setOverlapInfo({
        hasOverlap: false,
        overlappingPeriod: null,
        isExactMatch: false,
        loading: false,
      });
      return;
    }

    setOverlapInfo(prev => ({ ...prev, loading: true }));

    try {
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      // Query for periods that overlap with the given date range
      // Two date ranges overlap if: start1 <= end2 AND end1 >= start2
      let query = supabase
        .from('periods')
        .select('id, title, start_date, end_date, status')
        .eq('user_id', userId)
        .lte('start_date', endStr)
        .gte('end_date', startStr)
        .order('start_date', { ascending: false })
        .limit(1);

      // Exclude the current period if we're editing
      if (currentPeriodId) {
        query = query.neq('id', currentPeriodId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error checking for period overlap:', error);
        setOverlapInfo({
          hasOverlap: false,
          overlappingPeriod: null,
          isExactMatch: false,
          loading: false,
        });
        return;
      }

      if (data && data.length > 0) {
        const overlapping = data[0];
        const periodStartDate = parseISO(overlapping.start_date);
        const periodEndDate = parseISO(overlapping.end_date);

        // Check if it's an exact match
        const isExactMatch =
          isSameDay(startDate, periodStartDate) &&
          isSameDay(endDate, periodEndDate);

        setOverlapInfo({
          hasOverlap: true,
          overlappingPeriod: overlapping,
          isExactMatch,
          loading: false,
        });
      } else {
        setOverlapInfo({
          hasOverlap: false,
          overlappingPeriod: null,
          isExactMatch: false,
          loading: false,
        });
      }
    } catch (err) {
      console.error('Error checking for period overlap:', err);
      setOverlapInfo({
        hasOverlap: false,
        overlappingPeriod: null,
        isExactMatch: false,
        loading: false,
      });
    }
  }, [startDate, endDate, currentPeriodId, userId]);

  useEffect(() => {
    checkForOverlap();
  }, [checkForOverlap]);

  return {
    ...overlapInfo,
    refetch: checkForOverlap,
  };
}
