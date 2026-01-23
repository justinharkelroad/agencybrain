import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { BRAND, buildEmailHtml, EmailComponents } from "../_shared/email-template.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create service role client to bypass RLS (needed for staff users)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse request body
    const {
      description,
      attachment_urls,
      page_url,
      browser_info,
      submitter_name,
      submitter_email,
      submitter_type,
      agency_id,
      agency_name,
      user_id,
      staff_member_id,
    } = await req.json();

    // Validate required fields
    if (!description || !submitter_name || !submitter_email || !submitter_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: description, submitter_name, submitter_email, submitter_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate submitter_type
    if (!["owner", "admin", "staff"].includes(submitter_type)) {
      return new Response(
        JSON.stringify({ error: "Invalid submitter_type. Must be one of: owner, admin, staff" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert ticket into database
    const { data: ticket, error: insertError } = await supabase
      .from("support_tickets")
      .insert({
        description,
        attachment_urls: attachment_urls || [],
        page_url,
        browser_info,
        submitter_name,
        submitter_email,
        submitter_type,
        agency_id: agency_id || null,
        agency_name: agency_name || null,
        user_id: user_id || null,
        staff_member_id: staff_member_id || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting support ticket:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create support ticket", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build email content
    const attachmentsList = attachment_urls?.length
      ? attachment_urls.map((url: string, i: number) => `<li><a href="${url}" style="color: ${BRAND.colors.primary};">Attachment ${i + 1}</a></li>`).join("")
      : "<li>None</li>";

    const bodyContent = `
      ${EmailComponents.summaryBox(`New support ticket from ${submitter_name}`)}

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; width: 120px;">From:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${submitter_name} (${submitter_email})</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Type:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${submitter_type}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Agency:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${agency_name || "N/A"}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Page:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${page_url || "N/A"}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Ticket ID:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-size: 12px;">${ticket.id}</td>
        </tr>
      </table>

      <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid ${BRAND.colors.primary}; margin: 16px 0;">
        <strong style="color: ${BRAND.colors.primary};">Description:</strong>
        <div style="margin-top: 8px; white-space: pre-wrap;">${description}</div>
      </div>

      <div style="margin-top: 16px;">
        <strong>Attachments:</strong>
        <ul style="margin: 8px 0; padding-left: 20px;">
          ${attachmentsList}
        </ul>
      </div>

      ${browser_info ? `
      <div style="margin-top: 16px; font-size: 12px; color: #64748b;">
        <strong>Browser Info:</strong><br/>
        <code style="background: #f1f5f9; padding: 2px 4px; border-radius: 4px;">${browser_info}</code>
      </div>
      ` : ""}
    `;

    const emailHtml = buildEmailHtml({
      title: "🎫 New Support Ticket",
      subtitle: `From ${submitter_name}`,
      bodyContent,
      footerAgencyName: agency_name,
    });

    // Send email via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      // Still return success since ticket was created, just log the email failure
      return new Response(
        JSON.stringify({
          success: true,
          ticket_id: ticket.id,
          warning: "Email notification could not be sent (API key not configured)"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: BRAND.fromEmail,
        to: ["info@standardplaybook.com"],
        reply_to: submitter_email,
        subject: `[Support Ticket] ${submitter_name} - ${agency_name || "No Agency"}`,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("Resend API error:", errorData);
      // Still return success since ticket was created
      return new Response(
        JSON.stringify({
          success: true,
          ticket_id: ticket.id,
          warning: "Email notification could not be sent"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Support ticket created and email sent:", ticket.id);

    return new Response(
      JSON.stringify({ success: true, ticket_id: ticket.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in submit-support-ticket:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
