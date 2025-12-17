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
    
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      // Ignore errors
    }
    
    // Use React Router navigate for cleaner transition
    setTimeout(() => navigate('/auth'), 500);
  }, [navigate]);

  useEffect(() => {
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
        handleRecovery('Unable to refresh your session. Please sign in again.');
      }
      
      // Handle explicit sign out events from other tabs
      if (event === 'SIGNED_OUT') {
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
