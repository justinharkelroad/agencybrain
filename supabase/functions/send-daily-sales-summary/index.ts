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

// Timezone to hour offset map for common US timezones
const TIMEZONE_OFFSETS: Record<string, number> = {
  'America/New_York': -5,
  'America/Chicago': -6,
  'America/Denver': -7,
  'America/Los_Angeles': -8,
  'America/Phoenix': -7,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!RESEND_API_KEY) {
      console.error('[send-daily-sales-summary] RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Parse request body for test mode
    let forceTest = false;
    let testAgencyId: string | null = null;
    let testEmail: string | null = null;
    try {
      const body = await req.json();
      forceTest = body?.forceTest === true;
      testAgencyId = body?.agencyId || null;
      testEmail = body?.testEmail || null;
      
      // CRITICAL: forceTest mode REQUIRES a testEmail to prevent accidental sends
      if (forceTest && !testEmail) {
        console.error('[send-daily-sales-summary] FORCE TEST MODE requires testEmail parameter');
        return new Response(
          JSON.stringify({ error: 'forceTest mode requires testEmail parameter to prevent accidental sends' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (forceTest) {
        console.log(`[send-daily-sales-summary] FORCE TEST MODE: sending ONLY to ${testEmail}`, testAgencyId ? `for agency ${testAgencyId}` : '');
      }
    } catch {
      // No body or invalid JSON, continue normally
    }
    
    console.log('[send-daily-sales-summary] Starting daily summary check');

    // Get current UTC time
    const nowUtc = new Date();
    const currentUtcHour = nowUtc.getUTCHours();
    
    console.log('[send-daily-sales-summary] Current UTC hour:', currentUtcHour);

    // Fetch agencies with daily summary enabled (or specific agency if testing)
    let agencyQuery = supabase
      .from('agencies')
      .select('id, name, sales_daily_summary_enabled, timezone');
    
    if (forceTest && testAgencyId) {
      agencyQuery = agencyQuery.eq('id', testAgencyId);
    } else {
      agencyQuery = agencyQuery.eq('sales_daily_summary_enabled', true);
    }
    
    const { data: agencies, error: agenciesError } = await agencyQuery;

    if (agenciesError) {
      console.error('[send-daily-sales-summary] Agencies lookup failed:', agenciesError);
      throw agenciesError;
    }

    console.log('[send-daily-sales-summary] Found', agencies?.length || 0, 'agencies with daily summary enabled');

    const results: { agency: string; status: string; recipients?: number }[] = [];

    for (const agency of agencies || []) {
      try {
        const timezone = agency.timezone || 'America/New_York';
        
        // Calculate local hour for this agency
        // Note: This is a simplified calculation; DST not handled perfectly
        const offset = TIMEZONE_OFFSETS[timezone] || -5;
        let localHour = currentUtcHour + offset;
        if (localHour < 0) localHour += 24;
        if (localHour >= 24) localHour -= 24;

        console.log(`[send-daily-sales-summary] Agency ${agency.name}: timezone=${timezone}, localHour=${localHour}`);

        // Only send at 7 PM local time (19:00) - unless force test mode
        if (!forceTest && localHour !== 19) {
          console.log(`[send-daily-sales-summary] Skipping ${agency.name} - not 7 PM local time`);
          results.push({ agency: agency.name, status: 'skipped - not 7PM' });
          continue;
        }

        // Get today's date in agency timezone
        const todayStr = nowUtc.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD

        // Get all sales team members
        const { data: salesTeamMembers, error: teamError } = await supabase
          .from('team_members')
          .select('id, name, role, hybrid_team_assignments')
          .eq('agency_id', agency.id)
          .eq('status', 'active')
          .or('role.eq.Sales,role.eq.Hybrid');

        if (teamError) {
          console.error(`[send-daily-sales-summary] Team lookup failed for ${agency.name}:`, teamError);
          results.push({ agency: agency.name, status: 'error - team lookup' });
          continue;
        }

        // Filter to only include Sales role or Hybrid with Sales
        const eligibleTeamMembers = (salesTeamMembers || []).filter(tm => {
          if (tm.role === 'Sales') return true;
          if (tm.role === 'Hybrid' && Array.isArray(tm.hybrid_team_assignments)) {
            return tm.hybrid_team_assignments.includes('Sales');
          }
          return false;
        });

        if (eligibleTeamMembers.length === 0) {
          console.log(`[send-daily-sales-summary] No sales team members for ${agency.name}`);
          results.push({ agency: agency.name, status: 'skipped - no sales team' });
          continue;
        }

        // Get today's sales
        const { data: todaysSales, error: salesError } = await supabase
          .from('sales')
          .select(`
            id,
            team_member_id,
            customer_name,
            total_premium,
            total_items,
            total_policies,
            total_points,
            created_at,
            team_member:team_members!sales_team_member_id_fkey(name)
          `)
          .eq('agency_id', agency.id)
          .gte('sale_date', todayStr)
          .lte('sale_date', todayStr)
          .order('created_at', { ascending: true });

        if (salesError) {
          console.error(`[send-daily-sales-summary] Sales lookup failed for ${agency.name}:`, salesError);
          results.push({ agency: agency.name, status: 'error - sales lookup' });
          continue;
        }

        // Aggregate sales by team member
        const scoreboard: Record<string, {
          name: string;
          premium: number;
          items: number;
          policies: number;
          points: number;
          households: Set<string>;
        }> = {};

        // Initialize all team members
        for (const tm of eligibleTeamMembers) {
          scoreboard[tm.id] = {
            name: tm.name,
            premium: 0,
            items: 0,
            policies: 0,
            points: 0,
            households: new Set(),
          };
        }

        // Add sales data
        for (const s of todaysSales || []) {
          if (scoreboard[s.team_member_id]) {
            scoreboard[s.team_member_id].premium += s.total_premium || 0;
            scoreboard[s.team_member_id].items += s.total_items || 0;
            scoreboard[s.team_member_id].policies += s.total_policies || 0;
            scoreboard[s.team_member_id].points += s.total_points || 0;
            if (s.customer_name) {
              scoreboard[s.team_member_id].households.add(s.customer_name.toLowerCase().trim());
            }
          }
        }

        // Convert to sorted array
        const scoreboardArray = Object.entries(scoreboard)
          .map(([id, data]) => ({
            id,
            name: data.name,
            premium: data.premium,
            items: data.items,
            policies: data.policies,
            points: data.points,
            households: data.households.size,
          }))
          .sort((a, b) => b.premium - a.premium);

        // Calculate totals
        const teamTotals = scoreboardArray.reduce(
          (acc, curr) => ({
            premium: acc.premium + curr.premium,
            items: acc.items + curr.items,
            policies: acc.policies + curr.policies,
            points: acc.points + curr.points,
            households: acc.households + curr.households,
          }),
          { premium: 0, items: 0, policies: 0, points: 0, households: 0 }
        );

        // Get recipients - in forceTest mode, ONLY send to the specified testEmail
        let recipients: string[] = [];
        
        if (forceTest && testEmail) {
          // CRITICAL: In test mode, ONLY send to the explicitly specified email
          recipients = [testEmail];
          console.log(`[send-daily-sales-summary] TEST MODE: Sending ONLY to ${testEmail} (not to staff users)`);
        } else {
          // Normal production mode: get all active staff users
          const { data: staffUsers } = await supabase
            .from('staff_users')
            .select('email')
            .eq('agency_id', agency.id)
            .eq('is_active', true)
            .not('email', 'is', null);

          recipients = (staffUsers || [])
            .filter(u => u.email)
            .map(u => u.email as string);
        }

        if (recipients.length === 0) {
          console.log(`[send-daily-sales-summary] No recipients for ${agency.name}`);
          results.push({ agency: agency.name, status: 'skipped - no recipients' });
          continue;
        }

        // Format helpers
        const formatCurrency = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone });
        const todayFormatted = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: timezone });

        // Build performance rows
        const performanceRowsHtml = scoreboardArray.map((entry, idx) => `
          <tr style="background: ${idx % 2 === 0 ? '#f9fafb' : '#ffffff'};">
            <td style="padding: 8px 12px; text-align: center; font-weight: 600;">${idx + 1}</td>
            <td style="padding: 8px 12px;">${entry.name}</td>
            <td style="padding: 8px 12px; text-align: right;">${formatCurrency(entry.premium)}</td>
            <td style="padding: 8px 12px; text-align: center;">${entry.items}</td>
            <td style="padding: 8px 12px; text-align: center;">${entry.policies}</td>
            <td style="padding: 8px 12px; text-align: center;">${entry.households}</td>
            <td style="padding: 8px 12px; text-align: center;">${entry.points}</td>
          </tr>
        `).join('');

        // Build sales log
        const salesLogHtml = (todaysSales || []).length > 0
          ? (todaysSales || []).map(s => `
            <tr>
              <td style="padding: 6px 12px; color: #6b7280;">${formatTime(s.created_at)}</td>
              <td style="padding: 6px 12px;">${s.team_member?.name || 'Unknown'}</td>
              <td style="padding: 6px 12px;">${s.customer_name}</td>
              <td style="padding: 6px 12px; text-align: right;">${formatCurrency(s.total_premium || 0)}</td>
            </tr>
          `).join('')
          : '<tr><td colspan="4" style="padding: 16px; text-align: center; color: #6b7280;">No sales recorded today</td></tr>';

        const emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="max-width: 700px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${BRAND.colors.primary}, ${BRAND.colors.secondary}); color: white; padding: 24px; border-radius: 8px 8px 0 0;">
      <img src="${BRAND.logo}" alt="${BRAND.name}" style="height: 40px; margin-bottom: 16px; display: block;">
      <h1 style="margin: 0; font-size: 24px;">📊 Daily Sales Summary</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">${todayFormatted}</p>
    </div>
    
    <!-- Body -->
    <div style="background: ${BRAND.colors.white}; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
      
      <!-- Team Totals -->
      <div style="background: ${BRAND.colors.lightBg}; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 16px 0; color: ${BRAND.colors.primary};">TEAM TOTALS</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 16px;">
          <div style="flex: 1; min-width: 140px;">
            <div style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Premium</div>
            <div style="font-size: 24px; font-weight: 700; color: ${BRAND.colors.green}; white-space: nowrap;">${formatCurrency(teamTotals.premium)}</div>
          </div>
          <div style="flex: 1; min-width: 60px;">
            <div style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Items</div>
            <div style="font-size: 24px; font-weight: 700;">${teamTotals.items}</div>
          </div>
          <div style="flex: 1; min-width: 60px;">
            <div style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Policies</div>
            <div style="font-size: 24px; font-weight: 700;">${teamTotals.policies}</div>
          </div>
          <div style="flex: 1; min-width: 60px;">
            <div style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Households</div>
            <div style="font-size: 24px; font-weight: 700;">${teamTotals.households}</div>
          </div>
          <div style="flex: 1; min-width: 60px;">
            <div style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Points</div>
            <div style="font-size: 24px; font-weight: 700;">${teamTotals.points}</div>
          </div>
        </div>
      </div>
      
      <!-- Individual Performance -->
      <h2 style="font-size: 16px; margin: 0 0 16px 0; color: ${BRAND.colors.primary};">INDIVIDUAL PERFORMANCE</h2>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
        <thead>
          <tr style="background: ${BRAND.colors.lightBg};">
            <th style="padding: 10px 12px; text-align: center; font-weight: 600; border-bottom: 2px solid #e5e7eb; width: 40px;">#</th>
            <th style="padding: 10px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Name</th>
            <th style="padding: 10px 12px; text-align: right; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Premium</th>
            <th style="padding: 10px 12px; text-align: center; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Items</th>
            <th style="padding: 10px 12px; text-align: center; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Policies</th>
            <th style="padding: 10px 12px; text-align: center; font-weight: 600; border-bottom: 2px solid #e5e7eb;">HH</th>
            <th style="padding: 10px 12px; text-align: center; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Pts</th>
          </tr>
        </thead>
        <tbody>
          ${performanceRowsHtml}
        </tbody>
      </table>
      
      <!-- Sales Log -->
      <h2 style="font-size: 16px; margin: 0 0 16px 0; color: ${BRAND.colors.primary};">SALES LOG</h2>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: ${BRAND.colors.lightBg};">
            <th style="padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Time</th>
            <th style="padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Producer</th>
            <th style="padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Customer</th>
            <th style="padding: 8px 12px; text-align: right; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Premium</th>
          </tr>
        </thead>
        <tbody>
          ${salesLogHtml}
        </tbody>
      </table>
      
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

        const subject = `📊 Daily Sales Summary - ${todayFormatted} | ${agency.name}`;

        // Send emails
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
          console.error(`[send-daily-sales-summary] Resend error for ${agency.name}:`, errorText);
          results.push({ agency: agency.name, status: 'error - email send' });
          continue;
        }

        console.log(`[send-daily-sales-summary] Sent to ${recipients.length} recipients for ${agency.name}`);
        results.push({ agency: agency.name, status: 'sent', recipients: recipients.length });

      } catch (agencyError) {
        console.error(`[send-daily-sales-summary] Error processing ${agency.name}:`, agencyError);
        results.push({ agency: agency.name, status: 'error' });
      }
    }

    console.log('[send-daily-sales-summary] Complete:', results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-daily-sales-summary] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send daily summary' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
