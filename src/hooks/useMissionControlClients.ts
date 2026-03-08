import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { isStrictlyOneOnOne } from '@/utils/tierAccess';

export interface MissionControlClientOption {
  agencyId: string;
  agencyName: string;
  featureEnabled: boolean;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string | null;
}

export function useMissionControlClients() {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ['mission-control-client-options', isAdmin],
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

      const [{ data: agencies, error: agenciesError }, { data: featureAccess, error: accessError }] = await Promise.all([
        supabase
          .from('agencies')
          .select('id, name')
          .in('id', agencyIds),
        supabase
          .from('agency_feature_access')
          .select('agency_id')
          .eq('feature_key', 'mission_control')
          .in('agency_id', agencyIds),
      ]);

      if (agenciesError) throw agenciesError;
      if (accessError) throw accessError;

      const agencyMap = new Map((agencies ?? []).map((agency) => [agency.id, agency.name]));
      const enabledAgencyIds = new Set((featureAccess ?? []).map((entry) => entry.agency_id));

      return ownerProfiles
        .map((profile) => ({
          agencyId: profile.agency_id as string,
          agencyName: agencyMap.get(profile.agency_id as string) ?? 'Unknown agency',
          featureEnabled: enabledAgencyIds.has(profile.agency_id as string),
          ownerUserId: profile.id,
          ownerName: profile.full_name || profile.email || 'Unnamed owner',
          ownerEmail: profile.email ?? null,
        }))
        .sort((left, right) => {
          if (left.featureEnabled !== right.featureEnabled) {
            return left.featureEnabled ? -1 : 1;
          }

          return `${left.agencyName}${left.ownerName}`.localeCompare(`${right.agencyName}${right.ownerName}`);
        });
    },
  });
}
