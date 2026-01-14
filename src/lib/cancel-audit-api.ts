import { supabase } from "@/integrations/supabase/client";

interface StaffApiOptions {
  operation: string;
  params?: Record<string, any>;
  sessionToken: string;
}

export async function callCancelAuditApi({ operation, params, sessionToken }: StaffApiOptions) {
  console.log('[callCancelAuditApi] Invoking edge function:', operation, params);

  const { data, error } = await supabase.functions.invoke("get-cancel-audit-data", {
    body: { operation, params },
    headers: {
      "x-staff-session-token": sessionToken,
    },
  });

  console.log('[callCancelAuditApi] Response:', { data, error });

  if (error) {
    console.error('[callCancelAuditApi] Edge function error:', error);
    throw error;
  }

  // Check if the data contains an error (edge function returned 200 but with error in body)
  if (data?.error) {
    console.error('[callCancelAuditApi] Edge function returned error in body:', data.error);
    throw new Error(data.error);
  }

  return data;
}

// Check if we're on a staff portal route
export function isStaffRoute(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/staff');
}

// Get staff session token from localStorage
// ONLY returns token if we're actually on a staff route to prevent context conflicts
export function getStaffSessionToken(): string | null {
  try {
    // Only use staff token when actually on a staff route
    if (!isStaffRoute()) {
      return null;
    }
    const token = localStorage.getItem("staff_session_token");
    return token || null;
  } catch {
    return null;
  }
}

// Check if user is in staff portal context
export function isStaffContext(): boolean {
  return isStaffRoute() && !!localStorage.getItem("staff_session_token");
}

// Clear staff token when user navigates to non-staff routes
// Call this on mount in pages that could have token conflicts
export function clearStaffTokenIfNotStaffRoute(): void {
  if (!isStaffRoute() && localStorage.getItem("staff_session_token")) {
    console.log('[clearStaffTokenIfNotStaffRoute] Clearing stale staff token on non-staff route');
    localStorage.removeItem("staff_session_token");
  }
}
