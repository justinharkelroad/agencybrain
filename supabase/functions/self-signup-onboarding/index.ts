import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let createdUserId: string | null = null;
  let createdAgencyId: string | null = null;

  try {
    const { token, password, full_name, agency_name, timezone } =
      await req.json();

    // Validate required fields
    if (!token || !password || !full_name) {
      return jsonResp({ error: "Missing required fields: token, password, full_name" }, 400);
    }

    if (password.length < 8) {
      return jsonResp({ error: "Password must be at least 8 characters" }, 400);
    }

    // ---------------------------------------------------------------
    // 1. Validate token
    // ---------------------------------------------------------------
    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("onboarding_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (tokenError || !tokenRow) {
      return jsonResp({ error: "Invalid onboarding token" }, 404);
    }

    if (tokenRow.status === "used") {
      return jsonResp({ error: "This onboarding link has already been used" }, 410);
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      await supabaseAdmin
        .from("onboarding_tokens")
        .update({ status: "expired" })
        .eq("id", tokenRow.id);
      return jsonResp({ error: "This onboarding link has expired" }, 410);
    }

    const email = tokenRow.email;
    const finalAgencyName = agency_name || tokenRow.agency_name || `${full_name}'s Agency`;
    const finalTimezone = timezone || "America/New_York";

    // ---------------------------------------------------------------
    // 2. Create auth user
    //    handle_new_user() trigger fires: creates profile + agency + Owner team_member
    //    We pass needs_agency=true so the trigger handles agency creation
    // ---------------------------------------------------------------
    console.log("Creating auth user:", email);

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        needs_agency: true,
        agency_name: finalAgencyName,
      },
    });

    if (createError) {
      console.error("User creation error:", createError);
      // Check for duplicate email
      if (createError.message?.includes("already been registered")) {
        return jsonResp(
          { error: "An account with this email already exists. Please sign in instead." },
          409
        );
      }
      return jsonResp({ error: createError.message }, 400);
    }

    createdUserId = newUser.user.id;
    console.log("User created:", createdUserId);

    // ---------------------------------------------------------------
    // 3. Wait briefly for trigger, then get agency_id from profile
    // ---------------------------------------------------------------
    // The handle_new_user() trigger creates the agency synchronously,
    // so the profile should already have agency_id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("agency_id")
      .eq("id", createdUserId)
      .single();

    if (profileError || !profile?.agency_id) {
      console.error("Profile/agency not found after trigger:", profileError);
      // Clean up
      await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      return jsonResp(
        { error: "Failed to create agency. Please try again." },
        500
      );
    }

    createdAgencyId = profile.agency_id;
    console.log("Agency created by trigger:", createdAgencyId);

    // ---------------------------------------------------------------
    // 4. Update profile with membership tier + role
    // ---------------------------------------------------------------
    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({
        membership_tier: tokenRow.tier || "Boardroom",
        role: "agency_owner",
      })
      .eq("id", createdUserId);

    if (profileUpdateError) {
      console.error("Profile update error:", profileUpdateError);
      // Non-fatal — continue, admin can fix tier later
    }

    // ---------------------------------------------------------------
    // 5. Update agency with timezone + Stripe info
    // ---------------------------------------------------------------
    const agencyUpdate: Record<string, unknown> = {
      timezone: finalTimezone,
    };
    if (tokenRow.stripe_customer_id) {
      agencyUpdate.stripe_customer_id = tokenRow.stripe_customer_id;
    }
    if (tokenRow.stripe_subscription_id) {
      agencyUpdate.stripe_subscription_id = tokenRow.stripe_subscription_id;
    }
    // Set subscription_status for Boardroom
    if (tokenRow.tier === "Boardroom") {
      agencyUpdate.subscription_status = "active";
    }

    const { error: agencyUpdateError } = await supabaseAdmin
      .from("agencies")
      .update(agencyUpdate)
      .eq("id", createdAgencyId);

    if (agencyUpdateError) {
      console.error("Agency update error:", agencyUpdateError);
      // Non-fatal — continue
    }

    // ---------------------------------------------------------------
    // 6. Call provision_boardroom_defaults — KPIs, forms, scorecard rules
    // ---------------------------------------------------------------
    const { error: provisionError } = await supabaseAdmin.rpc(
      "provision_boardroom_defaults",
      { p_agency_id: createdAgencyId }
    );

    if (provisionError) {
      console.error("Provision error:", provisionError);
      // Non-fatal — admin can configure KPIs manually
    }

    // ---------------------------------------------------------------
    // 7. Mark token as used
    // ---------------------------------------------------------------
    await supabaseAdmin
      .from("onboarding_tokens")
      .update({
        status: "used",
        used_by_user_id: createdUserId,
        used_by_agency_id: createdAgencyId,
        used_at: new Date().toISOString(),
      })
      .eq("id", tokenRow.id);

    // ---------------------------------------------------------------
    // 8. Generate session for immediate login
    // ---------------------------------------------------------------
    // Use signInWithPassword via a temporary client so we get a real session
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: signInData, error: signInError } =
      await anonClient.auth.signInWithPassword({ email, password });

    if (signInError) {
      console.error("Sign-in error (non-fatal):", signInError);
      // Account was created successfully, user can sign in manually
      return jsonResp({
        success: true,
        user_id: createdUserId,
        agency_id: createdAgencyId,
        session: null,
        message: "Account created. Please sign in.",
      });
    }

    console.log("Onboarding complete:", {
      userId: createdUserId,
      agencyId: createdAgencyId,
      email,
    });

    return jsonResp({
      success: true,
      user_id: createdUserId,
      agency_id: createdAgencyId,
      session: {
        access_token: signInData.session?.access_token,
        refresh_token: signInData.session?.refresh_token,
      },
    });
  } catch (error) {
    console.error("self-signup-onboarding error:", error);

    // Clean up on unexpected failure
    if (createdUserId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        if (createdAgencyId) {
          await supabaseAdmin.from("agencies").delete().eq("id", createdAgencyId);
        }
      } catch (cleanupErr) {
        console.error("Cleanup failed:", cleanupErr);
      }
    }

    return jsonResp(
      { error: error instanceof Error ? error.message : "Internal server error" },
      500
    );
  }
});
