import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { isStrictlyOneOnOne } from '@/utils/tierAccess';

type MissionControlAccessReason =
  | 'admin_preview'
  | 'admin_target'
  | 'missing_user'
  | 'key_employee_blocked'
  | 'not_owner'
  | 'wrong_tier'
  | 'no_agency'
  | 'feature_disabled'
  | 'ok';

export interface MissionControlAccessResult {
  hasAccess: boolean;
  agencyId: string | null;
  ownerUserId: string | null;
  targetOwnerName: string | null;
  agencyName: string | null;
  featureEnabled: boolean;
  reason: MissionControlAccessReason;
}

export function useMissionControlAccess(targetOwnerUserId?: string | null) {
  const { user, isAdmin, isAgencyOwner, isKeyEmployee, membershipTier } = useAuth();

  return useQuery({
    queryKey: [
      'mission-control-access',
      user?.id,
      isAdmin,
      isAgencyOwner,
      isKeyEmployee,
      membershipTier,
      targetOwnerUserId,
    ],
    enabled: isAdmin || !!user?.id,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<MissionControlAccessResult> => {
      if (isAdmin) {
        if (targetOwnerUserId) {
          const { data: targetProfile, error: targetProfileError } = await supabase
            .from('profiles')
            .select('id, agency_id, full_name, email, membership_tier')
            .eq('id', targetOwnerUserId)
            .maybeSingle();

          if (!targetProfileError && targetProfile?.agency_id && isStrictlyOneOnOne(targetProfile.membership_tier)) {
            const [{ data: featureEnabled }, { data: agency }] = await Promise.all([
              supabase.rpc('has_feature_access', {
                p_agency_id: targetProfile.agency_id,
                p_feature_key: 'mission_control',
              }),
              supabase
                .from('agencies')
                .select('name')
                .eq('id', targetProfile.agency_id)
                .maybeSingle(),
            ]);

            return {
              hasAccess: true,
              agencyId: targetProfile.agency_id,
              ownerUserId: targetProfile.id,
              targetOwnerName: targetProfile.full_name || targetProfile.email || 'Selected owner',
              agencyName: agency?.name ?? null,
              featureEnabled: featureEnabled === true,
              reason: 'admin_target',
            };
          }
        }

        return {
          hasAccess: true,
          agencyId: null,
          ownerUserId: null,
          targetOwnerName: null,
          agencyName: null,
          featureEnabled: false,
          reason: 'admin_preview',
        };
      }

      if (!user?.id) {
        return {
          hasAccess: false,
          agencyId: null,
          ownerUserId: null,
          targetOwnerName: null,
          agencyName: null,
          featureEnabled: false,
          reason: 'missing_user',
        };
      }

      if (isKeyEmployee) {
        return {
          hasAccess: false,
          agencyId: null,
          ownerUserId: user.id,
          targetOwnerName: null,
          agencyName: null,
          featureEnabled: false,
          reason: 'key_employee_blocked',
        };
      }

      if (!isAgencyOwner) {
        return {
          hasAccess: false,
          agencyId: null,
          ownerUserId: user.id,
          targetOwnerName: null,
          agencyName: null,
          featureEnabled: false,
          reason: 'not_owner',
        };
      }

      if (!isStrictlyOneOnOne(membershipTier)) {
        return {
          hasAccess: false,
          agencyId: null,
          ownerUserId: user.id,
          targetOwnerName: null,
          agencyName: null,
          featureEnabled: false,
          reason: 'wrong_tier',
        };
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('agency_id, full_name, email')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || !profile?.agency_id) {
        return {
          hasAccess: false,
          agencyId: null,
          ownerUserId: user.id,
          targetOwnerName: null,
          agencyName: null,
          featureEnabled: false,
          reason: 'no_agency',
        };
      }

      const [{ data, error }, { data: agency }] = await Promise.all([
        supabase.rpc('has_feature_access', {
          p_agency_id: profile.agency_id,
          p_feature_key: 'mission_control',
        }),
        supabase
          .from('agencies')
          .select('name')
          .eq('id', profile.agency_id)
          .maybeSingle(),
      ]);

      if (error || data !== true) {
        return {
          hasAccess: false,
          agencyId: profile.agency_id,
          ownerUserId: user.id,
          targetOwnerName: profile.full_name || profile.email || null,
          agencyName: agency?.name ?? null,
          featureEnabled: false,
          reason: 'feature_disabled',
        };
      }

      return {
        hasAccess: true,
        agencyId: profile.agency_id,
        ownerUserId: user.id,
        targetOwnerName: profile.full_name || profile.email || null,
        agencyName: agency?.name ?? null,
        featureEnabled: true,
        reason: 'ok',
      };
    },
  });
}
