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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client for creating users
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create user client to verify the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the caller
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if caller is admin or agency owner
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, agency_id")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";
    const isAgencyOwner = !!profile?.agency_id;

    if (!isAdmin && !isAgencyOwner) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin or agency owner required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { agency_id, email, password, display_name, team_member_id } = await req.json();

    if (!agency_id || !email || !password || !display_name) {
      return new Response(JSON.stringify({ error: "Missing required fields: agency_id, email, password, display_name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Agency owner can only create for their own agency
    if (!isAdmin && profile?.agency_id !== agency_id) {
      return new Response(JSON.stringify({ error: "Cannot create key employee for another agency" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if email already exists as a key employee for this agency
    const { data: existingKeyEmployee } = await supabaseAdmin
      .from("key_employees")
      .select("id, user_id")
      .eq("agency_id", agency_id)
      .single();

    // Check if user with this email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      // Check if already a key employee for this agency
      const { data: alreadyKeyEmployee } = await supabaseAdmin
        .from("key_employees")
        .select("id")
        .eq("user_id", existingUser.id)
        .eq("agency_id", agency_id)
        .maybeSingle();

      if (alreadyKeyEmployee) {
        return new Response(JSON.stringify({ 
          error: "email_conflict", 
          message: "This email is already a key employee for this agency" 
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let newUserId: string;

    if (existingUser) {
      // User exists in auth, just add them as key employee
      newUserId = existingUser.id;
      
      // Update their profile to link to this agency if not already linked
      await supabaseAdmin
        .from("profiles")
        .update({ agency_id: agency_id })
        .eq("id", existingUser.id);
    } else {
      // Create new Supabase auth user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: display_name,
        },
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(JSON.stringify({ 
          error: "create_failed", 
          message: createError.message 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      newUserId = newUser.user.id;

      // Update the profile with agency_id and name
      await supabaseAdmin
        .from("profiles")
        .update({ 
          agency_id: agency_id,
          full_name: display_name,
          email: email,
        })
        .eq("id", newUserId);
    }

    // Add to key_employees table
    const { error: keyEmployeeError } = await supabaseAdmin
      .from("key_employees")
      .insert({
        user_id: newUserId,
        agency_id: agency_id,
        invited_by: user.id,
      });

    if (keyEmployeeError) {
      console.error("Error adding key employee:", keyEmployeeError);
      // If we created the user, we should clean up
      if (!existingUser) {
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
      }
      return new Response(JSON.stringify({ 
        error: "key_employee_failed", 
        message: keyEmployeeError.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optionally link team_member_id if provided
    if (team_member_id) {
      // We could store this link somewhere if needed
      console.log(`Key employee ${newUserId} linked to team member ${team_member_id}`);
    }

    console.log(`Key employee account created: ${email} for agency ${agency_id}`);

    return new Response(JSON.stringify({ 
      success: true, 
      user_id: newUserId,
      email: email,
      message: "Key employee account created successfully"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in create_key_employee_account:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
