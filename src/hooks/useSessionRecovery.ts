import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { isSessionError } from '@/lib/sessionRecovery';

/**
 * Hook that monitors for session errors and handles recovery
 * Should be used in the main App or layout component
 */
export function useSessionRecovery() {
  const navigate = useNavigate();

  const handleRecovery = useCallback(async (message?: string) => {
    toast.error(message || 'Your session has expired. Please sign in again.', {
      duration: 5000,
      id: 'session-expired',
    });
    
    // Clear local storage
    localStorage.removeItem('sb-wjqyccbytctqwceuhzhk-auth-token');
    localStorage.removeItem('sidebarOpenFolder');
    
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      // Ignore errors
    }
    
    // Redirect to landing page so user can choose Brain or Staff portal
    setTimeout(() => navigate('/'), 500);
  }, [navigate]);

  useEffect(() => {
    // Helper to check if current session is a staff session
    // Only check for staff token presence - don't check route because
    // staff users may access shared components that aren't under /staff/
    const isStaffSession = () => {
      return !!localStorage.getItem('staff_session_token');
    };

    // Set up global error handler for fetch to catch 401s
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        // Check if it's a Supabase request that returned 401/403
        let url = '';
        if (typeof args[0] === 'string') {
          url = args[0];
        } else if (args[0] instanceof Request) {
          url = args[0].url;
        } else if (args[0] instanceof URL) {
          url = args[0].toString();
        }
        const isSupabaseRequest = url.includes('supabase.co') || url.includes('supabase.in');
        
        if (isSupabaseRequest && (response.status === 401 || response.status === 403)) {
          // CRITICAL: Don't trigger recovery for staff sessions
          // Staff users authenticate via session tokens, not Supabase Auth
          if (isStaffSession()) {
            return response;
          }
          
          // Clone the response to read the body
          const clonedResponse = response.clone();
          try {
            const body = await clonedResponse.json();
            if (isSessionError({ ...body, status: response.status })) {
              handleRecovery();
            }
          } catch (e) {
            // Body wasn't JSON, check status only
            if (response.status === 401) {
              handleRecovery();
            }
          }
        }
        
        return response;
      } catch (error) {
        throw error;
      }
    };

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Handle token refresh failures
      if (event === 'TOKEN_REFRESHED' && !session) {
        // Don't trigger recovery for staff sessions
        if (isStaffSession()) {
          return;
        }
        handleRecovery('Unable to refresh your session. Please sign in again.');
      }
      
      // Handle explicit sign out events from other tabs
      if (event === 'SIGNED_OUT') {
        // Don't redirect staff users when Supabase fires SIGNED_OUT
        // Staff sessions are managed separately via staff_session_token
        if (isStaffSession()) {
          return;
        }
        
        localStorage.removeItem('sidebarOpenFolder');
        // Only redirect if we're not already on the auth page
        if (!window.location.pathname.includes('/auth')) {
          navigate('/auth');
        }
      }
    });

    return () => {
      // Restore original fetch
      window.fetch = originalFetch;
      subscription.unsubscribe();
    };
  }, [handleRecovery, navigate]);
}
