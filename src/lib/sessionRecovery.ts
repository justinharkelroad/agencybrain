import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

// Track if we're already handling a session error to prevent loops
let isHandlingSessionError = false;

/**
 * Checks if an error indicates an invalid/expired session
 */
export function isSessionError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorCode = error?.code?.toLowerCase() || '';
  const statusCode = error?.status || error?.statusCode;
  
  // Check for common session-related error patterns
  const sessionErrorPatterns = [
    'session not found',
    'jwt expired',
    'invalid jwt',
    'session expired',
    'refresh_token_not_found',
    'invalid refresh token',
    'user not found',
    'no session',
    'unauthorized',
    'auth session missing',
  ];
  
  const hasSessionErrorMessage = sessionErrorPatterns.some(
    pattern => errorMessage.includes(pattern) || errorCode.includes(pattern)
  );
  
  // 401 or 403 with session-related messages
  const isAuthError = (statusCode === 401 || statusCode === 403) && hasSessionErrorMessage;
  
  return hasSessionErrorMessage || isAuthError;
}

/**
 * Check if current session is a staff session (not Supabase Auth)
 */
function isStaffSession(): boolean {
  return !!localStorage.getItem('staff_session_token');
}

/**
 * Handles session recovery - clears invalid session and redirects to login
 * IMPORTANT: Staff sessions are managed separately and should NOT trigger recovery
 */
export async function handleSessionRecovery(customMessage?: string): Promise<void> {
  // CRITICAL: Staff users authenticate via session tokens, not Supabase Auth
  // Never trigger recovery for staff sessions
  if (isStaffSession()) {
    console.log('[SessionRecovery] Skipping recovery - staff session detected');
    return;
  }
  
  // Prevent multiple simultaneous recovery attempts
  if (isHandlingSessionError) return;
  isHandlingSessionError = true;
  
  try {
    // Show friendly message
    toast.error(customMessage || 'Your session has expired. Please sign in again.', {
      duration: 5000,
      id: 'session-expired', // Prevent duplicate toasts
    });
    
    // Clear local storage auth data
    localStorage.removeItem('sb-wjqyccbytctqwceuhzhk-auth-token');
    
    // Sign out to clear any remaining state
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      // Ignore signOut errors - we're already handling an invalid session
    }
    
    // Small delay to let toast show before redirect
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Redirect to landing page so user can choose Brain or Staff portal
    window.location.href = '/';
  } finally {
    isHandlingSessionError = false;
  }
}

/**
 * Validates the current session is still valid on the server
 * Returns true if valid, triggers recovery if not
 */
export async function validateSession(): Promise<boolean> {
  // Staff sessions don't use Supabase Auth - skip validation entirely
  if (isStaffSession()) {
    return true;
  }
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      // No local session - user needs to log in
      return false;
    }
    
    // Try to get user to verify session is valid on server
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      // Session exists locally but server says it's invalid
      await handleSessionRecovery('Your session is no longer valid. Please sign in again.');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Session validation error:', error);
    return false;
  }
}

/**
 * Wrapper for API calls that automatically handles session errors
 */
export async function withSessionRecovery<T>(
  apiCall: () => Promise<T>,
  options?: { customMessage?: string }
): Promise<T> {
  try {
    return await apiCall();
  } catch (error: any) {
    // Staff sessions don't use Supabase Auth - never trigger recovery
    if (isSessionError(error) && !isStaffSession()) {
      await handleSessionRecovery(options?.customMessage);
      throw new Error('Session expired - redirecting to login');
    }
    throw error;
  }
}

/**
 * Hook into Supabase responses to detect session errors globally
 */
export function setupGlobalSessionRecovery(): void {
  // Listen for auth state changes that indicate session issues
  supabase.auth.onAuthStateChange((event, session) => {
    // Staff sessions don't use Supabase Auth - skip recovery
    if (isStaffSession()) {
      return;
    }
    
    if (event === 'TOKEN_REFRESHED' && !session) {
      // Token refresh failed - session is invalid
      handleSessionRecovery('Unable to refresh your session. Please sign in again.');
    }
  });
}
