import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";

export type AccessType = 'full' | 'limited' | 'none';

export interface FeatureAccessResult {
  canAccess: boolean;
  accessType: AccessType;
  usageLimit: number | null;
  currentUsage: number;
  remaining: number;
  upgradeMessage: string | null;
  /** True if access was granted via legacy membership_tier */
  isLegacyAccess: boolean;
}

/**
 * Check if a feature can be accessed based on subscription status and usage limits
 */
export function useFeatureAccess(featureKey: string) {
  const { user, membershipTier, hasTierAccess } = useAuth();

  return useQuery({
    queryKey: ["feature-access", user?.id, featureKey, membershipTier],
    enabled: !!user?.id && !!featureKey,
    staleTime: 10000, // 10 seconds - features may be used frequently
    queryFn: async (): Promise<FeatureAccessResult> => {
      // Get user's agency and profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('agency_id, membership_tier')
        .eq('id', user!.id)
        .single();

      if (profileError || !profile?.agency_id) {
        return {
          canAccess: false,
          accessType: 'none',
          usageLimit: null,
          currentUsage: 0,
          remaining: 0,
          upgradeMessage: 'Please set up your agency to access this feature.',
          isLegacyAccess: false,
        };
      }

      // BACKWARD COMPATIBILITY: Check if user has legacy membership_tier
      // Legacy users (pre-subscription system) get full access to maintain their experience
      const legacyTier = profile.membership_tier || membershipTier;

      // Get agency subscription status to check if they're a new user
      const { data: agency } = await supabase
        .from('agencies')
        .select('subscription_status')
        .eq('id', profile.agency_id)
        .single();

      const subscriptionStatus = agency?.subscription_status;

      // If user has a legacy tier AND no subscription_status (or 'none'), grant legacy access
      // This protects existing users from being locked out
      if (legacyTier && (!subscriptionStatus || subscriptionStatus === 'none')) {
        // Use the existing hasTierAccess for legacy feature gating
        // Map feature keys to legacy access check
        const legacyFeatureMap: Record<string, string> = {
          'ai_roleplay': 'roleplay-trainer',
          'call_scoring': 'call-scoring',
          'scorecard_view': 'scorecard',
          'scorecard_edit': 'scorecard',
          'training_manage': 'training',
        };

        const legacyFeature = legacyFeatureMap[featureKey] || featureKey;
        const hasLegacyAccess = hasTierAccess(legacyFeature);

        return {
          canAccess: hasLegacyAccess,
          accessType: hasLegacyAccess ? 'full' : 'none',
          usageLimit: -1, // Unlimited for legacy users
          currentUsage: 0,
          remaining: 999999,
          upgradeMessage: hasLegacyAccess ? null : 'Feature not available for your membership tier.',
          isLegacyAccess: true,
        };
      }

      // NEW USERS: Use the subscription-based feature access system
      const { data, error } = await supabase
        .rpc('check_feature_access', {
          p_agency_id: profile.agency_id,
          p_feature_key: featureKey,
        });

      if (error) {
        console.error('Error checking feature access:', error);
        // On error, fall back to allowing access if they have any tier
        // This prevents locking users out due to DB issues
        if (legacyTier) {
          return {
            canAccess: true,
            accessType: 'full',
            usageLimit: -1,
            currentUsage: 0,
            remaining: 999999,
            upgradeMessage: null,
            isLegacyAccess: true,
          };
        }
        return {
          canAccess: false,
          accessType: 'none',
          usageLimit: null,
          currentUsage: 0,
          remaining: 0,
          upgradeMessage: 'Unable to verify feature access.',
          isLegacyAccess: false,
        };
      }

      const result = data?.[0] || {
        can_access: false,
        access_type: 'none',
        usage_limit: null,
        current_usage: 0,
        remaining: 0,
        upgrade_message: 'Feature not available.',
      };

      return {
        canAccess: result.can_access,
        accessType: result.access_type as AccessType,
        usageLimit: result.usage_limit,
        currentUsage: result.current_usage,
        remaining: result.remaining,
        upgradeMessage: result.upgrade_message,
        isLegacyAccess: false,
      };
    },
  });
}

/**
 * Mutation to increment feature usage (for limited features)
 */
export function useIncrementFeatureUsage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ featureKey }: { featureKey: string }) => {
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
        .rpc('increment_feature_usage', {
          p_agency_id: profile.agency_id,
          p_feature_key: featureKey,
        });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { featureKey }) => {
      // Invalidate the feature access query
      queryClient.invalidateQueries({ queryKey: ["feature-access", user?.id, featureKey] });
    },
  });
}

/**
 * Feature key constants for type safety
 */
export const FeatureKeys = {
  // AI Features
  AI_ROLEPLAY: 'ai_roleplay',
  CALL_SCORING: 'call_scoring',

  // Scorecards
  SCORECARD_VIEW: 'scorecard_view',
  SCORECARD_SUBMIT: 'scorecard_submit',
  SCORECARD_EDIT: 'scorecard_edit',
  SCORECARD_CREATE: 'scorecard_create',
  SCORECARD_SETTINGS: 'scorecard_settings',

  // Training
  TRAINING_STANDARD: 'training_standard',
  TRAINING_MANAGE: 'training_manage',
  TRAINING_AGENCY: 'training_agency',

  // Agency Tools
  COMP_ANALYZER: 'comp_analyzer',
  COMMISSION_BUILDER: 'commission_builder',
  BONUS_TOOL: 'bonus_tool',
  CALL_EFFICIENCY: 'call_efficiency',

  // Personal Growth
  CORE4: 'core4',
  MONTHLY_MISSIONS: 'monthly_missions',
  LIFE_TARGETS: 'life_targets',
  QUARTERLY_TARGETS: 'quarterly_targets',
  NINETY_DAY_AUDIO: '90_day_audio',

  // Core Features
  DASHBOARD: 'dashboard',
  CANCEL_AUDIT: 'cancel_audit',
  WINBACK_HQ: 'winback_hq',
  RENEWAL_TRACKING: 'renewal_tracking',
  LQS_TRACKING: 'lqs_tracking',
  SALES: 'sales',
  LEADERBOARD: 'leaderboard',
  TEAM_RINGS: 'team_rings',
  CONTACTS: 'contacts',
} as const;

export type FeatureKey = typeof FeatureKeys[keyof typeof FeatureKeys];
