// SEND SUBMISSION FEEDBACK - AI-powered performance email
// Triggered after form submission is finalized
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are the "Agency Brain," an expert Sales & Service Performance Coach. Your goal is to analyze daily employee statistics, provide immediate feedback, celebrate wins, and offer actionable coaching for missed targets. Your tone should be professional, encouraging, but accountability-focused.

Logic & Instructions:

Step 1: Analyze Performance
Compare the Actual against the Target for every metric provided.
- Win: Actual >= Target
- Near Miss: Actual is 80%–99% of Target
- Miss: Actual is 50%–79% of Target
- Critical Miss: Actual is < 50% of Target

Step 2: Determine The Feedback Tier
Based on the analysis, choose one of the following approaches:

Tier A: The Champion (All targets met or exceeded)
- Tone: High energy, celebratory.
- Action: Congratulate them specifically on the metrics they crushed. Tell them they "won the day."

Tier B: The Grinder (Mixed results, mostly Wins or Near Misses)
- Tone: Encouraging and analytical.
- Action: Call out the specific wins first. For the misses, offer a specific time-management tip (e.g., "To hit that talk time, try blocking out your first hour solely for dial-time.").

Tier C: The Alert (Critical Misses on Key Metrics)
- Trigger: If the user scores a "Critical Miss" (<50%) on a Required Metric (like Sales or Quotes).
- Tone: Serious, supportive, solution-oriented.
- Action: Acknowledge the effort, but clearly state that the results are below standard. Suggest they schedule a brief check-in with leadership to build a plan so this doesn't happen again. Frame this not as punishment, but as "getting back on track."

Output Guidelines:
- Keep the response under 150 words.
- Use bullet points for readability.
- Address the user directly as "you."`;

// ========== Discrepancy Detection Types ==========
interface PerformanceMetric {
  metric: string;
  actual: number;
  target: number;
  passed: boolean;
  percentage: number;
  hasDiscrepancy?: boolean;
  trackedCount?: number | null;
  discrepancyNote?: string;
}

function logStructured(level: 'info' | 'warn' | 'error', eventType: string, data: Record<string, unknown>) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    event_type: eventType,
    function: 'send_submission_feedback',
    ...data
  };

  if (level === 'error') {
    console.error(`[${level.toUpperCase()}] ${eventType}:`, JSON.stringify(logEntry));
  } else {
    console.info(`[${level.toUpperCase()}] ${eventType}:`, JSON.stringify(logEntry));
  }
}

// ========== KPI Key Normalization (mirrors frontend logic) ==========
const QUOTED_ALIASES = ['quoted_households', 'quoted_count', 'policies_quoted', 'items_quoted', 'households_quoted'];
const SOLD_ALIASES = ['items_sold', 'sold_items', 'sold_count'];

function normalizeMetricKey(key: string): string {
  const lower = key?.toLowerCase() || '';
  if (QUOTED_ALIASES.includes(lower)) return 'quoted_households';
  if (SOLD_ALIASES.includes(lower)) return 'items_sold';
  return key;
}

// Get metric value from payload, trying aliases if primary key missing
function getMetricValueFromPayload(payload: Record<string, unknown>, kpiSlug: string, kpiKey: string): { value: number; resolvedFrom: string } {
  // 1. Try selectedKpiSlug directly
  if (payload[kpiSlug] !== undefined && payload[kpiSlug] !== null) {
    return { value: Number(payload[kpiSlug]) || 0, resolvedFrom: kpiSlug };
  }
  // 2. Try kpi.key directly
  if (kpiKey && payload[kpiKey] !== undefined && payload[kpiKey] !== null) {
    return { value: Number(payload[kpiKey]) || 0, resolvedFrom: kpiKey };
  }
  // 3. Try stripped version of kpi.key (removes preselected_kpi_N_ prefix)
  // This handles the mismatch where form submissions strip this prefix before saving
  const strippedKey = kpiKey?.replace(/^preselected_kpi_\d+_/, '') || '';
  if (strippedKey && strippedKey !== kpiKey && payload[strippedKey] !== undefined && payload[strippedKey] !== null) {
    return { value: Number(payload[strippedKey]) || 0, resolvedFrom: strippedKey };
  }
  // 4. Determine aliases based on normalized key
  const normalized = normalizeMetricKey(kpiSlug || kpiKey || strippedKey);
  let aliases: string[] = [];
  if (normalized === 'quoted_households') aliases = QUOTED_ALIASES;
  else if (normalized === 'items_sold') aliases = SOLD_ALIASES;
  else aliases = [kpiSlug, kpiKey, strippedKey].filter(Boolean);

  for (const alias of aliases) {
    if (payload[alias] !== undefined && payload[alias] !== null) {
      return { value: Number(payload[alias]) || 0, resolvedFrom: alias };
    }
  }
  return { value: 0, resolvedFrom: 'none' };
}

// Get target value, trying aliases if primary key missing
function getTargetValue(targetsMap: Record<string, number>, kpiSlug: string, kpiKey: string, kpiGoal?: number): { value: number; resolvedFrom: string } {
  // 1. If kpi has explicit goal, use it
  if (kpiGoal !== undefined && kpiGoal !== null && kpiGoal > 0) {
    return { value: kpiGoal, resolvedFrom: 'kpi.target.goal' };
  }
  // 2. Try selectedKpiSlug in targets
  if (targetsMap[kpiSlug] !== undefined) {
    return { value: targetsMap[kpiSlug], resolvedFrom: `targets.${kpiSlug}` };
  }
  // 3. Try kpi.key in targets
  if (kpiKey && targetsMap[kpiKey] !== undefined) {
    return { value: targetsMap[kpiKey], resolvedFrom: `targets.${kpiKey}` };
  }
  // 4. Try aliases
  const normalized = normalizeMetricKey(kpiSlug || kpiKey);
  let aliases: string[] = [];
  if (normalized === 'quoted_households') aliases = QUOTED_ALIASES;
  else if (normalized === 'items_sold') aliases = SOLD_ALIASES;
  else aliases = [kpiSlug, kpiKey].filter(Boolean);

  for (const alias of aliases) {
    if (targetsMap[alias] !== undefined) {
      return { value: targetsMap[alias], resolvedFrom: `targets.${alias}` };
    }
  }
  return { value: 0, resolvedFrom: 'none' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();

  try {
    const { submissionId } = await req.json();

    logStructured('info', 'feedback_start', {
      request_id: requestId,
      submission_id: submissionId
    });

    if (!submissionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'submissionId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Get submission
    const { data: submission, error: subError } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (subError || !submission) {
      logStructured('error', 'submission_not_found', { request_id: requestId, error: subError?.message });
      throw new Error('Submission not found');
    }

    logStructured('info', 'submission_loaded', { request_id: requestId, submission_id: submission.id });

    // 2. Get form template
    const { data: formTemplate, error: ftError } = await supabase
      .from('form_templates')
      .select('*')
      .eq('id', submission.form_template_id)
      .single();

    if (ftError || !formTemplate) {
      logStructured('error', 'form_template_not_found', { request_id: requestId, error: ftError?.message });
      throw new Error('Form template not found');
    }

    // 3. Get agency
    const { data: agency } = await supabase
      .from('agencies')
      .select('*')
      .eq('id', formTemplate.agency_id)
      .single();

    // Check if immediate email is enabled (default: true for backward compatibility)
    const settings = formTemplate.settings_json || {};
    const sendImmediate = settings.sendImmediateEmail !== false;

    if (!sendImmediate) {
      logStructured('info', 'email_disabled', { request_id: requestId });
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'Email disabled in settings' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Get team member (submitter)
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('*')
      .eq('id', submission.team_member_id)
      .single();

    // Check if there's a linked staff user with their own email (prioritize over team_members)
    let submitterEmail = teamMember?.email;
    const { data: staffUser } = await supabase
      .from('staff_users')
      .select('email')
      .eq('team_member_id', submission.team_member_id)
      .single();

    // Prefer staff_users email if exists and not placeholder
    if (staffUser?.email && !staffUser.email.includes('@staff.placeholder')) {
      submitterEmail = staffUser.email;
    }

    logStructured('info', 'team_member_loaded', {
      request_id: requestId,
      name: teamMember?.name,
      team_member_email: teamMember?.email,
      staff_user_email: staffUser?.email,
      submitter_email_used: submitterEmail
    });

    // 5. Get targets for this agency
    const { data: targets } = await supabase
      .from('targets')
      .select('metric_key, value_number')
      .eq('agency_id', formTemplate.agency_id);

    const targetsMap: Record<string, number> = {};
    targets?.forEach(t => {
      targetsMap[t.metric_key] = t.value_number;
    });

    logStructured('info', 'targets_loaded', { request_id: requestId, count: Object.keys(targetsMap).length });

    // ========== ADDED: Get metrics_daily for source of truth ==========
    const workDate = submission.work_date || submission.submission_date;

    const { data: metricsDaily } = await supabase
      .from('metrics_daily')
      .select('quoted_count, sold_items')
      .eq('team_member_id', submission.team_member_id)
      .eq('date', workDate)
      .eq('agency_id', formTemplate.agency_id)
      .single();

    logStructured('info', 'metrics_daily_loaded', {
      request_id: requestId,
      quoted_count: metricsDaily?.quoted_count,
      sold_items: metricsDaily?.sold_items
    });

    // ========== ADDED: Get tracked household count for discrepancy detection ==========
    // Use quoted_household_details for immediate email (same transaction, guaranteed committed)
    // This avoids sync lag issues with lqs_households
    const { count: trackedQuotedCount } = await supabase
      .from('quoted_household_details')
      .select('*', { count: 'exact', head: true })
      .eq('team_member_id', submission.team_member_id)
      .eq('agency_id', formTemplate.agency_id)
      .eq('work_date', workDate);

    // Also check lqs_households for dashboard-added entries
    const { count: lqsTrackedCount } = await supabase
      .from('lqs_households')
      .select('*', { count: 'exact', head: true })
      .eq('team_member_id', submission.team_member_id)
      .eq('agency_id', formTemplate.agency_id)
      .eq('first_quote_date', workDate)
      .in('status', ['quoted', 'sold']);

    // Use MAX of both sources to avoid false positives from sync timing
    const totalTrackedQuotes = Math.max(trackedQuotedCount || 0, lqsTrackedCount || 0);

    logStructured('info', 'tracked_counts_loaded', {
      request_id: requestId,
      quoted_household_details_count: trackedQuotedCount,
      lqs_households_count: lqsTrackedCount,
      total_tracked: totalTrackedQuotes
    });

    // ========== ADDED: Get agency's enabled KPIs from scorecard_rules ==========
    const formRole = formTemplate.role || 'Sales';
    const { data: scorecardRules } = await supabase
      .from('scorecard_rules')
      .select('selected_metrics')
      .eq('agency_id', formTemplate.agency_id)
      .eq('role', formRole)
      .single();

    const enabledKpis = new Set<string>(scorecardRules?.selected_metrics || []);

    logStructured('info', 'scorecard_rules_loaded', {
      request_id: requestId,
      role: formRole,
      enabled_kpis: Array.from(enabledKpis)
    });

    // 6. Build performance data with discrepancy detection
    const payload = submission.payload_json || {};
    const kpis = formTemplate.schema_json?.kpis || [];

    const performanceData: PerformanceMetric[] = [];

    for (const kpi of kpis) {
      const kpiSlug = kpi.selectedKpiSlug || '';
      const kpiKey = kpi.key || '';
      const normalizedKey = normalizeMetricKey(kpiSlug || kpiKey);

      let actual: number;
      let hasDiscrepancy = false;
      let trackedCount: number | null = null;
      let discrepancyNote: string | undefined;

      // For quoted_households: prefer metrics_daily (includes dashboard) over payload
      if (normalizedKey === 'quoted_households') {
        actual = metricsDaily?.quoted_count ?? 0;

        // Fall back to payload if metrics_daily is empty/missing
        if (actual === 0) {
          const payloadResult = getMetricValueFromPayload(payload, kpiSlug, kpiKey);
          actual = payloadResult.value;
        }

        // Discrepancy detection for quoted_households
        trackedCount = totalTrackedQuotes;
        if (actual > trackedCount) {
          hasDiscrepancy = true;
          const missing = actual - trackedCount;
          discrepancyNote = `${missing} household${missing > 1 ? 's' : ''} not tracked with details`;
        }

        logStructured('info', 'quoted_households_resolved', {
          request_id: requestId,
          actual,
          trackedCount,
          hasDiscrepancy,
          source: metricsDaily?.quoted_count ? 'metrics_daily' : 'payload'
        });

      } else if (normalizedKey === 'items_sold') {
        // For items_sold: prefer metrics_daily over payload
        actual = metricsDaily?.sold_items ?? 0;

        if (actual === 0) {
          const payloadResult = getMetricValueFromPayload(payload, kpiSlug, kpiKey);
          actual = payloadResult.value;
        }
        // Note: Could add lqs_sales discrepancy detection here in future

      } else {
        // All other KPIs: use payload directly (no aggregation source)
        const actualResult = getMetricValueFromPayload(payload, kpiSlug, kpiKey);
        actual = actualResult.value;
      }

      // Get target value (unchanged logic)
      const targetResult = getTargetValue(targetsMap, kpiSlug, kpiKey, kpi.target?.goal);
      const target = targetResult.value;
      const percentage = target > 0 ? Math.round((actual / target) * 100) : 100;

      logStructured('info', 'kpi_resolution', {
        request_id: requestId,
        label: kpi.label,
        selectedKpiSlug: kpiSlug,
        key: kpiKey,
        normalizedKey,
        actual,
        target,
        percentage,
        hasDiscrepancy,
        trackedCount
      });

      performanceData.push({
        metric: kpi.label,
        actual,
        target,
        passed: actual >= target,
        percentage,
        hasDiscrepancy,
        trackedCount,
        discrepancyNote
      });
    }

    // ========== ADDED: Include metrics not in form but enabled for agency ==========
    const quotedInForm = kpis.some((k: { selectedKpiSlug?: string; key?: string }) => {
      const normalized = normalizeMetricKey(k.selectedKpiSlug || k.key || '');
      return normalized === 'quoted_households';
    });

    // Check if quoted_households is an enabled KPI for this agency (check common key variations)
    const quotedEnabled = enabledKpis.has('quoted_households') ||
                          enabledKpis.has('quoted_count') ||
                          enabledKpis.has('policies_quoted') ||
                          enabledKpis.has('households_quoted');

    // Only add Quoted Households if it's enabled in the role's scorecard_rules.
    // Previously also checked targets table and tracked quotes, but targets are
    // agency-wide (not role-scoped), which caused Service team members to get
    // Quoted Households from Sales targets.
    const shouldAddQuoted = quotedEnabled;

    if (!quotedInForm && shouldAddQuoted) {
      // Use MAX of metrics_daily and lqs_households for actual value
      // Dashboard quotes go to lqs_households but may not be in metrics_daily yet
      const actualQuoted = Math.max(metricsDaily?.quoted_count ?? 0, totalTrackedQuotes);
      const quotedTarget = getTargetValue(targetsMap, 'quoted_households', 'quoted_count', undefined);
      const hasDiscrepancy = actualQuoted > totalTrackedQuotes;
      const missing = actualQuoted - totalTrackedQuotes;

      performanceData.push({
        metric: 'Quoted Households',
        actual: actualQuoted,
        target: quotedTarget.value,
        passed: quotedTarget.value > 0 ? actualQuoted >= quotedTarget.value : true,
        percentage: quotedTarget.value > 0 ? Math.round((actualQuoted / quotedTarget.value) * 100) : 100,
        hasDiscrepancy,
        trackedCount: totalTrackedQuotes,
        discrepancyNote: hasDiscrepancy ? `${missing} household${missing > 1 ? 's' : ''} not tracked with details` : undefined
      });

      logStructured('info', 'quoted_households_added_from_agency_kpis', {
        request_id: requestId,
        actual: actualQuoted,
        target: quotedTarget.value,
        trackedCount: totalTrackedQuotes,
        hasDiscrepancy,
        quotedEnabled,
        totalTrackedQuotes,
        enabled_via: Array.from(enabledKpis).filter(k =>
          ['quoted_households', 'quoted_count', 'policies_quoted', 'households_quoted'].includes(k)
        )
      });
    }

    // Same pattern for sold_items if not in form
    const soldInForm = kpis.some((k: { selectedKpiSlug?: string; key?: string }) => {
      const normalized = normalizeMetricKey(k.selectedKpiSlug || k.key || '');
      return normalized === 'items_sold';
    });

    // Check if items_sold is an enabled KPI for this agency
    const soldEnabled = enabledKpis.has('items_sold') ||
                        enabledKpis.has('sold_items') ||
                        enabledKpis.has('sold_count');

    // Add Items Sold if it's enabled for agency but not in form
    if (!soldInForm && soldEnabled) {
      const actualSold = metricsDaily?.sold_items ?? 0;
      const soldTarget = getTargetValue(targetsMap, 'items_sold', 'sold_items', undefined);

      performanceData.push({
        metric: 'Items Sold',
        actual: actualSold,
        target: soldTarget.value,
        passed: soldTarget.value > 0 ? actualSold >= soldTarget.value : true,
        percentage: soldTarget.value > 0 ? Math.round((actualSold / soldTarget.value) * 100) : 100,
        hasDiscrepancy: false,
        trackedCount: null
      });

      logStructured('info', 'items_sold_added_from_agency_kpis', {
        request_id: requestId,
        actual: actualSold,
        target: soldTarget.value
      });
    }

    logStructured('info', 'performance_calculated', {
      request_id: requestId,
      metrics_count: performanceData.length,
      passed_count: performanceData.filter(p => p.passed).length,
      discrepancy_count: performanceData.filter(p => p.hasDiscrepancy).length
    });

    // 7. Build prompt for OpenAI
    const statsText = performanceData
      .map(p => `- ${p.metric}: ${p.actual} / ${p.target} (${p.percentage}%)`)
      .join('\n');

    const userPrompt = `Context for Today's Analysis:
User Name: ${teamMember?.name || 'Team Member'}
Role: ${formTemplate.role || 'Sales'}
Date: ${submission.work_date || submission.submission_date}

Daily Stats Data:
${statsText}

Provide your coaching feedback based on these results.`;

    // 8. Call OpenAI API (with graceful fallback)
    let aiFeedback = '';
    try {
      logStructured('info', 'openai_calling', { request_id: requestId });

      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      const openaiData = await openaiResponse.json();

      if (!openaiResponse.ok) {
        logStructured('warn', 'openai_error_response', {
          request_id: requestId,
          status: openaiResponse.status,
          error: openaiData
        });
      } else {
        aiFeedback = openaiData.choices?.[0]?.message?.content || '';
        logStructured('info', 'openai_success', {
          request_id: requestId,
          feedback_length: aiFeedback.length
        });
      }
    } catch (aiError) {
      logStructured('warn', 'openai_exception', {
        request_id: requestId,
        error: aiError instanceof Error ? aiError.message : String(aiError)
      });
      // Continue without AI feedback - email will still be sent with stats
    }

    // 9. Build recipient list: Submitter + Agency Owner + Additional Recipients (from settings)
    const recipientSet = new Set<string>();

    // Submitter email (use staff_users email if available, else team_members email)
    if (submitterEmail && !submitterEmail.includes('@staff.placeholder')) {
      recipientSet.add(submitterEmail.toLowerCase());
    }

    // Agency owner email (from agencies.agency_email)
    if (agency?.agency_email) {
      recipientSet.add(agency.agency_email.toLowerCase());
    }

    // Additional recipients from settings
    const additionalIds = settings.additionalImmediateRecipients || [];
    if (additionalIds.length > 0) {
      const { data: additionalMembers } = await supabase
        .from('team_members')
        .select('email')
        .in('id', additionalIds);

      additionalMembers?.forEach(m => {
        if (m.email && !m.email.includes('@staff.placeholder')) {
          recipientSet.add(m.email.toLowerCase());
        }
      });

      // Also check staff_users for real emails (team_members may have @staff.placeholder)
      const { data: additionalStaff } = await supabase
        .from('staff_users')
        .select('email, team_member_id')
        .in('team_member_id', additionalIds)
        .eq('is_active', true)
        .not('email', 'is', null);

      additionalStaff?.forEach(s => {
        if (s.email && !s.email.includes('@staff.placeholder')) {
          recipientSet.add(s.email.toLowerCase());
        }
      });
    }

    const recipients = Array.from(recipientSet);

    logStructured('info', 'recipients_resolved', { request_id: requestId, count: recipients.length, recipients });

    if (recipients.length === 0) {
      logStructured('info', 'no_recipients', { request_id: requestId });
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'No valid recipients' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 10. Build HTML email using shared template
    const passedCount = performanceData.filter(p => p.passed).length;
    const totalCount = performanceData.length;
    const passRate = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

    // Import shared email template
    const { BRAND, buildEmailHtml, EmailComponents } = await import('../_shared/email-template.ts');

    const bodyContent = `
      ${EmailComponents.summaryBox(`Summary: ${passedCount} of ${totalCount} targets met (${passRate}%)`)}
      ${EmailComponents.statsTable(performanceData)}
      ${EmailComponents.aiFeedback(aiFeedback)}
    `;

    const emailHtml = buildEmailHtml({
      title: '📊 Daily Performance Report',
      subtitle: `${teamMember?.name || 'Team Member'} • ${formTemplate.role || 'Sales'} • ${submission.work_date || submission.submission_date}`,
      bodyContent,
      footerAgencyName: agency?.name,
    });

    // 11. Send email via Resend batch API (individual email per recipient for proper tracking)
    const subject = `📊 Daily Report: ${passedCount}/${totalCount} targets met - ${teamMember?.name || 'Team Member'}`;
    const emailBatch = recipients.map(email => ({
      from: BRAND.fromEmail,
      to: email,
      subject,
      html: emailHtml,
    }));

    logStructured('info', 'sending_email', { request_id: requestId, recipient_count: recipients.length, recipients });

    const emailResponse = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBatch),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      logStructured('error', 'resend_error', {
        request_id: requestId,
        status: emailResponse.status,
        error: emailResult
      });
      throw new Error(`Email failed: ${JSON.stringify(emailResult)}`);
    }

    logStructured('info', 'feedback_complete', {
      request_id: requestId,
      email_ids: emailResult?.data?.map((e: { id: string }) => e.id),
      recipients,
      passed_count: passedCount,
      total_count: totalCount,
      has_ai_feedback: !!aiFeedback
    });

    return new Response(
      JSON.stringify({
        success: true,
        emailIds: emailResult?.data?.map((e: { id: string }) => e.id),
        recipients,
        passedCount,
        totalCount,
        passRate,
        hasAiFeedback: !!aiFeedback
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logStructured('error', 'feedback_failed', {
      request_id: requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
