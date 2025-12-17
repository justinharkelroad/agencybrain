import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client for privileged operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's profile to check if they're an agency owner
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("agency_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.agency_id) {
      return new Response(JSON.stringify({ error: "You must be an agency owner to invite key employees" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const agencyId = profile.agency_id;

    // Parse request body
    const { email } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if already a key employee for this agency
    const { data: existingKeyEmployee } = await serviceClient
      .from("key_employees")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("user_id", (await serviceClient.from("profiles").select("id").eq("email", normalizedEmail).maybeSingle()).data?.id || "00000000-0000-0000-0000-000000000000")
      .maybeSingle();

    // Check if there's a user with this email who's already a key employee
    const { data: existingUser } = await serviceClient.auth.admin.listUsers();
    const userWithEmail = existingUser?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);
    
    if (userWithEmail) {
      const { data: keCheck } = await serviceClient
        .from("key_employees")
        .select("id")
        .eq("agency_id", agencyId)
        .eq("user_id", userWithEmail.id)
        .maybeSingle();
      
      if (keCheck) {
        return new Response(JSON.stringify({ error: "This user is already a key employee for your agency" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check for pending invite
    const { data: existingInvite } = await serviceClient
      .from("key_employee_invites")
      .select("id, expires_at")
      .eq("agency_id", agencyId)
      .eq("email", normalizedEmail)
      .is("accepted_at", null)
      .maybeSingle();

    if (existingInvite && new Date(existingInvite.expires_at) > new Date()) {
      return new Response(JSON.stringify({ error: "An invite is already pending for this email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate secure token
    const token = crypto.randomUUID() + "-" + crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Create invite record
    const { error: insertError } = await serviceClient
      .from("key_employee_invites")
      .insert({
        agency_id: agencyId,
        email: normalizedEmail,
        invited_by: user.id,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create invitation" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get agency name for email
    const { data: agency } = await serviceClient
      .from("agencies")
      .select("name")
      .eq("id", agencyId)
      .maybeSingle();

    // Get inviter name
    const { data: inviterProfile } = await serviceClient
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    // Send invitation email via Resend
    const inviteLink = `https://myagencybrain.com/accept-key-employee-invite?token=${token}`;
    
    if (resendApiKey) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "AgencyBrain <info@agencybrain.standardplaybook.com>",
            to: normalizedEmail,
            subject: `You've been invited as a Key Employee to ${agency?.name || "an agency"} on AgencyBrain`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #1e283a 0%, #020817 100%); padding: 30px; text-align: center;">
                  <img src="https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/AgencyBrain%20Logo/AGENCYBRAIN%20LOGO.png" alt="AgencyBrain" style="height: 50px;" />
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                  <h1 style="color: #1e283a; margin-bottom: 20px;">You've Been Invited!</h1>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                    ${inviterProfile?.full_name || "The agency owner"} has invited you to join <strong>${agency?.name || "their agency"}</strong> as a <strong>Key Employee</strong> on AgencyBrain.
                  </p>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                    As a Key Employee, you'll have full access to the agency dashboard, metrics, team management, and all other features.
                  </p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${inviteLink}" style="background: #1e283a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                      Accept Invitation
                    </a>
                  </div>
                  <p style="color: #6b7280; font-size: 14px;">
                    This invitation expires in 7 days. If you don't have an AgencyBrain account yet, you'll be able to create one when you accept the invitation.
                  </p>
                </div>
                <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                  © ${new Date().getFullYear()} AgencyBrain. All rights reserved.
                </div>
              </div>
            `,
          }),
        });

        if (!emailResponse.ok) {
          console.error("Email send failed:", await emailResponse.text());
        }
      } catch (emailError) {
        console.error("Email error:", emailError);
        // Continue even if email fails - invite is created
      }
    }

    console.log(`Key employee invite created for ${normalizedEmail} to agency ${agencyId}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Invitation sent successfully",
      invite_link: inviteLink // Return link in case email fails
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
