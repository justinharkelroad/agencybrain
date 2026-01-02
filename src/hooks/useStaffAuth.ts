import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  loading: boolean;
  error: string | null;
  isImpersonation: boolean;
}

export function useStaffAuth() {
  const [state, setState] = useState<StaffAuthState>({
    user: null,
    sessionToken: null,
    loading: true,
    error: null,
    isImpersonation: false,
  });

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('staff_session_token');
      const isImpersonation = localStorage.getItem('staff_is_impersonation') === 'true';
      
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
          setState({ user: null, sessionToken: null, loading: false, error: null, isImpersonation: false });
          return;
        }

        setState({
          user: data.user,
          sessionToken: token,
          loading: false,
          error: null,
          isImpersonation: isImpersonation || data.user?.is_impersonation || false,
        });
      } catch (err) {
        console.error('Session verification error:', err);
        localStorage.removeItem('staff_session_token');
        localStorage.removeItem('staff_is_impersonation');
        setState({ user: null, sessionToken: null, loading: false, error: null, isImpersonation: false });
      }
    };

    checkSession();
  }, []);

  const login = useCallback(async (username: string, password: string, agencySlug?: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { data, error } = await supabase.functions.invoke('staff_login', {
        body: { username, password, agency_slug: agencySlug }
      });

      if (error || !data?.success) {
        const errorMsg = data?.error || 'Unable to sign in. Please try again.';
        setState(prev => ({ ...prev, loading: false, error: errorMsg }));
        return { error: errorMsg };
      }

      localStorage.setItem('staff_session_token', data.session_token);
      localStorage.removeItem('staff_is_impersonation');
      
      // Clear sidebar folder state on login so folders start closed
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('staff-sidebar-folder-')) {
          localStorage.removeItem(key);
        }
      });

      setState({
        user: data.user,
        sessionToken: data.session_token,
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

  const setImpersonationSession = useCallback((sessionToken: string, user: StaffUser) => {
    localStorage.setItem('staff_session_token', sessionToken);
    localStorage.setItem('staff_is_impersonation', 'true');
    
    setState({
      user: { ...user, is_impersonation: true },
      sessionToken,
      loading: false,
      error: null,
      isImpersonation: true,
    });
  }, []);

  const logout = useCallback(async () => {
    const token = state.sessionToken;
    
    setState({ user: null, sessionToken: null, loading: false, error: null, isImpersonation: false });
    localStorage.removeItem('staff_session_token');
    localStorage.removeItem('staff_is_impersonation');
    localStorage.removeItem('sidebarOpenFolder');

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

  return {
    user: state.user,
    sessionToken: state.sessionToken,
    loading: state.loading,
    error: state.error,
    login,
    logout,
    setImpersonationSession,
    isAuthenticated: !!state.user && !!state.sessionToken,
    isImpersonation: state.isImpersonation,
  };
}
