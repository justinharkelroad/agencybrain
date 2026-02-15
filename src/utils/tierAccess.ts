// Canonical tier types
export type TierType = 'one_on_one' | 'boardroom' | 'call_scoring' | 'challenge_only' | 'inactive' | 'unknown';

/**
 * Normalize any tier string to a canonical format
 * Handles: "1:1 Coaching", "one_on_one", "1-on-1", "One on One", "Boardroom", etc.
 */
export function normalizeTier(tier: string | null | undefined): TierType {
  if (!tier) return 'unknown';
  
  const lowerTier = tier.toLowerCase();
  
  // Boardroom check
  if (lowerTier.includes('boardroom')) return 'boardroom';

  // Call Scoring check
  if (lowerTier.includes('call scoring') || lowerTier.includes('call_scoring')) return 'call_scoring';

  // Six Week Challenge check
  if (lowerTier.includes('six week challenge') || lowerTier.includes('challenge')) return 'challenge_only';

  // Inactive check
  if (lowerTier === 'inactive') return 'inactive';
  
  // 1:1 Coaching variants - this catches ALL formats
  if (
    lowerTier.includes('1:1') ||
    lowerTier.includes('1-on-1') ||
    lowerTier.includes('one_on_one') ||
    lowerTier.includes('one-on-one') ||
    lowerTier.includes('one on one') ||
    lowerTier.includes('coaching')
  ) {
    return 'one_on_one';
  }
  
  return 'unknown';
}

/**
 * Check if tier has 1:1 Coaching level access (includes Boardroom)
 */
export function hasOneOnOneAccess(tier: string | null | undefined): boolean {
  const normalized = normalizeTier(tier);
  return normalized === 'one_on_one' || normalized === 'boardroom';
}

/**
 * Check if tier is strictly 1:1 Coaching (NOT Boardroom)
 * Use this for features exclusive to 1:1 Coaching tier only
 */
export function isStrictlyOneOnOne(tier: string | null | undefined): boolean {
  return normalizeTier(tier) === 'one_on_one';
}

/**
 * Check if tier has Boardroom level access (highest tier)
 */
export function hasBoardroomAccess(tier: string | null | undefined): boolean {
  return normalizeTier(tier) === 'boardroom';
}

/**
 * Check if tier is Call Scoring only (limited access)
 */
export function isCallScoringTier(tier: string | null | undefined): boolean {
  return normalizeTier(tier) === 'call_scoring';
}

/**
 * Check if tier is Six Week Challenge only (limited access)
 */
export function isChallengeTier(tier: string | null | undefined): boolean {
  return normalizeTier(tier) === 'challenge_only';
}

/**
 * Get the appropriate staff home path based on tier
 * Call Scoring tier goes to /staff/call-scoring, Challenge tier to /staff/challenge, everyone else to /staff/dashboard
 */
export function getStaffHomePath(tier: string | null | undefined): string {
  if (isCallScoringTier(tier)) return '/staff/call-scoring';
  if (isChallengeTier(tier)) return '/staff/challenge';
  return '/staff/dashboard';
}

/**
 * Get the appropriate owner home path based on tier
 * Challenge tier goes to /training/challenge, everyone else to /dashboard
 */
export function getOwnerHomePath(tier: string | null | undefined): string {
  if (isChallengeTier(tier)) return '/training/challenge';
  if (isCallScoringTier(tier)) return '/call-scoring';
  return '/dashboard';
}
