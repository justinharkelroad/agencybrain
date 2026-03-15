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

  try {
    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResp({ error: "Missing authorization header" }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the JWT to get user
    const jwt = authHeader.replace("Bearer ", "");
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await userClient.auth.getUser(jwt);
    if (!user) {
      return jsonResp({ error: "Unauthorized" }, 401);
    }

    // Get the user's agency
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("agency_id")
      .eq("id", user.id)
      .single();

    if (!profile?.agency_id) {
      return jsonResp({ error: "No agency found for user" }, 400);
    }

    const agencyId = profile.agency_id;
    const { step, data } = await req.json();

    // ---------------------------------------------------------------
    // Step 2: Agency details
    // ---------------------------------------------------------------
    if (step === "agency_details") {
      const updateFields: Record<string, unknown> = {};
      if (data.agency_name) updateFields.name = data.agency_name;
      if (data.timezone) updateFields.timezone = data.timezone;
      if (data.phone) updateFields.phone = data.phone;

      if (Object.keys(updateFields).length > 0) {
        const { error } = await supabaseAdmin
          .from("agencies")
          .update(updateFields)
          .eq("id", agencyId);

        if (error) {
          console.error("Agency update error:", error);
          return jsonResp({ error: "Failed to update agency details" }, 500);
        }
      }

      return jsonResp({ success: true });
    }

    // ---------------------------------------------------------------
    // Step 3: Add team members
    // ---------------------------------------------------------------
    if (step === "add_team_members") {
      const members = data.members as Array<{
        name: string;
        email: string;
        role: string;
      }>;

      if (!members || !Array.isArray(members) || members.length === 0) {
        return jsonResp({ error: "No team members provided" }, 400);
      }

      const results: Array<{
        name: string;
        email: string;
        team_member_id: string;
        invite_token?: string;
        invite_url?: string;
      }> = [];

      for (const member of members) {
        if (!member.name?.trim() || !member.email?.trim()) continue;

        // Create team_member
        const { data: tm, error: tmError } = await supabaseAdmin
          .from("team_members")
          .insert({
            agency_id: agencyId,
            name: member.name.trim(),
            email: member.email.trim().toLowerCase(),
            role: member.role || "Sales",
            employment: "Full-time",
            status: "active",
          })
          .select("id")
          .single();

        if (tmError) {
          console.error("Team member insert error:", tmError);
          // Skip duplicates, continue with others
          if (tmError.code === "23505") {
            // Already exists — look up existing
            const { data: existing } = await supabaseAdmin
              .from("team_members")
              .select("id")
              .eq("agency_id", agencyId)
              .eq("email", member.email.trim().toLowerCase())
              .single();

            if (existing) {
              results.push({
                name: member.name,
                email: member.email,
                team_member_id: existing.id,
              });
            }
            continue;
          }
          continue;
        }

        // Create staff_user + invite token for each member
        const baseUsername = member.email
          .split("@")[0]
          .toLowerCase()
          .replace(/[^a-z0-9]/g, ".");

        // Check for username collision
        const { data: existingStaff } = await supabaseAdmin
          .from("staff_users")
          .select("id")
          .eq("username", baseUsername)
          .single();

        const username = existingStaff
          ? `${baseUsername}.${Math.random().toString(36).slice(2, 6)}`
          : baseUsername;

        // Create staff_user with placeholder password
        const { data: staffUser, error: staffError } = await supabaseAdmin
          .from("staff_users")
          .insert({
            agency_id: agencyId,
            team_member_id: tm.id,
            username,
            email: member.email.trim().toLowerCase(),
            password_hash: `PENDING_INVITE:${crypto.randomUUID()}`,
            is_active: false,
          })
          .select("id")
          .single();

        if (staffError) {
          console.error("Staff user creation error:", staffError);
          // Team member was still created — just won't have invite
          results.push({
            name: member.name,
            email: member.email,
            team_member_id: tm.id,
          });
          continue;
        }

        // Generate invite token
        const tokenBytes = new Uint8Array(32);
        crypto.getRandomValues(tokenBytes);
        const inviteToken = Array.from(tokenBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        await supabaseAdmin.from("staff_invite_tokens").insert({
          staff_user_id: staffUser.id,
          token: inviteToken,
          expires_at: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
        });

        const siteUrl =
          Deno.env.get("SITE_URL") || "https://app.myagencybrain.com";
        const inviteUrl = `${siteUrl}/staff/accept-invite?token=${inviteToken}`;

        results.push({
          name: member.name,
          email: member.email,
          team_member_id: tm.id,
          invite_token: inviteToken,
          invite_url: inviteUrl,
        });
      }

      return jsonResp({ success: true, members: results });
    }

    // ---------------------------------------------------------------
    // Step 4: Complete onboarding
    // ---------------------------------------------------------------
    if (step === "complete") {
      const { error } = await supabaseAdmin
        .from("agencies")
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq("id", agencyId);

      if (error) {
        console.error("Complete onboarding error:", error);
        return jsonResp({ error: "Failed to complete onboarding" }, 500);
      }

      return jsonResp({ success: true });
    }

    return jsonResp({ error: `Unknown step: ${step}` }, 400);
  } catch (error) {
    console.error("complete-onboarding-step error:", error);
    return jsonResp(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      500
    );
  }
});
