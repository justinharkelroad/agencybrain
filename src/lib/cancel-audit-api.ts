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

// Get staff session from localStorage
export function getStaffSession(): { 
  token: string; 
  teamMemberId: string; 
  agencyId: string; 
  name: string;
} | null {
  try {
    const token = localStorage.getItem("staff_session_token");
    if (!token) return null;
    
    // Get team member data from localStorage
    const teamMemberData = localStorage.getItem("staff_team_member");
    if (!teamMemberData) return null;
    
    const teamMember = JSON.parse(teamMemberData);
    
    return {
      token,
      teamMemberId: teamMember.id,
      agencyId: teamMember.agency_id,
      name: teamMember.name || "Staff Member",
    };
  } catch {
    return null;
  }
}
