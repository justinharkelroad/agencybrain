import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { FlowProfile } from '@/types/flows';
import { useAuth } from '@/lib/auth';

export function useFlowProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<FlowProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchProfile = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('flow_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      setProfile(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async (profileData: Partial<FlowProfile>) => {
    if (!user?.id) return { error: 'Not authenticated' };

    try {
      const { data, error } = await supabase
        .from('flow_profiles')
        .upsert({
          user_id: user.id,
          ...profileData,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        })
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      return { data };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const hasProfile = !!profile?.preferred_name;

  return {
    profile,
    loading,
    error,
    saveProfile,
    refetch: fetchProfile,
    hasProfile,
  };
}
