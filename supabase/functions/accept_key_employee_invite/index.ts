import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check - user must be logged in
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "You must be logged in to accept an invitation" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user client for auth
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "You must be logged in to accept an invitation" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client for privileged operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Invitation token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the invite
    const { data: invite, error: inviteError } = await serviceClient
      .from("key_employee_invites")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ error: "Invalid invitation token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already accepted
    if (invite.accepted_at) {
      return new Response(JSON.stringify({ error: "This invitation has already been accepted" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "This invitation has expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is already a key employee for this agency
    const { data: existingKE } = await serviceClient
      .from("key_employees")
      .select("id")
      .eq("user_id", user.id)
      .eq("agency_id", invite.agency_id)
      .maybeSingle();

    if (existingKE) {
      // Mark invite as accepted anyway
      await serviceClient
        .from("key_employee_invites")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invite.id);

      return new Response(JSON.stringify({ 
        success: true, 
        message: "You are already a key employee for this agency",
        already_member: true
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already has an agency_id (is an owner of another agency)
    const { data: userProfile } = await serviceClient
      .from("profiles")
      .select("agency_id")
      .eq("id", user.id)
      .maybeSingle();

    if (userProfile?.agency_id && userProfile.agency_id !== invite.agency_id) {
      return new Response(JSON.stringify({ 
        error: "You are already associated with another agency. Contact support if you need to change agencies." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create key employee record
    const { error: keError } = await serviceClient
      .from("key_employees")
      .insert({
        user_id: user.id,
        agency_id: invite.agency_id,
        invited_by: invite.invited_by,
      });

    if (keError) {
      console.error("Key employee insert error:", keError);
      return new Response(JSON.stringify({ error: "Failed to add you as a key employee" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update user's profile to set agency_id if not set
    if (!userProfile?.agency_id) {
      const { error: profileError } = await serviceClient
        .from("profiles")
        .update({ agency_id: invite.agency_id })
        .eq("id", user.id);

      if (profileError) {
        console.error("Profile update error:", profileError);
        // Don't fail - key employee record is created
      }
    }

    // Mark invite as accepted
    await serviceClient
      .from("key_employee_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    // Get agency name for response
    const { data: agency } = await serviceClient
      .from("agencies")
      .select("name")
      .eq("id", invite.agency_id)
      .maybeSingle();

    console.log(`User ${user.id} accepted key employee invite for agency ${invite.agency_id}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `You are now a key employee of ${agency?.name || "the agency"}`,
      agency_name: agency?.name
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
