import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type MissionControlBrainProfile = Tables<'mission_control_brain_profiles'>;
export type MissionControlBrainProfileKey = 'justin_voice' | 'standard_doctrine';

const profileKey = ['mission-control-brain-profiles'];

export function useMissionControlBrainProfiles(currentUserId: string | null, enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: profileKey,
    enabled: Boolean(enabled && currentUserId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mission_control_brain_profiles')
        .select('*')
        .order('profile_key', { ascending: true });

      if (error) throw error;
      return (data ?? []) as MissionControlBrainProfile[];
    },
  });

  const saveProfile = useMutation({
    mutationFn: async (payload: {
      profile_key: MissionControlBrainProfileKey;
      title: string;
      body: string;
    }) => {
      if (!currentUserId) throw new Error('Missing admin user');

      const upsertPayload: TablesInsert<'mission_control_brain_profiles'> = {
        profile_key: payload.profile_key,
        title: payload.title,
        body: payload.body,
        created_by: currentUserId,
      };

      const { data, error } = await supabase
        .from('mission_control_brain_profiles')
        .upsert(upsertPayload, { onConflict: 'profile_key' })
        .select('*')
        .single();

      if (error) throw error;
      return data as MissionControlBrainProfile;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: profileKey });
      toast.success(`${variables.title} saved`);
    },
    onError: (error) => {
      console.error('Mission Control brain profile save failed', error);
      toast.error('Could not save the brain profile');
    },
  });

  return useMemo(() => {
    const profiles = query.data ?? [];
    const profileMap = new Map(profiles.map((profile) => [profile.profile_key, profile]));

    return {
      profiles,
      voiceProfile: profileMap.get('justin_voice') ?? null,
      doctrineProfile: profileMap.get('standard_doctrine') ?? null,
      isLoading: query.isLoading,
      error: query.error ?? null,
      saveProfile,
    };
  }, [query.data, query.error, query.isLoading, saveProfile]);
}
