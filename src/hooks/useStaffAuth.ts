import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StaffUser {
  id: string;
  username: string;
  display_name: string;
  agency_id: string;
  team_member_id: string | null;
  role: string | null;
  team_member_name: string | null;
  email: string | null;
  profile_photo_url: string | null;
  agency_membership_tier: string | null;
  is_impersonation?: boolean;
}

interface StaffAuthState {
  user: StaffUser | null;
  sessionToken: string | null;
  expiresAt: Date | null;
  loading: boolean;
  error: string | null;
  isImpersonation: boolean;
}

// Warning threshold: 15 minutes before expiry
const WARNING_THRESHOLD_MS = 15 * 60 * 1000;
// Check interval: 1 minute
const CHECK_INTERVAL_MS = 60 * 1000;

export function useStaffAuth() {
  const [state, setState] = useState<StaffAuthState>({
    user: null,
    sessionToken: null,
    expiresAt: null,
    loading: true,
    error: null,
    isImpersonation: false,
  });

  // Track if we've already shown the warning toast for this expiry window
  const warningShownRef = useRef(false);
  // Track the toast ID so we can dismiss it after refresh
  const toastIdRef = useRef<string | number | null>(null);
  // Ref to hold logout function to avoid TDZ issues in useEffect
  const logoutRef = useRef<() => Promise<void>>();

  // === All useCallbacks must be defined before useEffects that use them ===

  // Refresh session by calling edge function
  const refreshSession = useCallback(async () => {
    const token = state.sessionToken || localStorage.getItem('staff_session_token');
    if (!token) {
      return { success: false, error: 'No session token' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('staff_refresh_session', {
        body: { session_token: token }
      });

      if (error || !data?.success) {
        return { success: false, error: data?.error || 'Failed to refresh session' };
      }

      const newExpiresAt = new Date(data.expires_at);

      // Update localStorage
      localStorage.setItem('staff_session_expiry', data.expires_at);

      // Update state
      setState(prev => ({ ...prev, expiresAt: newExpiresAt }));

      // Reset warning shown flag since we have a new expiry
      warningShownRef.current = false;

      // Dismiss the warning toast if it's showing
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }

      return { success: true, expiresAt: newExpiresAt, refreshed: data.refreshed };
    } catch (err) {
      console.error('Session refresh error:', err);
      return { success: false, error: 'Failed to refresh session' };
    }
  }, [state.sessionToken]);

  const login = useCallback(async (username: string, password: string, agencySlug?: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { data, error } = await supabase.functions.invoke('staff_login', {
        body: {
          username: username?.trim(),
          password,
          agency_slug: agencySlug?.trim() || undefined,
        }
      });

      if (error || !data?.success) {
        const errorMsg = data?.error || 'Unable to sign in. Please try again.';
        setState(prev => ({ ...prev, loading: false, error: errorMsg }));
        return { error: errorMsg };
      }

      const expiresAt = data.expires_at ? new Date(data.expires_at) : null;

      localStorage.setItem('staff_session_token', data.session_token);
      localStorage.setItem('staff_agency_id', data.user.agency_id);
      localStorage.setItem('auth_mode', 'staff'); // Prevent AuthProvider from wiping staff tokens
      if (data.expires_at) {
        localStorage.setItem('staff_session_expiry', data.expires_at);
      }
      localStorage.removeItem('staff_is_impersonation');

      // Clear sidebar folder state on login so folders start closed
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('staff-sidebar-folder-')) {
          localStorage.removeItem(key);
        }
      });

      // Reset warning flag on new login
      warningShownRef.current = false;

      setState({
        user: data.user,
        sessionToken: data.session_token,
        expiresAt,
        loading: false,
        error: null,
        isImpersonation: false,
      });

      return { error: null, user: data.user };
    } catch (err: any) {
      const errorMsg = err?.message || 'Login failed';
      setState(prev => ({ ...prev, loading: false, error: errorMsg }));
      return { error: errorMsg };
    }
  }, []);

  const setImpersonationSession = useCallback((sessionToken: string, user: StaffUser, expiresAt?: string) => {
    localStorage.setItem('staff_session_token', sessionToken);
    localStorage.setItem('staff_agency_id', user.agency_id);
    localStorage.setItem('auth_mode', 'staff'); // Prevent AuthProvider from wiping staff tokens
    localStorage.setItem('staff_is_impersonation', 'true');
    if (expiresAt) {
      localStorage.setItem('staff_session_expiry', expiresAt);
    }

    // Reset warning flag on new session
    warningShownRef.current = false;

    setState({
      user: { ...user, is_impersonation: true },
      sessionToken,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      loading: false,
      error: null,
      isImpersonation: true,
    });
  }, []);

  const logout = useCallback(async () => {
    const token = state.sessionToken;

    setState({ user: null, sessionToken: null, expiresAt: null, loading: false, error: null, isImpersonation: false });
    localStorage.removeItem('staff_session_token');
    localStorage.removeItem('staff_agency_id');
    localStorage.removeItem('staff_is_impersonation');
    localStorage.removeItem('staff_session_expiry');
    localStorage.removeItem('auth_mode'); // Clear staff mode flag on logout
    localStorage.removeItem('sidebarOpenFolder');
    localStorage.removeItem('staff_session_last_refresh');

    // Reset warning ref
    warningShownRef.current = false;

    // Dismiss any warning toast
    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
      toastIdRef.current = null;
    }

    if (token) {
      try {
        await supabase.functions.invoke('staff_logout', {
          body: { session_token: token }
        });
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
  }, [state.sessionToken]);

  // Keep ref updated with latest logout function
  logoutRef.current = logout;

  // === useEffects come after all useCallbacks ===

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('staff_session_token');
      const isImpersonation = localStorage.getItem('staff_is_impersonation') === 'true';
      const storedExpiry = localStorage.getItem('staff_session_expiry');

      if (!token) {
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('staff_verify_session', {
          body: { session_token: token }
        });

        if (error || !data?.valid) {
          localStorage.removeItem('staff_session_token');
          localStorage.removeItem('staff_is_impersonation');
          localStorage.removeItem('staff_session_expiry');
          localStorage.removeItem('auth_mode'); // Clear staff mode on invalid session
          setState({ user: null, sessionToken: null, expiresAt: null, loading: false, error: null, isImpersonation: false });
          return;
        }

        // Get expires_at from response or stored value
        const expiresAt = data.expires_at
          ? new Date(data.expires_at)
          : storedExpiry
            ? new Date(storedExpiry)
            : null;

        // Store expiry in localStorage if we got it from server
        if (data.expires_at) {
          localStorage.setItem('staff_session_expiry', data.expires_at);
        }

        localStorage.setItem('staff_agency_id', data.user.agency_id);
        setState({
          user: data.user,
          sessionToken: token,
          expiresAt,
          loading: false,
          error: null,
          isImpersonation: isImpersonation || data.user?.is_impersonation || false,
        });
      } catch (err) {
        console.error('Session verification error:', err);
        localStorage.removeItem('staff_session_token');
        localStorage.removeItem('staff_is_impersonation');
        localStorage.removeItem('staff_session_expiry');
        localStorage.removeItem('auth_mode'); // Clear staff mode on error
        setState({ user: null, sessionToken: null, expiresAt: null, loading: false, error: null, isImpersonation: false });
      }
    };

    checkSession();
  }, []);

  // Monitor session expiry
  useEffect(() => {
    if (!state.sessionToken || !state.expiresAt) return;

    const checkExpiry = () => {
      const now = new Date();
      const expiresAt = state.expiresAt;
      if (!expiresAt) return;

      const timeRemaining = expiresAt.getTime() - now.getTime();

      // Session has expired
      if (timeRemaining <= 0) {
        logoutRef.current?.();
        toast.error('Your session has expired. Please log in again.');
        return;
      }

      // Warning threshold reached - show toast with action button
      if (timeRemaining <= WARNING_THRESHOLD_MS && !warningShownRef.current) {
        warningShownRef.current = true;
        const minutes = Math.ceil(timeRemaining / 60000);

        toastIdRef.current = toast.warning(
          `Your session expires in ${minutes} minute${minutes !== 1 ? 's' : ''}`,
          {
            duration: Infinity, // Keep showing until dismissed
            action: {
              label: 'Extend Session',
              onClick: async () => {
                const result = await refreshSession();
                if (result.success) {
                  toast.success('Session extended for 24 hours');
                } else {
                  toast.error('Failed to extend session');
                }
              },
            },
          }
        );
      }
    };

    // Check immediately
    checkExpiry();

    // Set up interval
    const intervalId = setInterval(checkExpiry, CHECK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [state.sessionToken, state.expiresAt, refreshSession]);

  return {
    user: state.user,
    sessionToken: state.sessionToken,
    expiresAt: state.expiresAt,
    loading: state.loading,
    error: state.error,
    login,
    logout,
    refreshSession,
    setImpersonationSession,
    isAuthenticated: !!state.user && !!state.sessionToken,
    isImpersonation: state.isImpersonation,
  };
}
