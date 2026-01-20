import { supabase } from "@/lib/supabaseClient";

const SUPABASE_URL = "https://wjqyccbytctqwceuhzhk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcXljY2J5dGN0cXdjZXVoemhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyNjQwODEsImV4cCI6MjA2OTg0MDA4MX0.GN9SjnDf3jwFTzsO_83ZYe4iqbkRQJutGZJtapq6-Tw";

export interface StaffRequestContext {
  isStaff: boolean;
  staffToken?: string;
  supabaseToken?: string;
}

export type AuthPreference = 'staff' | 'supabase' | 'auto';

/**
 * Get the current authentication context.
 * 
 * @param prefer - Which auth type to prefer when both exist:
 *   - 'staff': Always use staff token if it exists (for staff pages)
 *   - 'supabase': Always use Supabase JWT if it exists (for owner pages)
 *   - 'auto': Use staff token only if no Supabase session (default, legacy behavior)
 */
export async function getAuthContext(prefer: AuthPreference = 'auto'): Promise<StaffRequestContext> {
  const staffToken = localStorage.getItem("staff_session_token");
  const { data: { session: supabaseSession } } = await supabase.auth.getSession();
  
  // Staff preference: ALWAYS use staff token if it exists
  if (prefer === 'staff' && staffToken) {
    return {
      isStaff: true,
      staffToken,
      supabaseToken: undefined,
    };
  }
  
  // Supabase preference: ALWAYS use Supabase JWT if it exists
  if (prefer === 'supabase' && supabaseSession?.access_token) {
    return {
      isStaff: false,
      staffToken: undefined,
      supabaseToken: supabaseSession.access_token,
    };
  }
  
  // Auto mode (legacy): Supabase takes precedence, then staff
  if (supabaseSession?.access_token) {
    return {
      isStaff: false,
      staffToken: undefined,
      supabaseToken: supabaseSession.access_token,
    };
  }
  
  if (staffToken) {
    return {
      isStaff: true,
      staffToken,
      supabaseToken: undefined,
    };
  }
  
  return {
    isStaff: false,
    supabaseToken: undefined,
  };
}

/**
 * Get headers for making authenticated requests to edge functions.
 * Automatically uses staff token or Supabase JWT based on context.
 * 
 * @param prefer - Which auth type to prefer (default: 'staff' for staff-safe behavior)
 */
export async function getAuthHeaders(prefer: AuthPreference = 'staff'): Promise<Record<string, string>> {
  const context = await getAuthContext(prefer);
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
  };
  
  if (context.isStaff && context.staffToken) {
    headers["X-Staff-Session"] = context.staffToken;
  } else if (context.supabaseToken) {
    headers["Authorization"] = `Bearer ${context.supabaseToken}`;
  }
  
  return headers;
}

/**
 * Make an authenticated fetch request to a Supabase edge function.
 * Automatically handles staff vs Supabase auth.
 * 
 * @param prefer - Which auth type to prefer (default: 'staff' for staff-safe behavior)
 */
export async function fetchWithAuth(
  functionName: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    prefer?: AuthPreference;
    body?: Record<string, any>;
    queryParams?: Record<string, string>;
  } = {}
): Promise<Response> {
  const { method = "POST", body, queryParams, prefer = 'staff' } = options;
  
  const headers = await getAuthHeaders(prefer);
  
  let url = `${SUPABASE_URL}/functions/v1/${functionName}`;
  
  if (queryParams) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }
  
  return fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Check if user has a valid staff session token.
 */
export function hasStaffToken(): boolean {
  return !!localStorage.getItem("staff_session_token");
}

/**
 * Get the staff session token if it exists.
 */
export function getStaffToken(): string | null {
  return localStorage.getItem("staff_session_token");
}
