import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { CostType } from '@/types/lqs';

interface LeadSource {
  id: string;
  name: string;
  is_active: boolean;
  order_index: number;
  bucket_id: string | null;
  is_self_generated: boolean;
  cost_type: CostType;
  cost_per_lead_cents: number | null; // Legacy field for backward compatibility
}

export const useLeadSources = () => {
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchLeadSources = async () => {
    if (!user?.id) {
      setLeadSources([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get user's agency_id from profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile?.agency_id) {
        setError('User profile not found or not associated with an agency');
        setLeadSources([]);
        return;
      }

      // Fetch lead sources for the agency
      const { data, error: leadSourceError } = await supabase
        .from('lead_sources')
        .select('*')
        .eq('agency_id', profile.agency_id)
        .order('order_index', { ascending: true });

      if (leadSourceError) throw leadSourceError;

      setLeadSources(data || []);
    } catch (err) {
      console.error('Error fetching lead sources:', err);
      setError(err instanceof Error ? err.message : 'Failed to load lead sources');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeadSources();
  }, [user?.id]);

  return { 
    leadSources: leadSources.filter(ls => ls.is_active), 
    allLeadSources: leadSources,
    loading, 
    error,
    refetch: fetchLeadSources
  };
};