import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export type ReportType = 'staff_roi' | 'vendor_verifier' | 'data_lead' | 'mailer' | 'live_transfer';

export type SavedReport = {
  id: string;
  user_id: string;
  agency_id: string;
  report_type: ReportType;
  title: string;
  input_data: Record<string, unknown>;
  results_data: Record<string, unknown>;
  created_at: string;
};

export function useSavedReports(reportType?: ReportType) {
  const { user } = useAuth();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    if (!user) {
      setReports([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('saved_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (reportType) {
        query = query.eq('report_type', reportType);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setReports((data || []) as SavedReport[]);
    } catch (err) {
      console.error('Error fetching reports:', err);
      setError('Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  }, [user, reportType]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const deleteReport = async (reportId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('saved_reports')
        .delete()
        .eq('id', reportId);

      if (deleteError) throw deleteError;

      setReports(prev => prev.filter(r => r.id !== reportId));
      return true;
    } catch (err) {
      console.error('Error deleting report:', err);
      return false;
    }
  };

  return {
    reports,
    isLoading,
    error,
    refetch: fetchReports,
    deleteReport,
  };
}

export async function saveReportToDatabase(
  report_type: ReportType,
  title: string,
  input_data: Record<string, unknown>,
  results_data: Record<string, unknown>
): Promise<SavedReport | null> {
  try {
    const { data, error } = await supabase.functions.invoke('save-report', {
      body: { report_type, title, input_data, results_data },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    return data.report as SavedReport;
  } catch (err) {
    console.error('Error saving report:', err);
    throw err;
  }
}
