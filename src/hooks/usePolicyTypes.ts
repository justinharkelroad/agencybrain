import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';

interface PolicyType {
  id: string;
  name: string;
  is_active: boolean;
  order_index: number;
}

export const usePolicyTypes = () => {
  const [policyTypes, setPolicyTypes] = useState<PolicyType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchPolicyTypes = async () => {
    if (!user?.id) {
      setPolicyTypes([]);
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
        setPolicyTypes([]);
        return;
      }

      // Fetch policy types for the agency
      const { data, error: policyTypeError } = await supabase
        .from('policy_types')
        .select('*')
        .eq('agency_id', profile.agency_id)
        .order('order_index', { ascending: true });

      if (policyTypeError) throw policyTypeError;

      setPolicyTypes(data || []);
    } catch (err) {
      console.error('Error fetching policy types:', err);
      setError(err instanceof Error ? err.message : 'Failed to load policy types');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicyTypes();
  }, [user?.id]);

  return { 
    policyTypes: policyTypes.filter(pt => pt.is_active), 
    allPolicyTypes: policyTypes,
    loading, 
    error,
    refetch: fetchPolicyTypes
  };
};
