import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const SUPABASE_URL = "https://wjqyccbytctqwceuhzhk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcXljY2J5dGN0cXdjZXVoemhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyNjQwODEsImV4cCI6MjA2OTg0MDA4MX0.GN9SjnDf3jwFTzsO_83ZYe4iqbkRQJutGZJtapq6-Tw";

// Admin email to CC on all submissions
const ADMIN_EMAIL = "info@standardplaybook.com";

interface LeadSubmission {
  full_name: string;
  email: string;
  phone: string;
  agency_name: string;
  carrier: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: LeadSubmission = await req.json();
    const { full_name, email, phone, agency_name, carrier } = body;

    // Validate required fields
    if (!full_name || !email || !phone || !agency_name || !carrier) {
      return new Response(
        JSON.stringify({ error: "All fields are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate carrier value
    const validCarriers = ["Allstate", "State Farm", "Farmers", "Independent", "Other"];
    if (!validCarriers.includes(carrier)) {
      return new Response(
        JSON.stringify({ error: "Invalid carrier selection" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Get request metadata
    const userAgent = req.headers.get("user-agent") || null;
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : null;

    // Insert lead into database
    const { error: dbError } = await supabase
      .from("landing_page_leads")
      .insert({
        full_name,
        email,
        phone,
        agency_name,
        carrier,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error("Failed to save lead information");
    }

    // Send confirmation email to user
    const userEmailResult = await resend.emails.send({
      from: "AgencyBrain <info@standardplaybook.com>",
      to: [email],
      subject: "Thanks for your interest in AgencyBrain!",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 40px; text-align: center;">
                <img src="https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/AgencyBrain%20Logo/Agency%20Brain%20Logo%20Stan.png" alt="AgencyBrain" style="width: 180px; height: auto; margin-bottom: 24px;" />
                
                <h1 style="color: #ffffff; font-size: 28px; margin: 0 0 16px 0;">Thank you, ${full_name}!</h1>
                
                <p style="color: #a1a1aa; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                  We've received your request for more information about AgencyBrain. A member of our team will reach out to you shortly to discuss how we can help transform your agency.
                </p>
                
                <div style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin: 24px 0; text-align: left;">
                  <p style="color: #71717a; font-size: 14px; margin: 0 0 8px 0;">Your submission details:</p>
                  <p style="color: #e4e4e7; font-size: 14px; margin: 0; line-height: 1.8;">
                    <strong>Agency:</strong> ${agency_name}<br>
                    <strong>Carrier:</strong> ${carrier}<br>
                    <strong>Email:</strong> ${email}<br>
                    <strong>Phone:</strong> ${phone}
                  </p>
                </div>
                
                <p style="color: #71717a; font-size: 14px; margin: 24px 0 0 0;">
                  In the meantime, feel free to reply to this email with any questions.
                </p>
              </div>
              
              <p style="text-align: center; color: #71717a; font-size: 12px; margin-top: 24px;">
                © ${new Date().getFullYear()} Standard Playbook. All rights reserved.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (userEmailResult.error) {
      console.error("User email error:", userEmailResult.error);
    }

    // Send notification email to admin (CC)
    const adminEmailResult = await resend.emails.send({
      from: "AgencyBrain Leads <info@standardplaybook.com>",
      to: [ADMIN_EMAIL],
      subject: `🆕 New Lead: ${full_name} - ${carrier}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h1 style="color: #18181b; font-size: 24px; margin: 0 0 24px 0;">New AgencyBrain Lead</h1>
                
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #71717a; width: 140px;">Full Name</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #18181b; font-weight: 500;">${full_name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #71717a;">Email</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
                      <a href="mailto:${email}" style="color: #2563eb; text-decoration: none;">${email}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #71717a;">Phone</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
                      <a href="tel:${phone}" style="color: #2563eb; text-decoration: none;">${phone}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #71717a;">Agency Name</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #18181b; font-weight: 500;">${agency_name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #71717a;">Carrier</td>
                    <td style="padding: 12px 0;">
                      <span style="display: inline-block; background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: 500;">${carrier}</span>
                    </td>
                  </tr>
                </table>
                
                <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e4e4e7;">
                  <p style="color: #71717a; font-size: 13px; margin: 0;">
                    Submitted at ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT
                  </p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (adminEmailResult.error) {
      console.error("Admin email error:", adminEmailResult.error);
    }

    console.log("[submit-landing-lead] Lead saved and emails sent:", { full_name, email, carrier });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[submit-landing-lead] Error:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
