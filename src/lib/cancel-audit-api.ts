import { supabase } from "@/integrations/supabase/client";

interface StaffApiOptions {
  operation: string;
  params?: Record<string, any>;
  sessionToken: string;
}

export async function callCancelAuditApi({ operation, params, sessionToken }: StaffApiOptions) {
  const { data, error } = await supabase.functions.invoke("get-cancel-audit-data", {
    body: { operation, params },
    headers: {
      "x-staff-session-token": sessionToken,
    },
  });

  if (error) throw error;
  return data;
}

// Get staff session token from localStorage
// Returns the token if present - the edge function will handle session validation
export function getStaffSessionToken(): string | null {
  try {
    const token = localStorage.getItem("staff_session_token");
    return token || null;
  } catch {
    return null;
  }
}

// Check if user is in staff portal context
export function isStaffContext(): boolean {
  return !!localStorage.getItem("staff_session_token");
}
