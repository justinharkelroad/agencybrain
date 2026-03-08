import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { isStrictlyOneOnOne } from '@/utils/tierAccess';

export interface MissionControlClientOption {
  agencyId: string;
  agencyName: string;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string | null;
}

export function useMissionControlClients() {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ['mission-control-clients', isAdmin],
    enabled: isAdmin,
    staleTime: 60_000,
    queryFn: async (): Promise<MissionControlClientOption[]> => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, agency_id, full_name, email, membership_tier')
        .not('agency_id', 'is', null)
        .order('full_name', { ascending: true });

      if (profilesError) throw profilesError;

      const ownerProfiles = (profiles ?? []).filter(
        (profile) => Boolean(profile.agency_id) && isStrictlyOneOnOne(profile.membership_tier)
      );

      const agencyIds = [...new Set(ownerProfiles.map((profile) => profile.agency_id).filter(Boolean))] as string[];

      const { data: agencies, error: agenciesError } = await supabase
        .from('agencies')
        .select('id, name')
        .in('id', agencyIds);

      if (agenciesError) throw agenciesError;

      const agencyMap = new Map((agencies ?? []).map((agency) => [agency.id, agency.name]));

      return ownerProfiles.map((profile) => ({
        agencyId: profile.agency_id as string,
        agencyName: agencyMap.get(profile.agency_id as string) ?? 'Unknown agency',
        ownerUserId: profile.id,
        ownerName: profile.full_name || profile.email || 'Unnamed owner',
        ownerEmail: profile.email ?? null,
      }));
    },
  });
}
