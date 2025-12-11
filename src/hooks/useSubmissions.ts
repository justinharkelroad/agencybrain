import { useState, useEffect } from "react";
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

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

export function useSubmissions() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionMetrics, setSubmissionMetrics] = useState<Record<string, SubmissionMetrics>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchSubmissions();
    }
  }, [user?.id]);

  const fetchSubmissions = async () => {
    try {
      // Get user's agency first
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user?.id)
        .single();

      if (!profile?.agency_id) {
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
            agency_id
          ),
          team_members(
            name,
            email
          )
        `)
        .eq('form_templates.agency_id', profile.agency_id)
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

  return {
    submissions,
    loading,
    refetch: fetchSubmissions,
    getSubmissionMetrics,
  };
}