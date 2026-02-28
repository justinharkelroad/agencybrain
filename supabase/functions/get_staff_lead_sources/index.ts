import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-staff-session",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sessionToken = req.headers.get("x-staff-session");
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: "Missing staff session token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate session
    const nowISO = new Date().toISOString();
    const { data: session, error: sessionError } = await supabase
      .from("staff_sessions")
      .select("staff_user_id, expires_at, is_valid")
      .eq("session_token", sessionToken)
      .eq("is_valid", true)
      .gt("expires_at", nowISO)
      .maybeSingle();

    if (sessionError || !session) {
      console.error("[get_staff_lead_sources] Invalid session:", sessionError);
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get staff user's agency
    const { data: staffUser, error: staffError } = await supabase
      .from("staff_users")
      .select("id, agency_id")
      .eq("id", session.staff_user_id)
      .single();

    if (staffError || !staffUser?.agency_id) {
      console.error("[get_staff_lead_sources] Staff user not found:", staffError);
      return new Response(JSON.stringify({ error: "Staff user not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch lead sources with bucket info for the agency
    const { data: leadSources, error: lsError } = await supabase
      .from("lead_sources")
      .select(`
        id, 
        name, 
        is_self_generated,
        bucket:marketing_buckets(id, name)
      `)
      .eq("agency_id", staffUser.agency_id)
      .eq("is_active", true)
      .order("name");

    if (lsError) {
      console.error("[get_staff_lead_sources] Error fetching lead sources:", lsError);
      return new Response(JSON.stringify({ error: "Failed to fetch lead sources" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch prior insurance companies for the agency
    const { data: priorInsuranceCompanies, error: picError } = await supabase
      .from("prior_insurance_companies")
      .select("id, name, is_active")
      .eq("agency_id", staffUser.agency_id)
      .order("name");

    if (picError) {
      console.error("[get_staff_lead_sources] Error fetching prior insurance companies:", picError);
      // Non-fatal: return empty array
    }

    // Fetch active objections for the agency (used by Add Quote modal)
    const { data: objections, error: objError } = await supabase
      .from("lqs_objections")
      .select("id, name")
      .eq("agency_id", staffUser.agency_id)
      .eq("is_active", true)
      .order("sort_order")
      .order("name");

    if (objError) {
      console.error("[get_staff_lead_sources] Error fetching objections:", objError);
      // Non-fatal: return empty array
    }

    // Fetch team members for manager/owner style "view as" experiences.
    // Do not hard-filter on status; some agencies use different status casing/values.
    const { data: teamMembers, error: tmError } = await supabase
      .from("team_members")
      .select("id, name")
      .eq("agency_id", staffUser.agency_id)
      .order("name");

    if (tmError) {
      console.error("[get_staff_lead_sources] Error fetching team members:", tmError);
      // Non-fatal: return empty array
    }

    return new Response(JSON.stringify({
      success: true,
      lead_sources: leadSources || [],
      prior_insurance_companies: priorInsuranceCompanies || [],
      objections: objections || [],
      team_members: teamMembers || [],
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[get_staff_lead_sources] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
