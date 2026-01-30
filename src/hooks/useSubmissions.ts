import { useState, useEffect } from "react";
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { fetchWithAuth } from "@/lib/staffRequest";

interface Submission {
  id: string;
  team_member_id: string;
  form_template_id: string;
  submission_date: string;
  work_date: string;
  submitted_at: string;
  payload_json: any;
  late: boolean;
  final: boolean;
  form_templates?: {
    name: string;
    slug: string;
    schema_json?: {
      kpis?: Array<{
        key: string;
        label: string;
        type?: string;
      }>;
    };
  };
  team_members?: {
    name: string;
    email: string;
  };
}

interface SubmissionMetrics {
  submission_id: string;
  outbound_calls: number | null;
  talk_minutes: number | null;
  quoted_count: number | null;
  sold_items: number | null;
}

export function useSubmissions(staffAgencyId?: string) {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionMetrics, setSubmissionMetrics] = useState<Record<string, SubmissionMetrics>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch if we have either a user ID or staffAgencyId
    if (user?.id || staffAgencyId) {
      fetchSubmissions();
    }
  }, [user?.id, staffAgencyId]);

  const fetchSubmissions = async () => {
    try {
      // If staffAgencyId is provided, use edge function (staff user)
      if (staffAgencyId) {
        const staffToken = localStorage.getItem('staff_session_token');
        if (!staffToken) {
          console.error('No staff token found for staff submissions fetch');
          setSubmissions([]);
          setLoading(false);
          return;
        }

        // Use fetchWithAuth to avoid JWT collision when owner is also logged in
        const response = await fetchWithAuth('scorecards_admin', {
          method: 'POST',
          body: { action: 'submissions_list' },
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          console.error('Edge function error:', data.error);
          throw new Error(data.error || 'Failed to fetch submissions');
        }

        if (data?.error) {
          console.error('scorecards_admin error:', data.error);
          throw new Error(data.error);
        }

        const submissionsData = data?.submissions || [];
        setSubmissions(submissionsData);

        // Build metrics map from submission data (edge function includes metrics in payload_json)
        const metricsMap: Record<string, SubmissionMetrics> = {};
        submissionsData.forEach((s: Submission) => {
          if (s.payload_json) {
            metricsMap[s.id] = {
              submission_id: s.id,
              outbound_calls: s.payload_json.outbound_calls || null,
              talk_minutes: s.payload_json.talk_minutes || null,
              quoted_count: s.payload_json.quoted_households || s.payload_json.quoted_count || null,
              sold_items: s.payload_json.items_sold || s.payload_json.sold_items || null,
            };
          }
        });
        setSubmissionMetrics(metricsMap);
        setLoading(false);
        return;
      }

      // Standard Supabase RLS path for authenticated owners
      let agencyId: string | undefined;
      
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('id', user.id)
          .single();
        agencyId = profile?.agency_id;
      }

      if (!agencyId) {
        setSubmissions([]);
        setLoading(false);
        return;
      }

      // Fetch submissions for forms from this agency
      const { data: submissionsData, error } = await supabase
        .from('submissions')
        .select(`
          *,
          form_templates!inner(
            name,
            slug,
            agency_id,
            schema_json
          ),
          team_members(
            name,
            email
          )
        `)
        .eq('form_templates.agency_id', agencyId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setSubmissions(submissionsData || []);

      // Fetch metrics for submissions
      if (submissionsData && submissionsData.length > 0) {
        const submissionIds = submissionsData.map(s => s.id);
        const { data: metricsData } = await supabase
          .from('vw_submission_metrics')
          .select('*')
          .in('submission_id', submissionIds);

        const metricsMap: Record<string, SubmissionMetrics> = {};
        if (metricsData) {
          metricsData.forEach(metric => {
            metricsMap[metric.submission_id] = metric;
          });
        }
        setSubmissionMetrics(metricsMap);
      }
    } catch (error: any) {
      console.error('Error fetching submissions:', error);
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get metrics with fallback to payload_json
  const getSubmissionMetrics = (submission: Submission) => {
    const viewMetrics = submissionMetrics[submission.id];
    if (viewMetrics) {
      return {
        outbound_calls: viewMetrics.outbound_calls || 0,
        talk_minutes: viewMetrics.talk_minutes || 0,
        quoted_count: viewMetrics.quoted_count || 0,
        sold_items: viewMetrics.sold_items || 0,
      };
    }

    // Fallback to payload_json - check both key variations
    const payload = submission.payload_json || {};
    return {
      outbound_calls: payload.outbound_calls || 0,
      talk_minutes: payload.talk_minutes || 0,
      quoted_count: payload.quoted_households || payload.quoted_count || 0,
      sold_items: payload.items_sold || payload.sold_items || 0,
    };
  };

  // Get dynamic KPI metrics based on form template schema
  const getDynamicKpiMetrics = (submission: Submission): Array<{ label: string; value: number | string }> => {
    const kpis = submission.form_templates?.schema_json?.kpis;
    const payload = submission.payload_json || {};

    // Helper to find value by checking multiple possible keys
    const getKpiValue = (kpi: any): number | string => {
      // Check the full key first (e.g., "custom_kpi_0")
      if (kpi.key && payload[kpi.key] !== undefined) {
        return payload[kpi.key];
      }

      // Check the selectedKpiSlug (e.g., "outbound_calls")
      if (kpi.selectedKpiSlug && payload[kpi.selectedKpiSlug] !== undefined) {
        return payload[kpi.selectedKpiSlug];
      }

      // IMPORTANT: Check stripped key suffix for preselected_kpi_N_<suffix> format
      // The submit function strips the prefix, so "preselected_kpi_2_cross_sells_uncovered"
      // becomes "cross_sells_uncovered" in the payload
      if (kpi.key && /^preselected_kpi_\d+_/.test(kpi.key)) {
        const strippedKey = kpi.key.replace(/^preselected_kpi_\d+_/, '');
        if (payload[strippedKey] !== undefined) {
          return payload[strippedKey];
        }
      }

      // Check common variations of the slug with underscores/dashes
      const slug = kpi.selectedKpiSlug || kpi.key || '';
      const snakeCase = slug.replace(/-/g, '_').toLowerCase();
      if (payload[snakeCase] !== undefined) {
        return payload[snakeCase];
      }

      return 0;
    };

    // If form has KPIs defined in schema, use those
    if (kpis && kpis.length > 0) {
      return kpis.slice(0, 4).map(kpi => ({
        label: kpi.label,
        value: getKpiValue(kpi),
      }));
    }

    // Fallback to default sales metrics for legacy forms without schema
    return [
      { label: 'Calls', value: payload.outbound_calls ?? 0 },
      { label: 'Minutes', value: payload.talk_minutes ?? 0 },
      { label: 'Quoted', value: payload.quoted_households ?? payload.quoted_count ?? 0 },
      { label: 'Sold', value: payload.items_sold ?? payload.sold_items ?? 0 },
    ];
  };

  return {
    submissions,
    loading,
    refetch: fetchSubmissions,
    getSubmissionMetrics,
    getDynamicKpiMetrics,
  };
}