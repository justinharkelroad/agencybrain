import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import { normalizeTier, isCallScoringTier } from '@/utils/tierAccess';
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  adminLoading: boolean;
  tierLoading: boolean;
  roleLoading: boolean;
  signUp: (email: string, password: string, agencyName: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isAgencyOwner: boolean;
  isKeyEmployee: boolean;
  keyEmployeeAgencyId: string | null;
  membershipTier: string | null;
  hasTierAccess: (feature: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminLoading, setAdminLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAgencyOwner, setIsAgencyOwner] = useState(false);
  const [isKeyEmployee, setIsKeyEmployee] = useState(false);
  const [keyEmployeeAgencyId, setKeyEmployeeAgencyId] = useState<string | null>(null);
  const [membershipTier, setMembershipTier] = useState<string | null>(null);
  const [tierLoading, setTierLoading] = useState(true);
  const queryClient = useQueryClient();

  // AbortController refs to cancel in-flight requests when auth state changes
  const roleCheckAbortRef = useRef<AbortController | null>(null);
  const tierCheckAbortRef = useRef<AbortController | null>(null);

  // Track the last user ID we checked roles/tiers for to avoid redundant checks
  // This prevents the tierLoading flash when tab regains focus
  const lastCheckedUserIdRef = useRef<string | null>(null);

  // Track if a proactive token refresh is in progress to prevent duplicate refreshes
  const isRefreshingTokenRef = useRef(false);

  const checkUserRole = useCallback(async (userId: string, signal?: AbortSignal) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle()
        .abortSignal(signal);

      if (signal?.aborted) return;

      if (!error && data) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      console.error('Error checking user role:', error);
      setIsAdmin(false);
    } finally {
      if (!signal?.aborted) {
        setAdminLoading(false);
      }
    }
  }, []);

  const checkMembershipTier = useCallback(async (userId: string, signal?: AbortSignal, skipLoadingState?: boolean) => {
    // Only set loading state if this is a fresh check, not a redundant re-check
    // This prevents ProtectedRoute from unmounting children when tab regains focus
    if (!skipLoadingState) {
      setTierLoading(true);
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('membership_tier, agency_id')
        .eq('id', userId)
        .maybeSingle()
        .abortSignal(signal);

      if (signal?.aborted) return;

      if (!error && data) {
        // User is an agency owner if they have an agency_id
        setIsAgencyOwner(!!data.agency_id);
      } else {
        setIsAgencyOwner(false);
      }

      // Check if user is a key employee
      const { data: keyEmployeeData, error: keyEmployeeError } = await supabase
        .from('key_employees')
        .select('agency_id, invited_by')
        .eq('user_id', userId)
        .maybeSingle()
        .abortSignal(signal);

      if (signal?.aborted) return;

      if (keyEmployeeError) {
        console.error('[Auth] Key employee lookup failed:', keyEmployeeError);
      }

      if (keyEmployeeData) {
        setIsKeyEmployee(true);
        setKeyEmployeeAgencyId(keyEmployeeData.agency_id);

        // Resolve tier from an owner-level profile in the same agency.
        // This avoids incorrect inheritance when invited_by is stale or self-referential.
        const { data: ownerTierProfile } = await supabase
          .from('profiles')
          .select('id, membership_tier, role, created_at')
          .eq('agency_id', keyEmployeeData.agency_id)
          .not('membership_tier', 'is', null)
          .order('created_at', { ascending: true })
          .abortSignal(signal);

        if (signal?.aborted) return;

        let resolvedTier: string | null = null;

        if (Array.isArray(ownerTierProfile) && ownerTierProfile.length > 0) {
          const ownerCandidate =
            ownerTierProfile.find((p: any) => p?.role === 'admin') ||
            ownerTierProfile.find((p: any) => p?.id && p.id !== userId) ||
            ownerTierProfile[0];

          resolvedTier = ownerCandidate?.membership_tier ?? null;
          if (resolvedTier) {
            console.log('[Auth] Key employee inheriting tier from agency profile:', resolvedTier);
          }
        }

        // Fallback to inviter tier if agency-level owner lookup did not resolve.
        if (!resolvedTier && keyEmployeeData.invited_by) {
          const { data: inviterProfile } = await supabase
            .from('profiles')
            .select('membership_tier')
            .eq('id', keyEmployeeData.invited_by)
            .maybeSingle()
            .abortSignal(signal);

          if (signal?.aborted) return;

          if (inviterProfile?.membership_tier) {
            resolvedTier = inviterProfile.membership_tier;
            console.log('[Auth] Key employee inheriting tier from inviter fallback:', resolvedTier);
          }
        }

        // Final fallback to user's own tier if no source resolved.
        setMembershipTier(resolvedTier ?? data?.membership_tier ?? null);
      } else {
        setIsKeyEmployee(false);
        setKeyEmployeeAgencyId(null);
        // Not a key employee - use their own tier
        setMembershipTier(data?.membership_tier ?? null);
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      console.error('Error checking membership tier:', error);
      if (!signal?.aborted) {
        setMembershipTier(null);
        setIsAgencyOwner(false);
        setIsKeyEmployee(false);
        setKeyEmployeeAgencyId(null);
      }
    } finally {
      if (!signal?.aborted) {
        setTierLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Clear user-specific cache on auth state change
        if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
          queryClient.removeQueries({ queryKey: ["focus-items"] });
          queryClient.removeQueries({ queryKey: ["brainstorm-targets"] });
          queryClient.removeQueries({ queryKey: ["quarterly-targets"] });
          queryClient.removeQueries({ queryKey: ["auth-user"] });
        }
        
        // On Supabase Auth sign-in, only clear staff tokens if NOT in staff mode
        // This prevents the destructive collision when an owner JWT exists but user is logged in as staff
        if (event === 'SIGNED_IN') {
          // Check if user is currently in staff mode - if so, DON'T wipe their session
          const isInStaffMode = localStorage.getItem('auth_mode') === 'staff';
          
          if (!isInStaffMode) {
            // Only clear staff tokens when explicitly logging in as owner (not staff)
            localStorage.removeItem('staff_session_token');
            localStorage.removeItem('staff_agency_id');
            localStorage.removeItem('staff_is_impersonation');
            localStorage.removeItem('staff_user');
            localStorage.removeItem('staff_session_expiry');
            
            Object.keys(localStorage).forEach(key => {
              if (key.startsWith('sidebar-folder-') || key.startsWith('staff-sidebar-folder-')) {
                localStorage.removeItem(key);
              }
            });
          }
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Skip role/tier re-checks on token refresh - the user hasn't changed
        if (event === 'TOKEN_REFRESHED') {
          return;
        }

        // Check roles on actual auth changes (SIGNED_IN, INITIAL_SESSION, etc.)
        if (session?.user) {
          // Skip redundant checks for the same user to prevent loading flash
          const isSameUser = lastCheckedUserIdRef.current === session.user.id;

          // Abort any in-flight requests from previous auth state
          roleCheckAbortRef.current?.abort();
          tierCheckAbortRef.current?.abort();

          // Create new abort controllers
          roleCheckAbortRef.current = new AbortController();
          tierCheckAbortRef.current = new AbortController();

          // If same user, skip the loading state to prevent ProtectedRoute from
          // unmounting children and losing their state
          checkUserRole(session.user.id, roleCheckAbortRef.current.signal);
          checkMembershipTier(session.user.id, tierCheckAbortRef.current.signal, isSameUser);

          lastCheckedUserIdRef.current = session.user.id;
        } else {
          // Abort any in-flight requests
          roleCheckAbortRef.current?.abort();
          tierCheckAbortRef.current?.abort();

          setIsAdmin(false);
          setAdminLoading(false);
          setTierLoading(false);
          setMembershipTier(null);
          setIsAgencyOwner(false);
          setIsKeyEmployee(false);
          setKeyEmployeeAgencyId(null);
          lastCheckedUserIdRef.current = null;
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        // Skip redundant checks for the same user
        const isSameUser = lastCheckedUserIdRef.current === session.user.id;

        // Abort any in-flight requests from previous auth state
        roleCheckAbortRef.current?.abort();
        tierCheckAbortRef.current?.abort();

        // Create new abort controllers
        roleCheckAbortRef.current = new AbortController();
        tierCheckAbortRef.current = new AbortController();

        checkUserRole(session.user.id, roleCheckAbortRef.current.signal);
        checkMembershipTier(session.user.id, tierCheckAbortRef.current.signal, isSameUser);

        lastCheckedUserIdRef.current = session.user.id;
      } else {
        // No session - ensure loading states are cleared
        setAdminLoading(false);
        setTierLoading(false);
        lastCheckedUserIdRef.current = null;
      }
    });

    return () => {
      subscription.unsubscribe();
      roleCheckAbortRef.current?.abort();
      tierCheckAbortRef.current?.abort();
    };
  }, [checkUserRole, checkMembershipTier, queryClient]);

  // Safety timeout: force loading completion after 5 seconds to prevent infinite loading
  useEffect(() => {
    if (!adminLoading && !tierLoading) return;
    const timeoutId = setTimeout(() => {
      console.warn('[Auth] Role loading timeout - forcing completion');
      setAdminLoading(false);
      setTierLoading(false);
    }, 5000);
    return () => clearTimeout(timeoutId);
  }, [adminLoading, tierLoading]);

  // Proactive token refresh - prevents stale session issues
  useEffect(() => {
    if (!session) return;

    // Get token expiry time
    const expiresAt = session.expires_at;
    if (!expiresAt) return;

    const expiryTime = expiresAt * 1000; // Convert to milliseconds
    const refreshBuffer = 5 * 60 * 1000; // Refresh 5 minutes before expiry
    const now = Date.now();

    // Helper to safely refresh without duplicate calls
    const safeRefresh = async (reason: string) => {
      if (isRefreshingTokenRef.current) {
        console.log(`[Auth] Skipping refresh (${reason}) - already refreshing`);
        return;
      }
      isRefreshingTokenRef.current = true;
      console.log(`[Auth] Refreshing token: ${reason}`);
      try {
        await supabase.auth.refreshSession();
      } catch (err) {
        console.error('[Auth] Failed to refresh session:', err);
      } finally {
        isRefreshingTokenRef.current = false;
      }
    };

    // Calculate when to refresh
    const refreshAt = expiryTime - refreshBuffer;
    const timeUntilRefresh = refreshAt - now;

    // If already expired or about to expire, refresh immediately
    if (timeUntilRefresh <= 0) {
      safeRefresh('token expired or expiring soon');
      return;
    }

    // Set up timer to refresh before expiry
    console.log(`[Auth] Token refresh scheduled in ${Math.round(timeUntilRefresh / 1000 / 60)} minutes`);
    const timerId = setTimeout(() => {
      safeRefresh('scheduled proactive refresh');
    }, timeUntilRefresh);

    // Also refresh when tab becomes visible (user returns after being away)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const currentTime = Date.now();
        const timeRemaining = expiryTime - currentTime;

        // If less than 10 minutes remaining or already expired, refresh
        if (timeRemaining < 10 * 60 * 1000) {
          safeRefresh('tab visible with token expiring soon');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(timerId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session]);

  const signUp = async (email: string, password: string, agencyName: string, fullName: string) => {
    // Always use production URL to avoid localhost redirect issues
    const redirectUrl = window.location.hostname === 'localhost'
      ? 'https://myagencybrain.com/'
      : `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          agency_name: agencyName,
          full_name: fullName,
          needs_agency: true,
          // No membership_tier - admin will set it after signup
        }
      }
    });
    
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error };
  };

  const signOut = async () => {
    try {
      // Clear local state first
      setUser(null);
      setSession(null);
      setIsAdmin(false);
      setIsKeyEmployee(false);
      setKeyEmployeeAgencyId(null);
      setMembershipTier(null);
      
      // Clear any staff tokens to prevent stale token collisions on next login
      localStorage.removeItem('staff_session_token');
      localStorage.removeItem('staff_agency_id');
      localStorage.removeItem('staff_is_impersonation');
      localStorage.removeItem('staff_user');
      localStorage.removeItem('staff_session_expiry');
      
      // Then attempt to sign out from Supabase
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      // Even if Supabase signOut fails, we've cleared local state
    }
  };

  const hasTierAccess = (feature: string): boolean => {
    if (!membershipTier) return false;
    
    const normalized = normalizeTier(membershipTier);
    
    // Call Scoring tier: limited access to only call-scoring, exchange, and agency
    if (isCallScoringTier(membershipTier)) {
      const callScoringAllowed = ['call-scoring', 'exchange', 'agency', 'my-agency', 'account-settings'];
      return callScoringAllowed.includes(feature);
    }
    
    // AI Roleplay only for 1:1 Coaching (not Boardroom)
    if (feature === 'roleplay-trainer') {
      return normalized === 'one_on_one';
    }
    
    // 1:1 Coaching and Boardroom get everything else
    return normalized === 'one_on_one' || normalized === 'boardroom';
  };

  const value = {
    user,
    session,
    loading,
    adminLoading,
    tierLoading,
    roleLoading: adminLoading || tierLoading,
    signUp,
    signIn,
    signOut,
    isAdmin,
    isAgencyOwner,
    isKeyEmployee,
    keyEmployeeAgencyId,
    membershipTier,
    hasTierAccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
