import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { BRAND, buildEmailHtml, EmailComponents } from '../_shared/email-template.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');

    if (!resendKey) {
      console.log('RESEND_API_KEY not configured, skipping');
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();

    // Calculate ISO week key for today
    const tempDate = new Date(now);
    const utcDay = tempDate.getUTCDay() || 7;
    tempDate.setUTCDate(tempDate.getUTCDate() + 4 - utcDay);
    const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((tempDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    const weekKey = `${tempDate.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;

    console.log('Debrief reminder check for week:', weekKey);

    // Find 1:1 coaching clients (agency owners) who haven't completed this week's debrief
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, agency_id, membership_tier')
      .or('membership_tier.ilike.%1:1%,membership_tier.ilike.%coaching%,membership_tier.ilike.%one_on_one%,membership_tier.ilike.%one-on-one%,membership_tier.ilike.%one on one%')
      .not('email', 'is', null);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    if (!profiles || profiles.length === 0) {
      console.log('No 1:1 clients found');
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${profiles.length} 1:1 clients to check`);

    // Get agency timezones
    const agencyIds = [...new Set(profiles.map(p => p.agency_id).filter(Boolean))];
    const { data: agencies } = await supabase
      .from('agencies')
      .select('id, timezone, name')
      .in('id', agencyIds.length > 0 ? agencyIds : ['00000000-0000-0000-0000-000000000000']);

    const agencyMap = new Map(agencies?.map(a => [a.id, a]) || []);

    // Check which users already completed this week's debrief
    const userIds = profiles.map(p => p.id);
    const { data: completedReviews } = await supabase
      .from('weekly_reviews')
      .select('user_id')
      .in('user_id', userIds)
      .eq('week_key', weekKey)
      .eq('status', 'completed');

    const completedSet = new Set(completedReviews?.map(r => r.user_id) || []);

    // Check dedup per agency — email_send_log uses (agency_id, email_type, send_date)
    // We use send_date as the local Sunday date for each agency
    const { data: sentLogs } = await supabase
      .from('email_send_log')
      .select('agency_id, send_date')
      .eq('email_type', 'debrief_reminder');

    // Build a set of "agency_id|send_date" for quick lookup
    const alreadySentSet = new Set(sentLogs?.map(l => `${l.agency_id}|${l.send_date}`) || []);

    // Filter to eligible recipients
    const eligible: typeof profiles = [];
    // Track which agencies we'll send for (for dedup logging)
    const agencySendDates = new Map<string, string>();

    for (const p of profiles) {
      if (!p.email || !p.agency_id) continue;
      if (completedSet.has(p.id)) continue;

      // Check if it's Sunday morning in their timezone
      const agency = agencyMap.get(p.agency_id);
      const tz = agency?.timezone || 'America/New_York';
      try {
        const localDay = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz }).format(now);
        const localHour = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(now));
        // Send on Sunday between 7-9 AM local time (2-hour window per CLAUDE.md)
        if (localDay !== 'Sunday') continue;
        if (localHour < 7 || localHour > 9) continue;

        // Get local date string for dedup
        const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);

        // Check if already sent for this agency today
        if (alreadySentSet.has(`${p.agency_id}|${localDate}`)) continue;

        eligible.push(p);
        agencySendDates.set(p.agency_id, localDate);
      } catch {
        continue;
      }
    }

    console.log(`${eligible.length} eligible for reminder`);

    if (eligible.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build and send emails via Resend batch API
    const emailBatch = eligible.map(p => {
      const agency = agencyMap.get(p.agency_id);
      const firstName = p.full_name?.split(' ')[0] || 'there';

      const emailHtml = buildEmailHtml({
        title: 'Your Weekly Debrief is Ready',
        subtitle: weekKey,
        bodyContent: `
          ${EmailComponents.paragraph(`Good morning, ${firstName}.`)}
          ${EmailComponents.paragraph(`It's Sunday — time to close out the week and set yourself up for what's next.`)}
          ${EmailComponents.paragraph(`Your Debrief is ready. Take 10 minutes to reflect on your wins, course correct where you need to, rate your effort across Body, Being, Balance, and Business, and plan your power plays for the week ahead.`)}
          ${EmailComponents.paragraph(`When you're done, your coach will deliver a personalized analysis of your week — what you crushed, what you left on the table, and where to push harder.`)}
          <div style="text-align: center; margin: 32px 0;">
            <a href="https://app.standardplaybook.com/debrief" style="background: ${BRAND.colors.primary}; color: white; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 16px;">Begin Your Debrief</a>
          </div>
          ${EmailComponents.infoText(`The person who reflects on their week is already ahead of the person who just lets it pass.`)}
        `,
        footerAgencyName: agency?.name,
      });

      return {
        from: BRAND.fromEmail,
        to: p.email,
        subject: `Your Weekly Debrief is Ready — ${weekKey}`,
        html: emailHtml,
      };
    });

    const emailResponse = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBatch),
    });

    const emailResult = await emailResponse.json();
    console.log('Email send result:', JSON.stringify(emailResult));

    // Log sends for dedup — one entry per agency
    const logEntries = [...agencySendDates.entries()].map(([agencyId, sendDate]) => ({
      agency_id: agencyId,
      email_type: 'debrief_reminder',
      send_date: sendDate,
      recipient_count: eligible.filter(p => p.agency_id === agencyId).length,
    }));

    try {
      await supabase.from('email_send_log').insert(logEntries);
    } catch (logErr) {
      console.error('Failed to log email sends (non-fatal):', logErr);
    }

    return new Response(JSON.stringify({ sent: eligible.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-debrief-reminder:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
