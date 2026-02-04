import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { shouldSendDailySummary, getDayName } from '../_shared/business-days.ts';
import { BRAND } from '../_shared/email-template.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Timezone to hour offset map for common US timezones
const TIMEZONE_OFFSETS: Record<string, number> = {
  'America/New_York': -5,
  'America/Chicago': -6,
  'America/Denver': -7,
  'America/Los_Angeles': -8,
  'America/Phoenix': -7,
};

// Types for our data
interface SalesSnapshot {
  premium: number;
  items: number;
  policies: number;
  households: number;
}

interface ActivityMetrics {
  outboundCalls: number;
  talkMinutes: number;
  quotedHouseholds: number;
}

interface CallScoringSummary {
  callsScored: number;
  avgScore: number | null;
  topPerformer: { name: string; avgScore: number; callCount: number } | null;
}

interface AtRiskPolicies {
  pendingCancelCount: number;
  cancelCount: number;
  premiumAtRisk: number;
}

interface RenewalsDue {
  renewalCount: number;
  premiumAtStake: number;
}

interface SequenceTasks {
  completedYesterday: { name: string; count: number }[];
  overdueTasks: { name: string; count: number }[];
  dueToday: { name: string; count: number }[];
}

interface TrainingCompletion {
  staffName: string;
  lessonTitle: string;
  moduleTitle: string;
}

interface MorningDigestSections {
  salesSnapshot: boolean;
  activityMetrics: boolean;
  callScoring: boolean;
  atRiskPolicies: boolean;
  renewalsDue: boolean;
  sequenceTasks: boolean;
  trainingCompletions: boolean;
}

const DEFAULT_SECTIONS: MorningDigestSections = {
  salesSnapshot: true,
  activityMetrics: true,
  callScoring: true,
  atRiskPolicies: true,
  renewalsDue: true,
  sequenceTasks: true,
  trainingCompletions: true,
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
      console.error('[send-morning-digest] RESEND_API_KEY not configured');
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
        console.error('[send-morning-digest] FORCE TEST MODE requires testEmail parameter');
        return new Response(
          JSON.stringify({ error: 'forceTest mode requires testEmail parameter to prevent accidental sends' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (forceTest) {
        console.log(`[send-morning-digest] FORCE TEST MODE: sending ONLY to ${testEmail}`, testAgencyId ? `for agency ${testAgencyId}` : '');
      }
    } catch {
      // No body or invalid JSON, continue normally
    }

    console.log('[send-morning-digest] Starting morning digest check');

    // Check if today is a valid day to send summary
    // Skip Sunday (would report on Saturday) and Monday (would report on Sunday)
    const now = new Date();
    if (!forceTest && !shouldSendDailySummary(now)) {
      const dayName = getDayName(now);
      console.log(`[send-morning-digest] Skipping - today is ${dayName}, yesterday was not a business day`);
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'Yesterday was not a business day (weekend)',
          today: dayName
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current UTC time
    const nowUtc = new Date();
    const currentUtcHour = nowUtc.getUTCHours();

    console.log('[send-morning-digest] Current UTC hour:', currentUtcHour);

    // Fetch agencies with morning digest enabled (or specific agency if testing)
    let agencyQuery = supabase
      .from('agencies')
      .select('id, name, morning_digest_enabled, morning_digest_sections, timezone');

    if (forceTest && testAgencyId) {
      agencyQuery = agencyQuery.eq('id', testAgencyId);
    } else {
      agencyQuery = agencyQuery.eq('morning_digest_enabled', true);
    }

    const { data: agencies, error: agenciesError } = await agencyQuery;

    if (agenciesError) {
      console.error('[send-morning-digest] Agencies lookup failed:', agenciesError);
      throw agenciesError;
    }

    console.log('[send-morning-digest] Found', agencies?.length || 0, 'agencies with morning digest enabled');

    const results: { agency: string; status: string; recipients?: number }[] = [];

    for (const agency of agencies || []) {
      try {
        const timezone = agency.timezone || 'America/New_York';
        const sections: MorningDigestSections = { ...DEFAULT_SECTIONS, ...(agency.morning_digest_sections || {}) };

        // Calculate local hour for this agency
        const offset = TIMEZONE_OFFSETS[timezone] || -5;
        let localHour = currentUtcHour + offset;
        if (localHour < 0) localHour += 24;
        if (localHour >= 24) localHour -= 24;

        console.log(`[send-morning-digest] Agency ${agency.name}: timezone=${timezone}, localHour=${localHour}`);

        // Only send at 7 AM local time - unless force test mode
        if (!forceTest && localHour !== 7) {
          console.log(`[send-morning-digest] Skipping ${agency.name} - not 7 AM local time`);
          results.push({ agency: agency.name, status: 'skipped - not 7AM' });
          continue;
        }

        // Calculate date ranges
        const todayStr = nowUtc.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD
        const today = new Date(todayStr);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Get yesterday start/end timestamps for call scoring
        const yesterdayStart = `${yesterdayStr}T00:00:00`;
        const todayStart = `${todayStr}T00:00:00`;

        // Fetch all data in parallel
        const [
          salesSnapshot,
          activityMetrics,
          callScoring,
          atRiskPolicies,
          renewalsDue,
          sequenceTasks,
          trainingCompletions,
          recipients
        ] = await Promise.all([
          // 1. Yesterday's Sales Snapshot
          fetchSalesSnapshot(supabase, agency.id, yesterdayStr),

          // 2. Activity Metrics
          fetchActivityMetrics(supabase, agency.id, yesterdayStr),

          // 3. Call Scoring Summary
          fetchCallScoringSummary(supabase, agency.id, yesterdayStart, todayStart),

          // 4. At-Risk Policies
          fetchAtRiskPolicies(supabase, agency.id, todayStr, tomorrowStr),

          // 5. Renewals Due This Week
          fetchRenewalsDue(supabase, agency.id, todayStr, weekFromNow),

          // 6. Sequence Tasks Summary
          fetchSequenceTasks(supabase, agency.id, yesterdayStart, todayStart, todayStr),

          // 7. Training Completions
          fetchTrainingCompletions(supabase, agency.id, yesterdayStart, todayStart),

          // 8. Get recipients
          fetchRecipients(supabase, agency.id, forceTest, testEmail)
        ]);

        if (recipients.length === 0) {
          console.log(`[send-morning-digest] No recipients for ${agency.name}`);
          results.push({ agency: agency.name, status: 'skipped - no recipients' });
          continue;
        }

        // Build and send email
        const emailHtml = buildEmailHtml(
          agency.name,
          timezone,
          sections,
          salesSnapshot,
          activityMetrics,
          callScoring,
          atRiskPolicies,
          renewalsDue,
          sequenceTasks,
          trainingCompletions
        );

        const todayFormatted = new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          timeZone: timezone
        });
        const subject = `Good Morning, ${agency.name}! - ${todayFormatted}`;

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
          console.error(`[send-morning-digest] Resend error for ${agency.name}:`, errorText);
          results.push({ agency: agency.name, status: 'error - email send' });
          continue;
        }

        console.log(`[send-morning-digest] Sent to ${recipients.length} recipients for ${agency.name}`);
        results.push({ agency: agency.name, status: 'sent', recipients: recipients.length });

      } catch (agencyError) {
        console.error(`[send-morning-digest] Error processing ${agency.name}:`, agencyError);
        results.push({ agency: agency.name, status: 'error' });
      }
    }

    console.log('[send-morning-digest] Complete:', results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-morning-digest] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to send morning digest' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Data fetching functions
async function fetchSalesSnapshot(supabase: any, agencyId: string, dateStr: string): Promise<SalesSnapshot> {
  const { data, error } = await supabase
    .from('sales')
    .select('total_premium, total_items, total_policies, customer_name')
    .eq('agency_id', agencyId)
    .eq('sale_date', dateStr);

  if (error) {
    console.error('[send-morning-digest] Sales snapshot error:', error);
    return { premium: 0, items: 0, policies: 0, households: 0 };
  }

  const households = new Set<string>();
  let premium = 0, items = 0, policies = 0;

  for (const sale of data || []) {
    premium += sale.total_premium || 0;
    items += sale.total_items || 0;
    policies += sale.total_policies || 0;
    if (sale.customer_name) {
      households.add(sale.customer_name.toLowerCase().trim());
    }
  }

  return { premium, items, policies, households: households.size };
}

async function fetchActivityMetrics(supabase: any, agencyId: string, dateStr: string): Promise<ActivityMetrics> {
  const { data, error } = await supabase
    .from('metrics_daily')
    .select('outbound_calls, talk_minutes, quoted_count')
    .eq('agency_id', agencyId)
    .eq('date', dateStr);

  if (error) {
    console.error('[send-morning-digest] Activity metrics error:', error);
    return { outboundCalls: 0, talkMinutes: 0, quotedHouseholds: 0 };
  }

  let outboundCalls = 0, talkMinutes = 0, quotedHouseholds = 0;
  for (const row of data || []) {
    outboundCalls += row.outbound_calls || 0;
    talkMinutes += row.talk_minutes || 0;
    quotedHouseholds += row.quoted_count || 0;
  }

  return { outboundCalls, talkMinutes, quotedHouseholds };
}

async function fetchCallScoringSummary(
  supabase: any,
  agencyId: string,
  yesterdayStart: string,
  todayStart: string
): Promise<CallScoringSummary> {
  // Get summary stats
  const { data: summaryData, error: summaryError } = await supabase
    .from('agency_calls')
    .select('overall_score')
    .eq('agency_id', agencyId)
    .gte('created_at', yesterdayStart)
    .lt('created_at', todayStart)
    .not('overall_score', 'is', null);

  if (summaryError) {
    console.error('[send-morning-digest] Call scoring summary error:', summaryError);
    return { callsScored: 0, avgScore: null, topPerformer: null };
  }

  const scores = (summaryData || []).map((r: any) => r.overall_score);
  const callsScored = scores.length;
  const avgScore = callsScored > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / callsScored) : null;

  // Get top performer
  const { data: topData, error: topError } = await supabase
    .from('agency_calls')
    .select('overall_score, team_member:team_members!agency_calls_team_member_id_fkey(name)')
    .eq('agency_id', agencyId)
    .gte('created_at', yesterdayStart)
    .lt('created_at', todayStart)
    .not('overall_score', 'is', null);

  let topPerformer: { name: string; avgScore: number; callCount: number } | null = null;

  if (!topError && topData && topData.length > 0) {
    // Aggregate by team member
    const byMember: Record<string, { name: string; scores: number[] }> = {};
    for (const call of topData as any[]) {
      const name = call.team_member?.name || 'Unknown';
      if (!byMember[name]) {
        byMember[name] = { name, scores: [] };
      }
      byMember[name].scores.push(call.overall_score);
    }

    // Find top performer by average
    let topAvg = 0;
    for (const member of Object.values(byMember)) {
      const avg = member.scores.reduce((a, b) => a + b, 0) / member.scores.length;
      if (avg > topAvg) {
        topAvg = avg;
        topPerformer = {
          name: member.name,
          avgScore: Math.round(avg),
          callCount: member.scores.length
        };
      }
    }
  }

  return { callsScored, avgScore, topPerformer };
}

async function fetchAtRiskPolicies(
  supabase: any,
  agencyId: string,
  todayStr: string,
  tomorrowStr: string
): Promise<AtRiskPolicies> {
  const { data, error } = await supabase
    .from('cancel_audit_records')
    .select('pending_cancel_date, cancel_date, premium_cents')
    .eq('agency_id', agencyId)
    .not('status', 'in', '(resolved,lost)')
    .or(`pending_cancel_date.lte.${tomorrowStr},cancel_date.lte.${tomorrowStr}`);

  if (error) {
    console.error('[send-morning-digest] At-risk policies error:', error);
    return { pendingCancelCount: 0, cancelCount: 0, premiumAtRisk: 0 };
  }

  let pendingCancelCount = 0, cancelCount = 0, premiumAtRisk = 0;

  for (const record of data || []) {
    const pending = record.pending_cancel_date;
    const cancel = record.cancel_date;
    const premium = (record.premium_cents || 0) / 100;

    if (pending && pending >= todayStr && pending <= tomorrowStr) {
      pendingCancelCount++;
      premiumAtRisk += premium;
    }
    if (cancel && cancel >= todayStr && cancel <= tomorrowStr) {
      cancelCount++;
      if (!pending || pending < todayStr || pending > tomorrowStr) {
        premiumAtRisk += premium; // Don't double count
      }
    }
  }

  return { pendingCancelCount, cancelCount, premiumAtRisk };
}

async function fetchRenewalsDue(
  supabase: any,
  agencyId: string,
  todayStr: string,
  weekFromNow: string
): Promise<RenewalsDue> {
  const { data, error } = await supabase
    .from('renewal_records')
    .select('premium_new')
    .eq('agency_id', agencyId)
    .not('current_status', 'in', '(resolved,lost)')
    .gte('renewal_effective_date', todayStr)
    .lte('renewal_effective_date', weekFromNow);

  if (error) {
    console.error('[send-morning-digest] Renewals due error:', error);
    return { renewalCount: 0, premiumAtStake: 0 };
  }

  const renewalCount = data?.length || 0;
  // premium_new is already in dollars (not cents)
  const premiumAtStake = (data || []).reduce((sum: number, r: any) => sum + (r.premium_new || 0), 0);

  return { renewalCount, premiumAtStake };
}

async function fetchSequenceTasks(
  supabase: any,
  agencyId: string,
  yesterdayStart: string,
  todayStart: string,
  todayStr: string
): Promise<SequenceTasks> {
  // Completed yesterday
  const { data: completedData } = await supabase
    .from('onboarding_tasks')
    .select(`
      assigned_to_staff_user_id,
      assigned_to_user_id,
      staff_user:staff_users!onboarding_tasks_assigned_to_staff_user_id_fkey(display_name),
      profile:profiles!onboarding_tasks_assigned_to_user_id_fkey(full_name, email)
    `)
    .eq('agency_id', agencyId)
    .eq('status', 'completed')
    .gte('completed_at', yesterdayStart)
    .lt('completed_at', todayStart);

  const completedByUser: Record<string, { name: string; count: number }> = {};
  for (const task of (completedData || []) as any[]) {
    const name = task.staff_user?.display_name || task.profile?.full_name || task.profile?.email || 'Unknown';
    if (!completedByUser[name]) {
      completedByUser[name] = { name, count: 0 };
    }
    completedByUser[name].count++;
  }
  const completedYesterday = Object.values(completedByUser).filter(u => u.count > 0);

  // Overdue and due today
  const { data: pendingData } = await supabase
    .from('onboarding_tasks')
    .select(`
      status,
      due_date,
      assigned_to_staff_user_id,
      assigned_to_user_id,
      staff_user:staff_users!onboarding_tasks_assigned_to_staff_user_id_fkey(display_name),
      profile:profiles!onboarding_tasks_assigned_to_user_id_fkey(full_name, email)
    `)
    .eq('agency_id', agencyId)
    .in('status', ['overdue', 'due', 'pending']);

  const overdueByUser: Record<string, { name: string; count: number }> = {};
  const dueTodayByUser: Record<string, { name: string; count: number }> = {};

  for (const task of (pendingData || []) as any[]) {
    const name = task.staff_user?.display_name || task.profile?.full_name || task.profile?.email || 'Unknown';

    if (task.status === 'overdue') {
      if (!overdueByUser[name]) {
        overdueByUser[name] = { name, count: 0 };
      }
      overdueByUser[name].count++;
    }

    if (task.status === 'due' || (task.status === 'pending' && task.due_date === todayStr)) {
      if (!dueTodayByUser[name]) {
        dueTodayByUser[name] = { name, count: 0 };
      }
      dueTodayByUser[name].count++;
    }
  }

  return {
    completedYesterday,
    overdueTasks: Object.values(overdueByUser).filter(u => u.count > 0),
    dueToday: Object.values(dueTodayByUser).filter(u => u.count > 0)
  };
}

async function fetchTrainingCompletions(
  supabase: any,
  agencyId: string,
  yesterdayStart: string,
  todayStart: string
): Promise<TrainingCompletion[]> {
  const { data, error } = await supabase
    .from('sales_experience_staff_progress')
    .select(`
      completed_at,
      staff_user:staff_users!sales_experience_staff_progress_staff_user_id_fkey(display_name),
      lesson:sales_experience_lessons!sales_experience_staff_progress_lesson_id_fkey(
        title,
        module:sales_experience_modules!sales_experience_lessons_module_id_fkey(title)
      ),
      assignment:sales_experience_assignments!sales_experience_staff_progress_assignment_id_fkey(
        agency_id,
        status
      )
    `)
    .eq('status', 'completed')
    .gte('completed_at', yesterdayStart)
    .lt('completed_at', todayStart);

  if (error) {
    console.error('[send-morning-digest] Training completions error:', error);
    return [];
  }

  const completions: TrainingCompletion[] = [];
  for (const progress of (data || []) as any[]) {
    // Filter by agency and active status
    if (progress.assignment?.agency_id === agencyId && progress.assignment?.status === 'active') {
      completions.push({
        staffName: progress.staff_user?.display_name || 'Unknown',
        lessonTitle: progress.lesson?.title || 'Unknown Lesson',
        moduleTitle: progress.lesson?.module?.title || 'Unknown Module'
      });
    }
  }

  return completions;
}

async function fetchRecipients(
  supabase: any,
  agencyId: string,
  forceTest: boolean,
  testEmail: string | null
): Promise<string[]> {
  if (forceTest && testEmail) {
    return [testEmail];
  }

  // Get owner + key employees only
  const { data: profiles } = await supabase
    .from('profiles')
    .select('email')
    .eq('agency_id', agencyId)
    .in('role', ['agency_owner', 'key_employee'])
    .eq('is_active', true)
    .not('email', 'is', null);

  return (profiles || [])
    .filter((p: any) => p.email)
    .map((p: any) => p.email as string);
}

// Email HTML builder
function buildEmailHtml(
  agencyName: string,
  timezone: string,
  sections: MorningDigestSections,
  sales: SalesSnapshot,
  activity: ActivityMetrics,
  callScoring: CallScoringSummary,
  atRisk: AtRiskPolicies,
  renewals: RenewalsDue,
  sequenceTasks: SequenceTasks,
  trainingCompletions: TrainingCompletion[]
): string {
  const formatCurrency = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone
  });

  // Calculate if there are any attention items (respecting section preferences)
  const totalAtRisk = atRisk.pendingCancelCount + atRisk.cancelCount;
  const totalOverdue = sequenceTasks.overdueTasks.reduce((sum, u) => sum + u.count, 0);
  const hasAttentionItems =
    (sections.atRiskPolicies && totalAtRisk > 0) ||
    (sections.renewalsDue && renewals.renewalCount > 0) ||
    (sections.sequenceTasks && totalOverdue > 0);

  // Calculate wins (respecting section preferences)
  const totalCompleted = sequenceTasks.completedYesterday.reduce((sum, u) => sum + u.count, 0);
  const hasWins =
    (sections.trainingCompletions && trainingCompletions.length > 0) ||
    (sections.sequenceTasks && (totalCompleted > 0 || sequenceTasks.dueToday.length > 0));

  // Check if any highlights sections are enabled
  const hasHighlights = sections.salesSnapshot || sections.activityMetrics || sections.callScoring;

  return `<!DOCTYPE html>
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
      <h1 style="margin: 0; font-size: 24px;">Good Morning, ${agencyName}!</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">${todayFormatted}</p>
    </div>

    <!-- Body -->
    <div style="background: ${BRAND.colors.white}; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">

      ${hasHighlights ? `
      <!-- Yesterday's Highlights Section -->
      <h2 style="font-size: 14px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid ${BRAND.colors.lightBg};">
        Yesterday's Highlights
      </h2>

      <!-- Three Column Stats -->
      <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;">

        ${sections.salesSnapshot ? `
        <!-- Sales Card -->
        <div style="flex: 1; min-width: 180px; background: ${BRAND.colors.lightBg}; border-radius: 8px; padding: 16px;">
          <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 8px;">Sales</div>
          <div style="font-size: 28px; font-weight: 700; color: ${sales.premium > 0 ? BRAND.colors.green : '#9ca3af'}; margin-bottom: 8px;">
            ${formatCurrency(sales.premium)}
          </div>
          <div style="font-size: 13px; color: #4b5563;">
            ${sales.items} items &bull; ${sales.policies} policies &bull; ${sales.households} HH
          </div>
        </div>
        ` : ''}

        ${sections.activityMetrics ? `
        <!-- Activity Card -->
        <div style="flex: 1; min-width: 180px; background: ${BRAND.colors.lightBg}; border-radius: 8px; padding: 16px;">
          <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 8px;">Activity</div>
          <div style="font-size: 28px; font-weight: 700; color: ${BRAND.colors.primary}; margin-bottom: 8px;">
            ${activity.outboundCalls} calls
          </div>
          <div style="font-size: 13px; color: #4b5563;">
            ${activity.talkMinutes} min talk &bull; ${activity.quotedHouseholds} quotes
          </div>
        </div>
        ` : ''}

        ${sections.callScoring ? `
        <!-- Call Scores Card -->
        <div style="flex: 1; min-width: 180px; background: ${BRAND.colors.lightBg}; border-radius: 8px; padding: 16px;">
          <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 8px;">Call Scores</div>
          <div style="font-size: 28px; font-weight: 700; color: ${BRAND.colors.primary}; margin-bottom: 8px;">
            ${callScoring.avgScore !== null ? `${callScoring.avgScore}%` : '--'}
          </div>
          <div style="font-size: 13px; color: #4b5563;">
            ${callScoring.callsScored} scored${callScoring.topPerformer ? ` &bull; Top: ${callScoring.topPerformer.name}` : ''}
          </div>
        </div>
        ` : ''}

      </div>
      ` : ''}

      ${hasAttentionItems ? `
      <!-- Needs Attention Section -->
      <h2 style="font-size: 14px; font-weight: 600; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #fecaca;">
        Needs Attention Today
      </h2>

      <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #ef4444;">
        ${sections.atRiskPolicies && totalAtRisk > 0 ? `
        <div style="margin-bottom: ${(sections.renewalsDue && renewals.renewalCount > 0) || (sections.sequenceTasks && totalOverdue > 0) ? '12px' : '0'};">
          <strong style="color: #991b1b;">${totalAtRisk} ${totalAtRisk === 1 ? 'policy' : 'policies'} at risk of cancellation</strong>
          <div style="font-size: 13px; color: #7f1d1d; margin-top: 4px;">
            ${atRisk.premiumAtRisk > 0 ? `${formatCurrency(atRisk.premiumAtRisk)} premium at stake` : ''}
            ${atRisk.pendingCancelCount > 0 ? ` (${atRisk.pendingCancelCount} pending cancel)` : ''}
            ${atRisk.cancelCount > 0 ? ` (${atRisk.cancelCount} cancel date)` : ''}
          </div>
        </div>
        ` : ''}

        ${sections.renewalsDue && renewals.renewalCount > 0 ? `
        <div style="margin-bottom: ${sections.sequenceTasks && totalOverdue > 0 ? '12px' : '0'};">
          <strong style="color: #991b1b;">${renewals.renewalCount} ${renewals.renewalCount === 1 ? 'renewal' : 'renewals'} due this week</strong>
          <div style="font-size: 13px; color: #7f1d1d; margin-top: 4px;">
            ${formatCurrency(renewals.premiumAtStake)} premium up for renewal
          </div>
        </div>
        ` : ''}

        ${sections.sequenceTasks && totalOverdue > 0 ? `
        <div>
          <strong style="color: #991b1b;">${totalOverdue} overdue sequence ${totalOverdue === 1 ? 'task' : 'tasks'}</strong>
          <div style="font-size: 13px; color: #7f1d1d; margin-top: 4px;">
            ${sequenceTasks.overdueTasks.map(u => `${u.name} (${u.count})`).join(', ')}
          </div>
        </div>
        ` : ''}
      </div>
      ` : ''}

      ${hasWins ? `
      <!-- Wins & Progress Section -->
      <h2 style="font-size: 14px; font-weight: 600; color: ${BRAND.colors.green}; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #bbf7d0;">
        Wins & Progress
      </h2>

      <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid ${BRAND.colors.green};">
        ${sections.trainingCompletions && trainingCompletions.length > 0 ? `
        <div style="margin-bottom: ${(sections.sequenceTasks && totalCompleted > 0) || (sections.sequenceTasks && sequenceTasks.dueToday.length > 0) ? '12px' : '0'};">
          <strong style="color: #166534;">Training Completed Yesterday</strong>
          <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #15803d; font-size: 13px;">
            ${trainingCompletions.map(c => `<li>${c.staffName} completed "${c.lessonTitle}"</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        ${sections.sequenceTasks && totalCompleted > 0 ? `
        <div style="margin-bottom: ${sections.sequenceTasks && sequenceTasks.dueToday.length > 0 ? '12px' : '0'};">
          <strong style="color: #166534;">Sequence Tasks Completed: ${totalCompleted}</strong>
          <div style="font-size: 13px; color: #15803d; margin-top: 4px;">
            ${sequenceTasks.completedYesterday.map(u => `${u.name} (${u.count})`).join(', ')}
          </div>
        </div>
        ` : ''}

        ${sections.sequenceTasks && sequenceTasks.dueToday.length > 0 ? `
        <div>
          <strong style="color: #166534;">Due Today</strong>
          <div style="font-size: 13px; color: #15803d; margin-top: 4px;">
            ${sequenceTasks.dueToday.map(u => `${u.name} (${u.count})`).join(', ')}
          </div>
        </div>
        ` : ''}
      </div>
      ` : ''}

      <!-- CTA Button -->
      <div style="text-align: center; margin: 24px 0 8px 0;">
        <a href="https://app.agencybrain.io" style="background: ${BRAND.colors.primary}; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
          View Full Dashboard
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="background: ${BRAND.colors.lightBg}; padding: 16px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
      <p style="margin: 0; text-align: center; color: ${BRAND.colors.gray}; font-size: 12px;">
        ${agencyName} &bull; Powered by ${BRAND.name}
      </p>
    </div>

  </div>
</body>
</html>`;
}
