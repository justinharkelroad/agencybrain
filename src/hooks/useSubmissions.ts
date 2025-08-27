import { useState, useEffect } from "react";
import { supa } from '@/lib/supabase';
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

export function useSubmissions() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchSubmissions();
    }
  }, [user?.id]);

  const fetchSubmissions = async () => {
    try {
      // Get user's agency first
      const { data: profile } = await supa
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
      const { data: submissionsData, error } = await supa
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
    } catch (error: any) {
      console.error('Error fetching submissions:', error);
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  return {
    submissions,
    loading,
    refetch: fetchSubmissions,
  };
}