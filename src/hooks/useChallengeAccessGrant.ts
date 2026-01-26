import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ChallengeAccessGrant {
  grantedIds: string[];
  hasAccess: boolean;
  isLoading: boolean;
  error: string | null;
}

// Session storage key for caching
const CACHE_KEY = 'challenge_access_grant';
const CACHE_EXPIRY_KEY = 'challenge_access_grant_expiry';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to check if a staff user has temporary access grants from challenge assignments.
 * Call Scoring tier staff with active challenge assignments get Core 4 + Flows access.
 *
 * @param staffUserId - The staff user's UUID (from useStaffAuth().user.id)
 */
export function useChallengeAccessGrant(staffUserId: string | null | undefined): ChallengeAccessGrant {
  const [grantedIds, setGrantedIds] = useState<string[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccessGrant = useCallback(async () => {
    if (!staffUserId) {
      setIsLoading(false);
      return;
    }

    // Check session cache first
    const cachedExpiry = sessionStorage.getItem(CACHE_EXPIRY_KEY);
    const cachedData = sessionStorage.getItem(CACHE_KEY);

    if (cachedExpiry && cachedData) {
      const expiryTime = parseInt(cachedExpiry, 10);
      if (Date.now() < expiryTime) {
        try {
          const cached = JSON.parse(cachedData);
          setGrantedIds(cached.granted_ids || []);
          setHasAccess(cached.has_access || false);
          setIsLoading(false);
          return;
        } catch {
          // Invalid cache, continue to fetch
        }
      }
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('get_staff_challenge_access_grant', {
        p_staff_user_id: staffUserId,
      });

      if (rpcError) {
        console.error('[useChallengeAccessGrant] RPC error:', rpcError);
        setError(rpcError.message);
        setGrantedIds([]);
        setHasAccess(false);
      } else if (data) {
        const result = data as { has_access: boolean; granted_ids: string[] };
        setGrantedIds(result.granted_ids || []);
        setHasAccess(result.has_access || false);

        // Cache the result
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(result));
        sessionStorage.setItem(CACHE_EXPIRY_KEY, String(Date.now() + CACHE_DURATION_MS));
      }
    } catch (err) {
      console.error('[useChallengeAccessGrant] Fetch error:', err);
      setError('Failed to fetch challenge access grant');
      setGrantedIds([]);
      setHasAccess(false);
    } finally {
      setIsLoading(false);
    }
  }, [staffUserId]);

  useEffect(() => {
    fetchAccessGrant();
  }, [fetchAccessGrant]);

  return {
    grantedIds,
    hasAccess,
    isLoading,
    error,
  };
}

/**
 * Clear the challenge access grant cache.
 * Call this when challenge assignment status changes.
 */
export function clearChallengeAccessGrantCache(): void {
  sessionStorage.removeItem(CACHE_KEY);
  sessionStorage.removeItem(CACHE_EXPIRY_KEY);
}
