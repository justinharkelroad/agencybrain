import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BRAND = {
  colors: {
    primary: '#1e283a',
    secondary: '#020817',
    gray: '#60626c',
    green: '#22c55e',
    lightBg: '#f1f5f9',
    white: '#ffffff',
  },
  logo: 'https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/AgencyBrain%20Logo/AGENCYBRAIN%20LOGO.png',
  name: 'Agency Brain',
  fromEmail: 'Agency Brain <info@agencybrain.standardplaybook.com>',
};

interface SaleNotificationRequest {
  sale_id: string;
  agency_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!RESEND_API_KEY) {
      console.error('[send-sale-notification] RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: SaleNotificationRequest = await req.json();
    
    console.log('[send-sale-notification] Function invoked');
    console.log('[send-sale-notification] Request body:', JSON.stringify(body));
    console.log('[send-sale-notification] Processing sale:', body.sale_id);

    // 1. Check if agency has real-time notifications enabled
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('id, name, sales_realtime_email_enabled, timezone')
      .eq('id', body.agency_id)
      .single();

    if (agencyError || !agency) {
      console.error('[send-sale-notification] Agency lookup failed:', agencyError);
      return new Response(
        JSON.stringify({ error: 'Agency not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!agency.sales_realtime_email_enabled) {
      console.log('[send-sale-notification] Real-time emails disabled for agency:', agency.name);
      return new Response(
        JSON.stringify({ success: true, message: 'Real-time emails disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get the new sale details with team member info
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select(`
        id,
        customer_name,
        total_premium,
        total_items,
        total_policies,
        is_bundle,
        bundle_type,
        effective_date,
        source,
        created_at,
        team_member:team_members!sales_team_member_id_fkey(id, name)
      `)
      .eq('id', body.sale_id)
      .single();

    if (saleError || !sale) {
      console.error('[send-sale-notification] Sale lookup failed:', saleError);
      return new Response(
        JSON.stringify({ error: 'Sale not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Get all sales team members (Sales role OR Hybrid with Sales assignment)
    const { data: salesTeamMembers, error: teamError } = await supabase
      .from('team_members')
      .select('id, name, role, hybrid_team_assignments')
      .eq('agency_id', body.agency_id)
      .eq('status', 'active')
      .or('role.eq.Sales,role.eq.Hybrid');

    if (teamError) {
      console.error('[send-sale-notification] Team members lookup failed:', teamError);
    }

    // Filter to only include Sales role or Hybrid with Sales in their assignments
    const eligibleTeamMembers = (salesTeamMembers || []).filter(tm => {
      if (tm.role === 'Sales') return true;
      if (tm.role === 'Hybrid' && Array.isArray(tm.hybrid_team_assignments)) {
        return tm.hybrid_team_assignments.includes('Sales');
      }
      return false;
    });

    if (eligibleTeamMembers.length === 0) {
      console.log('[send-sale-notification] No sales team members found');
      return new Response(
        JSON.stringify({ success: true, message: 'No sales team members' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Calculate today's scoreboard
    const timezone = agency.timezone || 'America/New_York';
    
    // Get today's date boundaries in the agency's timezone
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD format
    
    const { data: todaysSales, error: salesError } = await supabase
      .from('sales')
      .select(`
        id,
        team_member_id,
        customer_name,
        total_premium,
        total_items,
        total_policies
      `)
      .eq('agency_id', body.agency_id)
      .gte('sale_date', todayStr)
      .lte('sale_date', todayStr);

    if (salesError) {
      console.error('[send-sale-notification] Today sales lookup failed:', salesError);
    }

    // Aggregate sales by team member
    const scoreboard: Record<string, {
      name: string;
      premium: number;
      items: number;
      policies: number;
      households: Set<string>;
    }> = {};

    // Initialize all sales team members with zero values
    for (const tm of eligibleTeamMembers) {
      scoreboard[tm.id] = {
        name: tm.name,
        premium: 0,
        items: 0,
        policies: 0,
        households: new Set(),
      };
    }

    // Add today's sales data
    for (const s of todaysSales || []) {
      if (scoreboard[s.team_member_id]) {
        scoreboard[s.team_member_id].premium += s.total_premium || 0;
        scoreboard[s.team_member_id].items += s.total_items || 0;
        scoreboard[s.team_member_id].policies += s.total_policies || 0;
        if (s.customer_name) {
          scoreboard[s.team_member_id].households.add(s.customer_name.toLowerCase().trim());
        }
      }
    }

    // Convert to array and sort by premium descending
    const scoreboardArray = Object.entries(scoreboard)
      .map(([id, data]) => ({
        id,
        name: data.name,
        premium: data.premium,
        items: data.items,
        policies: data.policies,
        households: data.households.size,
      }))
      .sort((a, b) => b.premium - a.premium);

    // Calculate team totals
    const teamTotals = scoreboardArray.reduce(
      (acc, curr) => ({
        premium: acc.premium + curr.premium,
        items: acc.items + curr.items,
        policies: acc.policies + curr.policies,
        households: acc.households + curr.households,
      }),
      { premium: 0, items: 0, policies: 0, households: 0 }
    );

    // 5. Get recipients (all active staff users with email)
    const { data: staffUsers, error: staffError } = await supabase
      .from('staff_users')
      .select('id, email')
      .eq('agency_id', body.agency_id)
      .eq('is_active', true)
      .not('email', 'is', null);

    if (staffError) {
      console.error('[send-sale-notification] Staff users lookup failed:', staffError);
    }

    const recipients = (staffUsers || [])
      .filter(u => u.email)
      .map(u => u.email as string);

    if (recipients.length === 0) {
      console.log('[send-sale-notification] No recipients found');
      return new Response(
        JSON.stringify({ success: true, message: 'No recipients' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Build email content
    const producerName = sale.team_member?.name || 'Unknown';
    const customerName = sale.customer_name || 'Unknown';
    const formatCurrency = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    const submittedTime = new Date(sale.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone });
    const todayDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: timezone });

    // Build scoreboard rows
    const scoreboardRowsHtml = scoreboardArray.map((entry, idx) => `
      <tr style="background: ${idx % 2 === 0 ? '#f9fafb' : '#ffffff'};">
        <td style="padding: 8px 12px; text-align: center; font-weight: 600;">${idx + 1}</td>
        <td style="padding: 8px 12px;">${entry.name}</td>
        <td style="padding: 8px 12px; text-align: right;">${formatCurrency(entry.premium)}</td>
        <td style="padding: 8px 12px; text-align: center;">${entry.items}</td>
        <td style="padding: 8px 12px; text-align: center;">${entry.policies}</td>
        <td style="padding: 8px 12px; text-align: center;">${entry.households}</td>
      </tr>
    `).join('');

    const emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="max-width: 650px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${BRAND.colors.primary}, ${BRAND.colors.secondary}); color: white; padding: 24px; border-radius: 8px 8px 0 0;">
      <img src="${BRAND.logo}" alt="${BRAND.name}" style="height: 40px; margin-bottom: 16px; display: block;">
      <h1 style="margin: 0; font-size: 24px;">🎉 New Sale Recorded</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">${agency.name}</p>
    </div>
    
    <!-- Body -->
    <div style="background: ${BRAND.colors.white}; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
      
      <!-- Sale Details -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #6b7280; width: 140px;">Producer:</td>
            <td style="padding: 6px 0; font-weight: 600;">${producerName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Customer:</td>
            <td style="padding: 6px 0; font-weight: 600;">${customerName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Premium:</td>
            <td style="padding: 6px 0; font-weight: 600; color: ${BRAND.colors.green};">${formatCurrency(sale.total_premium || 0)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Items:</td>
            <td style="padding: 6px 0;">${sale.total_items || 0}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Policies:</td>
            <td style="padding: 6px 0;">${sale.total_policies || 0}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Households:</td>
            <td style="padding: 6px 0;">1</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Effective Date:</td>
            <td style="padding: 6px 0;">${formatDate(sale.effective_date)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Bundle:</td>
            <td style="padding: 6px 0;">${sale.is_bundle ? '✓ Yes' : '✗ No'}${sale.bundle_type ? ` (${sale.bundle_type})` : ''}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Submitted:</td>
            <td style="padding: 6px 0;">${sale.source || 'Manual'} at ${submittedTime}</td>
          </tr>
        </table>
      </div>
      
      <!-- Scoreboard -->
      <div style="margin-top: 24px;">
        <h2 style="font-size: 18px; margin: 0 0 16px 0; color: ${BRAND.colors.primary};">📊 Today's Scoreboard - ${todayDate}</h2>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: ${BRAND.colors.lightBg};">
              <th style="padding: 10px 12px; text-align: center; font-weight: 600; border-bottom: 2px solid #e5e7eb; width: 40px;">#</th>
              <th style="padding: 10px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Name</th>
              <th style="padding: 10px 12px; text-align: right; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Premium</th>
              <th style="padding: 10px 12px; text-align: center; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Items</th>
              <th style="padding: 10px 12px; text-align: center; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Policies</th>
              <th style="padding: 10px 12px; text-align: center; font-weight: 600; border-bottom: 2px solid #e5e7eb;">HH</th>
            </tr>
          </thead>
          <tbody>
            ${scoreboardRowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: ${BRAND.colors.primary}; color: white;">
              <td style="padding: 10px 12px;"></td>
              <td style="padding: 10px 12px; font-weight: 600;">TEAM TOTAL</td>
              <td style="padding: 10px 12px; text-align: right; font-weight: 600;">${formatCurrency(teamTotals.premium)}</td>
              <td style="padding: 10px 12px; text-align: center; font-weight: 600;">${teamTotals.items}</td>
              <td style="padding: 10px 12px; text-align: center; font-weight: 600;">${teamTotals.policies}</td>
              <td style="padding: 10px 12px; text-align: center; font-weight: 600;">${teamTotals.households}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      
    </div>
    
    <!-- Footer -->
    <div style="background: ${BRAND.colors.lightBg}; padding: 16px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
      <p style="margin: 0; text-align: center; color: ${BRAND.colors.gray}; font-size: 12px;">
        ${agency.name} • Powered by ${BRAND.name}
      </p>
    </div>
    
  </div>
</body>
</html>`;

    const subject = `🎉 New Sale - ${customerName} by ${producerName} | ${agency.name}`;

    // 7. Send emails via Resend batch
    console.log('[send-sale-notification] Sending to', recipients.length, 'recipients');
    
    const emailBatch = recipients.map(email => ({
      from: BRAND.fromEmail,
      to: email,
      subject,
      html: emailHtml,
    }));

    const response = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBatch),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[send-sale-notification] Resend API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Email delivery failed', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    console.log('[send-sale-notification] Emails sent successfully:', result);

    return new Response(
      JSON.stringify({ success: true, recipients_count: recipients.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-sale-notification] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send notification' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
