import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  BRAND,
  buildEmailHtml,
  EmailComponents,
} from "../_shared/email-template.ts";

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

/**
 * Helper: create a team_member + staff_user + invite token for a single person.
 * Reused by both add_team_members and sales_manager steps.
 */
async function createTeamMemberWithInvite(
  supabaseAdmin: ReturnType<typeof createClient>,
  agencyId: string,
  member: { name: string; email: string; role: string; phone?: string }
) {
  const email = member.email.trim().toLowerCase();

  // Create team_member
  const { data: tm, error: tmError } = await supabaseAdmin
    .from("team_members")
    .insert({
      agency_id: agencyId,
      name: member.name.trim(),
      email,
      role: member.role || "Sales",
      employment: "Full-time",
      status: "active",
    })
    .select("id")
    .single();

  if (tmError) {
    if (tmError.code === "23505") {
      // Already exists — look up existing
      const { data: existing } = await supabaseAdmin
        .from("team_members")
        .select("id")
        .eq("agency_id", agencyId)
        .eq("email", email)
        .single();
      return {
        team_member_id: existing?.id,
        invite_url: undefined,
        error: null,
      };
    }
    return { team_member_id: null, invite_url: undefined, error: tmError };
  }

  // Create staff_user
  const baseUsername = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ".");

  const { data: existingStaff } = await supabaseAdmin
    .from("staff_users")
    .select("id")
    .eq("username", baseUsername)
    .single();

  const username = existingStaff
    ? `${baseUsername}.${Math.random().toString(36).slice(2, 6)}`
    : baseUsername;

  const { data: staffUser, error: staffError } = await supabaseAdmin
    .from("staff_users")
    .insert({
      agency_id: agencyId,
      team_member_id: tm.id,
      username,
      email,
      password_hash: `PENDING_INVITE:${crypto.randomUUID()}`,
      is_active: false,
    })
    .select("id")
    .single();

  if (staffError) {
    console.error("Staff user creation error:", staffError);
    return { team_member_id: tm.id, invite_url: undefined, error: null };
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
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  const siteUrl =
    Deno.env.get("SITE_URL") || "https://app.myagencybrain.com";
  const inviteUrl = `${siteUrl}/staff/accept-invite?token=${inviteToken}`;

  return { team_member_id: tm.id, invite_url: inviteUrl, error: null };
}

/**
 * Send onboarding completion notification email to info@standardplaybook.com
 */
async function sendOnboardingNotification(
  supabaseAdmin: ReturnType<typeof createClient>,
  agencyId: string,
  userId: string,
  tier: string
) {
  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not set — skipping onboarding notification");
      return;
    }

    // Fetch agency + owner details
    const { data: agency } = await supabaseAdmin
      .from("agencies")
      .select("name, phone, timezone")
      .eq("id", agencyId)
      .single();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .single();

    // Fetch team members added during onboarding
    const { data: teamMembers } = await supabaseAdmin
      .from("team_members")
      .select("name, email, role")
      .eq("agency_id", agencyId);

    const agencyName = agency?.name || "Unknown Agency";
    const ownerName = profile?.full_name || "Unknown";
    const ownerEmail = profile?.email || "";
    const ownerPhone = agency?.phone || "";

    // Build email body
    let bodyContent = "";

    bodyContent += EmailComponents.summaryBox(
      `New ${tier} client has completed onboarding`
    );

    const fields = [
      { label: "Agency Name", value: agencyName },
      { label: "Owner Name", value: ownerName },
      { label: "Owner Email", value: ownerEmail },
      { label: "Owner Phone", value: ownerPhone },
      { label: "Tier", value: tier },
      { label: "Timezone", value: agency?.timezone || "Not set" },
    ];

    bodyContent += EmailComponents.additionalFields(fields);

    // Team members
    if (teamMembers && teamMembers.length > 0) {
      const memberRows = teamMembers
        .map(
          (m: { name: string; email: string; role: string }) =>
            `<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${m.name}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${m.email}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${m.role}</td></tr>`
        )
        .join("");

      bodyContent += `
        <div style="margin-top:20px;">
          <h3 style="margin:0 0 12px 0;font-size:15px;color:${BRAND.colors.primary};">Team Members</h3>
          <table style="width:100%;border-collapse:collapse;background:${BRAND.colors.lightBg};border-radius:6px;">
            <thead><tr>
              <th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb;">Name</th>
              <th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb;">Email</th>
              <th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb;">Role</th>
            </tr></thead>
            <tbody>${memberRows}</tbody>
          </table>
        </div>
      `;
    }

    // Coaching-specific info
    if (tier === "1:1 Coaching") {
      const { data: assignment } = await supabaseAdmin
        .from("sales_experience_assignments")
        .select(
          "start_date, delegate_team_member_id, onboarding_questionnaire"
        )
        .eq("agency_id", agencyId)
        .in("status", ["pending", "active"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (assignment) {
        // Delegate info
        let delegateInfo = "Owner on calls";
        if (assignment.delegate_team_member_id) {
          const { data: delegate } = await supabaseAdmin
            .from("team_members")
            .select("name, email")
            .eq("id", assignment.delegate_team_member_id)
            .single();
          if (delegate) {
            delegateInfo = `${delegate.name} (${delegate.email})`;
          }
        }

        const q = assignment.onboarding_questionnaire as Record<string, string> | null;
        const mgrPhone = q?.manager_phone || "";

        const coachingFields = [
          { label: "Start Date", value: assignment.start_date || "Not set" },
          { label: "Sales Manager / Delegate", value: delegateInfo },
          ...(mgrPhone ? [{ label: "Manager Phone", value: mgrPhone }] : []),
        ];

        bodyContent += `
          <div style="margin-top:20px;">
            <h3 style="margin:0 0 12px 0;font-size:15px;color:${BRAND.colors.primary};">8-Week Experience Details</h3>
          </div>
        `;
        bodyContent += EmailComponents.additionalFields(coachingFields);

        // Questionnaire answers
        if (q) {
          bodyContent += `
            <div style="margin-top:20px;">
              <h3 style="margin:0 0 12px 0;font-size:15px;color:${BRAND.colors.primary};">Questionnaire Answers</h3>
            </div>
          `;
          const qFields = [
            { label: "Lead Management System", value: q.lead_management_system || "" },
            { label: "Current Accountability", value: q.current_accountability || "" },
            { label: "Top Struggles", value: q.top_struggles || "" },
            { label: "Hoped Outcome", value: q.hoped_outcome || "" },
          ];
          bodyContent += EmailComponents.additionalFields(qFields);
        }
      }
    }

    const emailHtml = buildEmailHtml({
      title: `New ${tier} Client Onboarded`,
      subtitle: agencyName,
      bodyContent,
    });

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: BRAND.fromEmail,
        to: ["info@standardplaybook.com"],
        subject: `New ${tier} Client Onboarded: ${agencyName}`,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errBody = await emailResponse.text();
      console.error("Onboarding notification email failed:", errBody);
    } else {
      console.log(
        "Onboarding notification email sent for:",
        agencyName,
        tier
      );
    }
  } catch (err) {
    console.error("Onboarding notification email error:", err);
  }
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
    // Step: Agency details
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
    // Step: Sales Manager (coaching tier only)
    // ---------------------------------------------------------------
    if (step === "sales_manager") {
      if (data.ownerOnCalls) {
        return jsonResp({ success: true, ownerOnCalls: true });
      }

      const manager = data.manager as {
        name: string;
        email: string;
        phone: string;
      };
      if (!manager?.name || !manager?.email) {
        return jsonResp({ error: "Manager name and email are required" }, 400);
      }

      const result = await createTeamMemberWithInvite(
        supabaseAdmin,
        agencyId,
        { name: manager.name, email: manager.email, role: "Manager", phone: manager.phone }
      );

      if (result.error) {
        console.error("Sales manager creation error:", result.error);
        return jsonResp({ error: "Failed to create sales manager" }, 500);
      }

      return jsonResp({
        success: true,
        manager_team_member_id: result.team_member_id,
        invite_url: result.invite_url,
      });
    }

    // ---------------------------------------------------------------
    // Step: Add team members
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

        const result = await createTeamMemberWithInvite(
          supabaseAdmin,
          agencyId,
          member
        );

        if (result.team_member_id) {
          results.push({
            name: member.name,
            email: member.email,
            team_member_id: result.team_member_id,
            invite_url: result.invite_url,
          });
        }
      }

      return jsonResp({ success: true, members: results });
    }

    // ---------------------------------------------------------------
    // Step: What to Expect (coaching — create assignment with start date)
    // ---------------------------------------------------------------
    if (step === "what_to_expect") {
      const startDate = data.start_date as string;
      if (!startDate) {
        return jsonResp({ error: "Start date is required" }, 400);
      }

      // Validate start_date is a Monday (0=Sun, 1=Mon, ..., 6=Sat)
      const parsed = new Date(startDate + "T00:00:00Z");
      if (parsed.getUTCDay() !== 1) {
        return jsonResp({ error: "Start date must be a Monday" }, 400);
      }

      // Get agency timezone
      const { data: agency } = await supabaseAdmin
        .from("agencies")
        .select("timezone")
        .eq("id", agencyId)
        .single();

      const timezone = agency?.timezone || "America/New_York";

      // Create sales_experience_assignment
      const insertPayload: Record<string, unknown> = {
        agency_id: agencyId,
        assigned_by: user.id,
        start_date: startDate,
        timezone,
        status: "pending",
      };

      if (data.manager_team_member_id) {
        insertPayload.delegate_team_member_id = data.manager_team_member_id;
      }

      const { data: assignment, error: assignError } = await supabaseAdmin
        .from("sales_experience_assignments")
        .insert(insertPayload)
        .select("id")
        .single();

      if (assignError) {
        console.error("Assignment creation error:", assignError);
        if (assignError.code === "23505") {
          return jsonResp(
            {
              error:
                "Your agency already has an active 8-Week Experience assignment. Please contact support if you need help.",
            },
            409
          );
        }
        return jsonResp({ error: "Failed to create program assignment" }, 500);
      }

      return jsonResp({ success: true, assignment_id: assignment.id });
    }

    // ---------------------------------------------------------------
    // Step: Questionnaire (coaching — save answers)
    // ---------------------------------------------------------------
    if (step === "questionnaire") {
      const answers: Record<string, string> = {
        lead_management_system: data.lead_management_system || "",
        current_accountability: data.current_accountability || "",
        top_struggles: data.top_struggles || "",
        hoped_outcome: data.hoped_outcome || "",
      };
      // Persist manager phone alongside questionnaire (team_members has no phone column)
      if (data.manager_phone) {
        answers.manager_phone = data.manager_phone;
      }

      // Find the pending assignment for this agency
      const { data: assignment } = await supabaseAdmin
        .from("sales_experience_assignments")
        .select("id")
        .eq("agency_id", agencyId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!assignment) {
        console.error("No pending assignment found for questionnaire");
        return jsonResp({
          error: "No pending program assignment found",
        }, 400);
      }

      const { error: updateError } = await supabaseAdmin
        .from("sales_experience_assignments")
        .update({ onboarding_questionnaire: answers })
        .eq("id", assignment.id);

      if (updateError) {
        console.error("Questionnaire save error:", updateError);
        return jsonResp({ error: "Failed to save questionnaire" }, 500);
      }

      return jsonResp({ success: true });
    }

    // ---------------------------------------------------------------
    // Step: Complete onboarding
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

      // For coaching tier: activate the pending assignment
      // This fires triggers: initialize_sales_experience_staff_progress,
      // queue_sales_experience_lesson_emails
      const tier = data?.tier || "";
      if (tier === "1:1 Coaching") {
        const { error: activateError } = await supabaseAdmin
          .from("sales_experience_assignments")
          .update({ status: "active" })
          .eq("agency_id", agencyId)
          .eq("status", "pending");

        if (activateError) {
          console.error("Assignment activation error:", activateError);
          // Don't fail the whole request — onboarding is complete even if
          // activation needs manual intervention
        }
      }

      // Fire-and-forget: send notification email for ALL tiers
      // deno-lint-ignore no-explicit-any
      const runtime = (globalThis as any).EdgeRuntime;
      if (runtime?.waitUntil) {
        runtime.waitUntil(
          sendOnboardingNotification(supabaseAdmin, agencyId, user.id, tier || "Boardroom")
        );
      } else {
        // Fallback: just await it (local dev)
        await sendOnboardingNotification(
          supabaseAdmin,
          agencyId,
          user.id,
          tier || "Boardroom"
        );
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
