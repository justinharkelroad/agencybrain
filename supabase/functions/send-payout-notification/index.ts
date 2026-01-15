import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { buildEmailHtml, EmailComponents, BRAND } from "../_shared/email-template.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PayoutNotificationRequest {
  payout_ids: string[];
  notification_type: "finalized" | "paid";
  agency_id: string;
}

interface PayoutWithMember {
  id: string;
  period_month: number;
  period_year: number;
  total_payout: number | null;
  written_premium: number | null;
  net_premium: number | null;
  tier_commission_value: number | null;
  base_commission: number | null;
  bonus_amount: number | null;
  finalized_at: string | null;
  paid_at: string | null;
  team_members: {
    id: string;
    name: string;
    email: string | null;
  };
}

function formatCurrency(cents: number | null): string {
  if (cents === null || cents === undefined) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatPeriod(month: number, year: number): string {
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function buildFinalizedEmail(payout: PayoutWithMember, siteUrl: string): string {
  const period = formatPeriod(payout.period_month, payout.period_year);
  const memberName = payout.team_members.name || "Team Member";

  const bodyContent = `
    ${EmailComponents.paragraph(`Hi ${memberName},`)}
    ${EmailComponents.paragraph(`Your commission statement for <strong>${period}</strong> has been finalized and is ready for review.`)}
    ${EmailComponents.summaryBox(`Total Payout: <span style="font-size: 24px; color: ${BRAND.colors.green};">${formatCurrency(payout.total_payout)}</span>`)}
    
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Written Premium</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatCurrency(payout.written_premium)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Net Premium</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatCurrency(payout.net_premium)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Tier Rate</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${payout.tier_commission_value ? `${payout.tier_commission_value}%` : "N/A"}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Base Commission</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatCurrency(payout.base_commission)}</td>
      </tr>
      ${payout.bonus_amount ? `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Bonus</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: ${BRAND.colors.green};">+${formatCurrency(payout.bonus_amount)}</td>
      </tr>
      ` : ""}
    </table>
    
    ${EmailComponents.button("View in Portal", `${siteUrl}/staff/login`)}
    ${EmailComponents.infoText("Log in to your staff portal to view the full breakdown of your commission statement.")}
  `;

  return buildEmailHtml({
    title: "Commission Statement Ready",
    subtitle: period,
    bodyContent,
  });
}

function buildPaidEmail(payout: PayoutWithMember, siteUrl: string): string {
  const period = formatPeriod(payout.period_month, payout.period_year);
  const memberName = payout.team_members.name || "Team Member";
  const paidDate = payout.paid_at 
    ? new Date(payout.paid_at).toLocaleDateString("en-US", { 
        month: "long", 
        day: "numeric", 
        year: "numeric" 
      })
    : "Today";

  const bodyContent = `
    ${EmailComponents.paragraph(`Hi ${memberName},`)}
    ${EmailComponents.paragraph(`Great news! Your commission payment has been processed.`)}
    
    <div style="background: linear-gradient(135deg, #22c55e20, #16a34a20); padding: 20px; border-radius: 8px; border-left: 4px solid ${BRAND.colors.green}; margin: 16px 0;">
      <div style="font-size: 14px; color: ${BRAND.colors.gray}; margin-bottom: 4px;">Payment Amount</div>
      <div style="font-size: 28px; font-weight: 700; color: ${BRAND.colors.green};">${formatCurrency(payout.total_payout)}</div>
    </div>
    
    <table style="width: 100%; margin: 16px 0;">
      <tr>
        <td style="padding: 8px 0; color: ${BRAND.colors.gray};">Payment Date</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600;">${paidDate}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: ${BRAND.colors.gray};">Period</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600;">${period}</td>
      </tr>
    </table>
    
    ${EmailComponents.button("View Details", `${siteUrl}/staff/login`)}
    ${EmailComponents.infoText("Thank you for your hard work! Log in to your staff portal to view your complete payment history.")}
  `;

  return buildEmailHtml({
    title: "Payment Confirmation",
    subtitle: `Commission paid for ${period}`,
    bodyContent,
  });
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-payout-notification: Request received");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payout_ids, notification_type, agency_id }: PayoutNotificationRequest = await req.json();
    
    console.log(`Processing ${notification_type} notifications for ${payout_ids.length} payouts`);

    if (!payout_ids || payout_ids.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, skipped: 0, message: "No payout IDs provided" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const siteUrl = Deno.env.get("SITE_URL") || "https://agencybrain.standardplaybook.com";
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch payouts with team member details
    const { data: payouts, error: fetchError } = await supabase
      .from("comp_payouts")
      .select(`
        id,
        period_month,
        period_year,
        total_payout,
        written_premium,
        net_premium,
        tier_commission_value,
        base_commission,
        bonus_amount,
        finalized_at,
        paid_at,
        team_members!inner (
          id,
          name,
          email
        )
      `)
      .in("id", payout_ids)
      .eq("agency_id", agency_id);

    if (fetchError) {
      console.error("Error fetching payouts:", fetchError);
      throw new Error(`Failed to fetch payouts: ${fetchError.message}`);
    }

    console.log(`Found ${payouts?.length || 0} payouts to process`);

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const payout of (payouts || []) as unknown as PayoutWithMember[]) {
      const email = payout.team_members?.email;
      const memberName = payout.team_members?.name || "Unknown";

      if (!email) {
        console.log(`Skipping ${memberName}: No email address`);
        skipped++;
        continue;
      }

      try {
        const period = formatPeriod(payout.period_month, payout.period_year);
        const subject = notification_type === "finalized"
          ? `Your Commission Statement is Ready - ${period}`
          : `Commission Paid - ${period}`;

        const html = notification_type === "finalized"
          ? buildFinalizedEmail(payout, siteUrl)
          : buildPaidEmail(payout, siteUrl);

        const emailResponse = await resend.emails.send({
          from: BRAND.fromEmail,
          to: [email],
          subject,
          html,
        });

        if (emailResponse.error) {
          console.error(`Failed to send to ${email}:`, emailResponse.error);
          errors.push(`${memberName}: ${emailResponse.error.message}`);
        } else {
          console.log(`Email sent to ${memberName} (${email})`);
          sent++;
        }
      } catch (emailError: any) {
        console.error(`Error sending to ${email}:`, emailError);
        errors.push(`${memberName}: ${emailError.message}`);
      }
    }

    const response = {
      success: true,
      sent,
      skipped,
      total: payout_ids.length,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log("Notification results:", response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-payout-notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
