import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface VerifiedRequest {
  mode: "supabase" | "staff";
  agencyId: string;
  agencySlug?: string;
  userId?: string;       // Supabase auth user ID
  staffUserId?: string;  // Staff portal user ID
  staffMemberId?: string; // Linked team_member_id
  role?: string;
  isManager?: boolean;
}

export interface VerifyError {
  error: string;
  status: number;
}

/**
 * Verify a request using either Supabase JWT or staff session token.
 * Returns user context including agencyId for authorization.
 */
export async function verifyRequest(
  req: Request
): Promise<VerifiedRequest | VerifyError> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  const staffSession = req.headers.get("X-Staff-Session");

  // DEFENSE: If BOTH headers are present, prefer Supabase JWT (owner takes precedence)
  // This handles edge cases where stale staff tokens weren't cleared from localStorage
  const hasValidJwt = authHeader && authHeader.startsWith("Bearer ");
  const useStaffSession = staffSession && !hasValidJwt;

  // Path 1: Staff session token (only if no JWT present)
  if (useStaffSession) {
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Step 1: Fetch staff session by token (without expires_at filter in SQL)
    const { data: session, error: sessionError } = await adminClient
      .from("staff_sessions")
      .select("id, staff_user_id, expires_at")
      .eq("session_token", staffSession)
      .single();

    if (sessionError || !session) {
      console.error("Staff session lookup failed:", sessionError?.code, sessionError?.message);
      return { error: "Invalid or expired staff session", status: 401 };
    }

    // Step 2: Validate expiration in code (avoids SQL timestamp comparison issues)
    const expiresAt = new Date(session.expires_at);
    const now = new Date();
    if (expiresAt <= now) {
      console.error("Staff session expired:", { expiresAt: session.expires_at, now: now.toISOString() });
      return { error: "Invalid or expired staff session", status: 401 };
    }

    // Step 3: Fetch staff user separately (avoids PostgREST join issues)
    const { data: staffUser, error: staffUserError } = await adminClient
      .from("staff_users")
      .select("id, agency_id, is_active, username, team_member_id")
      .eq("id", session.staff_user_id)
      .single();

    if (staffUserError || !staffUser) {
      console.error("Staff user lookup failed:", staffUserError?.code, staffUserError?.message);
      return { error: "Invalid or expired staff session", status: 401 };
    }

    if (!staffUser.is_active) {
      return { error: "Staff account is disabled", status: 401 };
    }

    if (!staffUser.agency_id) {
      return { error: "Staff user has no agency assigned", status: 403 };
    }

    // Get agency slug
    const { data: agency } = await adminClient
      .from("agencies")
      .select("slug")
      .eq("id", staffUser.agency_id)
      .single();

    // Get role/manager status from linked team_member if exists
    let role: string | undefined;
    let isManager = false;
    if (staffUser.team_member_id) {
      const { data: teamMember } = await adminClient
        .from("team_members")
        .select("role")
        .eq("id", staffUser.team_member_id)
        .single();
      if (teamMember?.role) {
        role = teamMember.role;
        isManager = teamMember.role === 'Manager' || teamMember.role === 'Owner';
      }
    }

    return {
      mode: "staff",
      agencyId: staffUser.agency_id,
      agencySlug: agency?.slug,
      staffUserId: staffUser.id,
      staffMemberId: staffUser.team_member_id,
      role,
      isManager,
    };
  }

  // Path 2: Supabase JWT
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const jwt = authHeader.replace("Bearer ", "");

    // Create client with user's JWT to verify it
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      return { error: "Invalid or expired JWT", status: 401 };
    }

    // Get user's agency from profile
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("agency_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.agency_id) {
      return { error: "User has no agency assigned", status: 403 };
    }

    // Get agency slug
    const { data: agency } = await adminClient
      .from("agencies")
      .select("slug")
      .eq("id", profile.agency_id)
      .single();

    return {
      mode: "supabase",
      agencyId: profile.agency_id,
      agencySlug: agency?.slug,
      userId: user.id,
    };
  }

  // No valid auth
  return { error: "Missing authentication", status: 401 };
}

/**
 * Check if result is an error
 */
export function isVerifyError(
  result: VerifiedRequest | VerifyError
): result is VerifyError {
  return "error" in result;
}
