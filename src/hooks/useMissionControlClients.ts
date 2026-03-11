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

function normalizeAgencyName(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : 'Unknown agency';
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
        .select('id, agency_id, full_name, email, membership_tier, role')
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

      const agencyMap = new Map((agencies ?? []).map((agency) => [agency.id, normalizeAgencyName(agency.name)]));

      const primaryOwnersByAgency = new Map<string, (typeof ownerProfiles)[number]>();

      ownerProfiles.forEach((profile) => {
        const agencyId = profile.agency_id as string;
        const existing = primaryOwnersByAgency.get(agencyId);

        if (!existing) {
          primaryOwnersByAgency.set(agencyId, profile);
          return;
        }

        if (profile.role === 'admin' && existing.role !== 'admin') {
          primaryOwnersByAgency.set(agencyId, profile);
        }
      });

      return [...primaryOwnersByAgency.values()].map((profile) => ({
        agencyId: profile.agency_id as string,
        agencyName: agencyMap.get(profile.agency_id as string) ?? 'Unknown agency',
        ownerUserId: profile.id,
        ownerName: profile.full_name || profile.email || 'Unnamed owner',
        ownerEmail: profile.email ?? null,
      }));
    },
  });
}
