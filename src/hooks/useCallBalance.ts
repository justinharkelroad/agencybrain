import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";

export interface CallBalance {
  canScore: boolean;
  subscriptionRemaining: number;
  purchasedRemaining: number;
  bonusRemaining: number;
  bonusExpiresAt: string | null;
  totalRemaining: number;
  message: string;
  isUnlimited: boolean;
  /** True if this is a legacy user (pre-subscription system) */
  isLegacyUser: boolean;
}

export interface CallPack {
  id: string;
  name: string;
  description: string;
  call_count: number;
  price_cents: number;
  stripe_price_id: string | null;
}

export interface UseCallScoreResult {
  success: boolean;
  remaining: number;
  source: 'subscription' | 'purchased' | 'bonus' | 'unlimited' | 'none';
  message: string;
}

/**
 * Get current call scoring balance for the agency
 */
export function useCallBalance() {
  const { user, membershipTier } = useAuth();

  return useQuery({
    queryKey: ["call-balance", user?.id, membershipTier],
    enabled: !!user?.id,
    staleTime: 5000, // 5 seconds - balance changes frequently during scoring
    queryFn: async (): Promise<CallBalance> => {
      // Get user's agency and profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('agency_id, membership_tier')
        .eq('id', user!.id)
        .single();

      if (profileError || !profile?.agency_id) {
        return {
          canScore: false,
          subscriptionRemaining: 0,
          purchasedRemaining: 0,
          bonusRemaining: 0,
          bonusExpiresAt: null,
          totalRemaining: 0,
          message: 'No agency found',
          isUnlimited: false,
          isLegacyUser: false,
        };
      }

      // BACKWARD COMPATIBILITY: Check for legacy 1-on-1 clients
      // They get unlimited call scoring
      const legacyTier = profile.membership_tier || membershipTier;
      if (legacyTier) {
        const normalized = legacyTier.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const is1on1 = normalized.includes('one_on_one') || normalized.includes('1_1');

        // Get agency subscription status
        const { data: agency } = await supabase
          .from('agencies')
          .select('subscription_status')
          .eq('id', profile.agency_id)
          .single();

        // If legacy 1-on-1 client with no subscription_status, grant unlimited
        if (is1on1 && (!agency?.subscription_status || agency.subscription_status === 'none')) {
          return {
            canScore: true,
            subscriptionRemaining: 999999,
            purchasedRemaining: 0,
            bonusRemaining: 0,
            bonusExpiresAt: null,
            totalRemaining: 999999,
            message: 'Unlimited call scoring',
            isUnlimited: true,
            isLegacyUser: true,
          };
        }

        // For other legacy tiers (boardroom, call_scoring), check if they have call scoring access
        // via the old hasTierAccess system - they should have some access
        if (!agency?.subscription_status || agency.subscription_status === 'none') {
          // Legacy boardroom/call_scoring users - grant reasonable default
          return {
            canScore: true,
            subscriptionRemaining: 20, // Default to standard allowance
            purchasedRemaining: 0,
            bonusRemaining: 0,
            bonusExpiresAt: null,
            totalRemaining: 20,
            message: '20 calls remaining (legacy access)',
            isUnlimited: false,
            isLegacyUser: true,
          };
        }
      }

      // NEW USERS: Use the subscription-based call balance system
      const { data, error } = await supabase
        .rpc('check_call_scoring_access', {
          p_agency_id: profile.agency_id,
        });

      if (error) {
        console.error('Error checking call balance:', error);
        // On error, if they have a legacy tier, don't lock them out
        if (legacyTier) {
          return {
            canScore: true,
            subscriptionRemaining: 20,
            purchasedRemaining: 0,
            bonusRemaining: 0,
            bonusExpiresAt: null,
            totalRemaining: 20,
            message: 'Default access (error fallback)',
            isUnlimited: false,
            isLegacyUser: true,
          };
        }
        return {
          canScore: false,
          subscriptionRemaining: 0,
          purchasedRemaining: 0,
          bonusRemaining: 0,
          bonusExpiresAt: null,
          totalRemaining: 0,
          message: 'Unable to check call balance',
          isUnlimited: false,
          isLegacyUser: false,
        };
      }

      const result = data?.[0] || {
        can_score: false,
        subscription_remaining: 0,
        purchased_remaining: 0,
        bonus_remaining: 0,
        total_remaining: 0,
        message: 'No balance found',
      };

      return {
        canScore: result.can_score,
        subscriptionRemaining: result.subscription_remaining,
        purchasedRemaining: result.purchased_remaining,
        bonusRemaining: result.bonus_remaining ?? 0,
        bonusExpiresAt: null, // Expiration not returned by check_call_scoring_access
        totalRemaining: result.total_remaining,
        message: result.message,
        isUnlimited: result.total_remaining >= 999999,
        isLegacyUser: false,
      };
    },
  });
}

/**
 * Use a call score (decrements balance)
 */
export function useUseCallScore() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<UseCallScoreResult> => {
      // Get user's agency
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user!.id)
        .single();

      if (!profile?.agency_id) {
        throw new Error('No agency found');
      }

      const { data, error } = await supabase
        .rpc('use_call_score', {
          p_agency_id: profile.agency_id,
        });

      if (error) throw error;

      const result = data?.[0];
      return {
        success: result?.success || false,
        remaining: result?.remaining || 0,
        source: result?.source || 'none',
        message: result?.message || 'Unknown error',
      };
    },
    onSuccess: () => {
      // Invalidate balance query
      queryClient.invalidateQueries({ queryKey: ["call-balance", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["feature-access", user?.id, "call_scoring"] });
    },
  });
}

/**
 * Get available call packs for purchase
 */
export function useCallPacks() {
  return useQuery({
    queryKey: ["call-packs"],
    staleTime: 60000, // 1 minute - packs don't change often
    queryFn: async (): Promise<CallPack[]> => {
      const { data, error } = await supabase
        .from('call_packs')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });
}

/**
 * Purchase a call pack - creates checkout session
 */
export function usePurchaseCallPack() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      callPackId,
      successUrl,
      cancelUrl,
    }: {
      callPackId: string;
      successUrl?: string;
      cancelUrl?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/purchase-call-pack`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            call_pack_id: callPackId,
            success_url: successUrl || `${window.location.origin}/call-scoring?purchase=success`,
            cancel_url: cancelUrl || `${window.location.origin}/call-scoring?purchase=canceled`,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate after successful purchase starts
      queryClient.invalidateQueries({ queryKey: ["call-balance", user?.id] });
    },
  });
}

/**
 * Format call balance for display
 */
export function formatCallBalance(balance: CallBalance): string {
  if (balance.isUnlimited) {
    return 'Unlimited';
  }
  return `${balance.totalRemaining} calls remaining`;
}

/**
 * Format price in cents to display string
 */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
