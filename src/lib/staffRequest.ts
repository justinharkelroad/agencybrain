import { supabase } from "@/lib/supabaseClient";

const SUPABASE_URL = "https://wjqyccbytctqwceuhzhk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcXljY2J5dGN0cXdjZXVoemhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyNjQwODEsImV4cCI6MjA2OTg0MDA4MX0.GN9SjnDf3jwFTzsO_83ZYe4iqbkRQJutGZJtapq6-Tw";

export interface StaffRequestContext {
  isStaff: boolean;
  staffToken?: string;
  supabaseToken?: string;
}

/**
 * Get the current authentication context.
 * Returns staff token if present, otherwise tries to get Supabase JWT.
 */
export async function getAuthContext(): Promise<StaffRequestContext> {
  const staffToken = localStorage.getItem("staff_session_token");
  
  if (staffToken) {
    return {
      isStaff: true,
      staffToken,
    };
  }
  
  // Try to get Supabase session
  const { data: { session } } = await supabase.auth.getSession();
  
  return {
    isStaff: false,
    supabaseToken: session?.access_token,
  };
}

/**
 * Get headers for making authenticated requests to edge functions.
 * Automatically uses staff token or Supabase JWT based on context.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const context = await getAuthContext();
  
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
 */
export async function fetchWithAuth(
  functionName: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: Record<string, any>;
    queryParams?: Record<string, string>;
  } = {}
): Promise<Response> {
  const { method = "POST", body, queryParams } = options;
  
  const headers = await getAuthHeaders();
  
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
