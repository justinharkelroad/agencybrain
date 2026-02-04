import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";

export type SubscriptionStatus = 'none' | 'trialing' | 'active' | 'canceled' | 'past_due' | 'unpaid' | '1on1_client';

export interface Subscription {
  id: string;
  agency_id: string;
  stripe_subscription_id: string;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_start: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
}

export interface SubscriptionData {
  status: SubscriptionStatus;
  subscription: Subscription | null;
  isTrialing: boolean;
  isActive: boolean;
  isPaid: boolean;
  is1on1Client: boolean;
  trialDaysRemaining: number | null;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  /** True if user has legacy membership_tier (pre-subscription system) */
  isLegacyUser: boolean;
}

/**
 * Maps legacy membership_tier to new subscription_status
 * This ensures existing users maintain their access
 */
function mapLegacyTierToStatus(membershipTier: string | null): SubscriptionStatus {
  if (!membershipTier) return 'none';

  const normalized = membershipTier.toLowerCase().replace(/[^a-z0-9]/g, '_');

  // 1-on-1 coaching clients get unlimited access
  if (normalized.includes('one_on_one') || normalized.includes('1_1') || normalized === 'one_on_one') {
    return '1on1_client';
  }

  // Boardroom and Call Scoring tiers are treated as active (paid)
  if (normalized.includes('boardroom') || normalized.includes('call_scoring')) {
    return 'active';
  }

  // Any other existing tier defaults to active to not break access
  return 'active';
}

export function useSubscription() {
  const { user, membershipTier, isKeyEmployee, keyEmployeeAgencyId } = useAuth();

  return useQuery({
    queryKey: ["subscription", user?.id, keyEmployeeAgencyId],
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
    queryFn: async (): Promise<SubscriptionData> => {
      // Get user's agency and profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('agency_id, membership_tier')
        .eq('id', user!.id)
        .single();

      // Determine agency_id: use profile.agency_id for owners, keyEmployeeAgencyId for key employees
      const agencyId = profile?.agency_id || keyEmployeeAgencyId;

      if (!agencyId) {
        return {
          status: 'none',
          subscription: null,
          isTrialing: false,
          isActive: false,
          isPaid: false,
          is1on1Client: false,
          trialDaysRemaining: null,
          periodEnd: null,
          cancelAtPeriodEnd: false,
          isLegacyUser: false,
        };
      }

      // Get agency subscription status
      const { data: agency } = await supabase
        .from('agencies')
        .select('subscription_status')
        .eq('id', agencyId)
        .single();

      let status = (agency?.subscription_status || 'none') as SubscriptionStatus;

      // BACKWARD COMPATIBILITY: Check for legacy membership_tier
      // If subscription_status is 'none' but user has a membership_tier, use the legacy tier
      const legacyTier = profile?.membership_tier || membershipTier;
      const isLegacyUser = (status === 'none' || !status) && !!legacyTier;

      if (isLegacyUser && legacyTier) {
        status = mapLegacyTierToStatus(legacyTier);
      }

      // Get detailed subscription record (may not exist for legacy users)
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Calculate trial days remaining
      let trialDaysRemaining: number | null = null;
      if (status === 'trialing' && subscription?.trial_end) {
        const trialEnd = new Date(subscription.trial_end);
        const now = new Date();
        const diffMs = trialEnd.getTime() - now.getTime();
        trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }

      return {
        status,
        subscription: subscription as Subscription | null,
        isTrialing: status === 'trialing',
        isActive: status === 'active',
        isPaid: status === 'active' || status === '1on1_client',
        is1on1Client: status === '1on1_client',
        trialDaysRemaining,
        periodEnd: subscription?.current_period_end ? new Date(subscription.current_period_end) : null,
        cancelAtPeriodEnd: subscription?.cancel_at_period_end || false,
        isLegacyUser,
      };
    },
  });
}
