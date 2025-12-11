import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { FlowProfile } from '@/types/flows';
import { useStaffAuth } from '@/hooks/useStaffAuth';

export function useStaffFlowProfile() {
  const { sessionToken, user } = useStaffAuth();
  const [profile, setProfile] = useState<FlowProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!sessionToken) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get_staff_flows', {
        headers: {
          'x-staff-session': sessionToken,
        },
      });

      if (error) {
        throw error;
      }

      setProfile(data?.profile || null);
    } catch (err: any) {
      console.error('Error fetching staff flow profile:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    if (sessionToken) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [sessionToken, fetchProfile]);

  const saveProfile = async (profileData: Partial<FlowProfile>) => {
    if (!sessionToken) return { error: 'Not authenticated' };

    try {
      const { data, error } = await supabase.functions.invoke('save_staff_flow_profile', {
        headers: {
          'x-staff-session': sessionToken,
        },
        body: { profileData },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setProfile(data?.profile || null);
      return { data: data?.profile };
    } catch (err: any) {
      console.error('Error saving staff flow profile:', err);
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
    staffUserId: user?.id,
  };
}
