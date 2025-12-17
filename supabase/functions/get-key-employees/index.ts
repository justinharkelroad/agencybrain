import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("get-key-employees: Starting request");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the user from the JWT
    const authHeader = req.headers.get("Authorization")?.split(" ")[1];
    if (!authHeader) {
      console.log("get-key-employees: No auth header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader);
    
    if (authError || !user) {
      console.log("get-key-employees: Auth error", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("get-key-employees: User authenticated", user.id);

    // Get the user's agency_id from their profile (using service role bypasses RLS)
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("agency_id")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.log("get-key-employees: Profile error", profileError);
      return new Response(JSON.stringify({ error: "Failed to get user profile" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!userProfile?.agency_id) {
      console.log("get-key-employees: No agency found for user");
      return new Response(JSON.stringify({ error: "No agency found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("get-key-employees: Agency ID", userProfile.agency_id);

    // Fetch key employees for this agency
    const { data: keyEmployees, error: keError } = await supabaseAdmin
      .from("key_employees")
      .select("id, user_id, agency_id, created_at")
      .eq("agency_id", userProfile.agency_id);

    if (keError) {
      console.log("get-key-employees: Key employees query error", keError);
      throw keError;
    }

    console.log("get-key-employees: Found", keyEmployees?.length || 0, "key employees");

    // Fetch profiles for each key employee (using service role bypasses RLS)
    const keyEmployeesWithProfiles = await Promise.all(
      (keyEmployees || []).map(async (ke) => {
        const { data: profile, error: profileErr } = await supabaseAdmin
          .from("profiles")
          .select("full_name, email")
          .eq("id", ke.user_id)
          .single();

        if (profileErr) {
          console.log("get-key-employees: Profile fetch error for", ke.user_id, profileErr);
        }

        return {
          ...ke,
          full_name: profile?.full_name || "Unknown",
          email: profile?.email || "No email",
        };
      })
    );

    console.log("get-key-employees: Returning", keyEmployeesWithProfiles.length, "key employees with profiles");

    return new Response(JSON.stringify({ data: keyEmployeesWithProfiles }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("get-key-employees: Error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
