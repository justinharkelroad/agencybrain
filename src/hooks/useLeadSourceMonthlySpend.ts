import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { LeadSourceMonthlySpend } from '@/types/lqs';
import { format, subMonths, startOfMonth } from 'date-fns';

interface SpendFormData {
  cost_per_unit_cents: number | null;
  units_count: number | null;
  total_spend_cents: number;
  notes: string | null;
}

export const useLeadSourceMonthlySpend = (leadSourceId: string | null, agencyId: string | null) => {
  const [spendHistory, setSpendHistory] = useState<LeadSourceMonthlySpend[]>([]);
  const [currentSpend, setCurrentSpend] = useState<LeadSourceMonthlySpend | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format date to YYYY-MM-01 for month comparison
  const formatMonth = (date: Date): string => {
    return format(startOfMonth(date), 'yyyy-MM-dd');
  };

  const fetchSpendHistory = useCallback(async (months: number = 6) => {
    if (!leadSourceId) {
      setSpendHistory([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get last N months
      const startDate = formatMonth(subMonths(new Date(), months - 1));

      const { data, error: fetchError } = await supabase
        .from('lead_source_monthly_spend')
        .select('*')
        .eq('lead_source_id', leadSourceId)
        .gte('month', startDate)
        .order('month', { ascending: false });

      if (fetchError) throw fetchError;

      setSpendHistory(data || []);
    } catch (err) {
      console.error('Error fetching spend history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load spend history');
    } finally {
      setLoading(false);
    }
  }, [leadSourceId]);

  const fetchSpendForMonth = useCallback(async (month: Date) => {
    if (!leadSourceId) {
      setCurrentSpend(null);
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const monthStr = formatMonth(month);

      const { data, error: fetchError } = await supabase
        .from('lead_source_monthly_spend')
        .select('*')
        .eq('lead_source_id', leadSourceId)
        .eq('month', monthStr)
        .maybeSingle();

      if (fetchError) throw fetchError;

      setCurrentSpend(data);
      return data;
    } catch (err) {
      console.error('Error fetching spend for month:', err);
      setError(err instanceof Error ? err.message : 'Failed to load spend data');
      return null;
    } finally {
      setLoading(false);
    }
  }, [leadSourceId]);

  const upsertSpend = async (month: Date, data: SpendFormData): Promise<boolean> => {
    if (!leadSourceId || !agencyId) return false;

    try {
      setLoading(true);
      setError(null);

      const monthStr = formatMonth(month);

      // Check if record exists
      const { data: existing } = await supabase
        .from('lead_source_monthly_spend')
        .select('id')
        .eq('lead_source_id', leadSourceId)
        .eq('month', monthStr)
        .maybeSingle();

      if (existing) {
        // Update
        const { error: updateError } = await supabase
          .from('lead_source_monthly_spend')
          .update({
            cost_per_unit_cents: data.cost_per_unit_cents ?? 0,
            units_count: data.units_count ?? 0,
            total_spend_cents: data.total_spend_cents,
            notes: data.notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;
      } else {
        // Insert
        const { error: insertError } = await supabase
          .from('lead_source_monthly_spend')
          .insert({
            lead_source_id: leadSourceId,
            agency_id: agencyId,
            month: monthStr,
            cost_per_unit_cents: data.cost_per_unit_cents ?? 0,
            units_count: data.units_count ?? 0,
            total_spend_cents: data.total_spend_cents,
            notes: data.notes
          });

        if (insertError) throw insertError;
      }

      // Refresh data
      await fetchSpendForMonth(month);
      await fetchSpendHistory();
      
      return true;
    } catch (err) {
      console.error('Error saving spend data:', err);
      setError(err instanceof Error ? err.message : 'Failed to save spend data');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteSpend = async (spendId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('lead_source_monthly_spend')
        .delete()
        .eq('id', spendId);

      if (deleteError) throw deleteError;

      setSpendHistory(prev => prev.filter(s => s.id !== spendId));
      if (currentSpend?.id === spendId) {
        setCurrentSpend(null);
      }

      return true;
    } catch (err) {
      console.error('Error deleting spend record:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete spend record');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Generate list of last N months for selector
  const getMonthOptions = (count: number = 12): { value: Date; label: string }[] => {
    const options = [];
    const now = new Date();
    
    for (let i = 0; i < count; i++) {
      const date = subMonths(now, i);
      options.push({
        value: startOfMonth(date),
        label: format(date, 'MMMM yyyy')
      });
    }
    
    return options;
  };

  return {
    spendHistory,
    currentSpend,
    loading,
    error,
    fetchSpendHistory,
    fetchSpendForMonth,
    upsertSpend,
    deleteSpend,
    getMonthOptions,
    formatMonth
  };
};
