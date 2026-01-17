import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-staff-session",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sessionToken = req.headers.get("x-staff-session");
    console.log("get_staff_goal: Received request with session token:", sessionToken ? "present" : "missing");

    if (!sessionToken) {
      console.log("get_staff_goal: No session token provided");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify staff session
    const { data: session, error: sessionError } = await supabase
      .from("staff_sessions")
      .select("staff_user_id, expires_at")
      .eq("session_token", sessionToken)
      .single();

    if (sessionError || !session) {
      console.log("get_staff_goal: Session not found:", sessionError?.message);
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(session.expires_at) < new Date()) {
      console.log("get_staff_goal: Session expired");
      return new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get staff user details
    const { data: staffUser, error: userError } = await supabase
      .from("staff_users")
      .select("agency_id, team_member_id")
      .eq("id", session.staff_user_id)
      .single();

    if (userError || !staffUser) {
      console.log("get_staff_goal: Staff user not found:", userError?.message);
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("get_staff_goal: Staff user found:", { agency_id: staffUser.agency_id, team_member_id: staffUser.team_member_id });

    const body = await req.json();
    const { team_member_id } = body;

    // Verify team_member_id matches the session user
    if (team_member_id !== staffUser.team_member_id) {
      console.log("get_staff_goal: Team member ID mismatch");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // First check for personal goal (standard monthly goal, not promo/custom)
    // Use order + limit instead of maybeSingle to avoid errors with multiple active goals
    const { data: personalGoals, error: personalError } = await supabase
      .from("sales_goals")
      .select("target_value, goal_name, measurement")
      .eq("agency_id", staffUser.agency_id)
      .eq("team_member_id", team_member_id)
      .eq("goal_type", "standard")
      .eq("time_period", "monthly")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1);

    console.log("get_staff_goal: Personal goal query result:", { personalGoals, error: personalError?.message });

    const personalGoal = personalGoals?.[0];
    if (personalGoal?.target_value) {
      console.log("get_staff_goal: Returning personal goal:", personalGoal.target_value);
      return new Response(
        JSON.stringify({ 
          goal: personalGoal.target_value, 
          type: "personal", 
          name: personalGoal.goal_name,
          measurement: personalGoal.measurement || "premium",
          has_personal_goal: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback to agency goal (standard monthly, agency-wide)
    const { data: agencyGoals, error: agencyError } = await supabase
      .from("sales_goals")
      .select("target_value, goal_name, measurement")
      .eq("agency_id", staffUser.agency_id)
      .is("team_member_id", null)
      .eq("goal_type", "standard")
      .eq("time_period", "monthly")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1);

    console.log("get_staff_goal: Agency goal query result:", { agencyGoals, error: agencyError?.message });

    const agencyGoal = agencyGoals?.[0];
    return new Response(
      JSON.stringify({ 
        goal: agencyGoal?.target_value || 0, 
        type: "agency", 
        name: agencyGoal?.goal_name || null,
        measurement: agencyGoal?.measurement || "premium",
        has_personal_goal: false
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("get_staff_goal: Unexpected error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
