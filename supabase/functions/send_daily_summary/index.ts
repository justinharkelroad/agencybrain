import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { BRAND, buildEmailHtml, EmailComponents } from '../_shared/email-template.ts';
import { shouldSendDailySummary, getDayName } from '../_shared/business-days.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SubmissionSummary {
  teamMemberId: string;
  teamMemberName: string;
  submitted: boolean;
  passRate: number;
  kpis: Array<{
    metric: string;
    actual: number;
    target: number;
    passed: boolean;
    hasDiscrepancy?: boolean;
    trackedCount?: number | null;
  }>;
}

function logStructured(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ...data, timestamp: new Date().toISOString() }));
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
function getMetricValueFromPayload(payload: Record<string, unknown>, kpiSlug: string, kpiKey: string): number {
  // 1. Try selectedKpiSlug directly
  if (payload[kpiSlug] !== undefined && payload[kpiSlug] !== null) {
    return Number(payload[kpiSlug]) || 0;
  }
  // 2. Try kpi.key directly
  if (kpiKey && payload[kpiKey] !== undefined && payload[kpiKey] !== null) {
    return Number(payload[kpiKey]) || 0;
  }
  // 3. Try stripped version of kpi.key (removes preselected_kpi_N_ prefix)
  // This handles the mismatch where form submissions strip this prefix before saving
  const strippedKey = kpiKey?.replace(/^preselected_kpi_\d+_/, '') || '';
  if (strippedKey && strippedKey !== kpiKey && payload[strippedKey] !== undefined && payload[strippedKey] !== null) {
    return Number(payload[strippedKey]) || 0;
  }
  // 4. Determine aliases based on normalized key
  const normalized = normalizeMetricKey(kpiSlug || kpiKey || strippedKey);
  let aliases: string[] = [];
  if (normalized === 'quoted_households') aliases = QUOTED_ALIASES;
  else if (normalized === 'items_sold') aliases = SOLD_ALIASES;
  else aliases = [kpiSlug, kpiKey, strippedKey].filter(Boolean);

  for (const alias of aliases) {
    if (payload[alias] !== undefined && payload[alias] !== null) {
      return Number(payload[alias]) || 0;
    }
  }
  return 0;
}

// Get target value, trying aliases if primary key missing
function getTargetValue(targetsMap: Record<string, number>, kpiSlug: string, kpiKey: string, kpiGoal?: number): number {
  // 1. If kpi has explicit goal, use it
  if (kpiGoal !== undefined && kpiGoal !== null && kpiGoal > 0) {
    return kpiGoal;
  }
  // 2. Try selectedKpiSlug in targets
  if (targetsMap[kpiSlug] !== undefined) {
    return targetsMap[kpiSlug];
  }
  // 3. Try kpi.key in targets
  if (kpiKey && targetsMap[kpiKey] !== undefined) {
    return targetsMap[kpiKey];
  }
  // 4. Try aliases
  const normalized = normalizeMetricKey(kpiSlug || kpiKey);
  let aliases: string[] = [];
  if (normalized === 'quoted_households') aliases = QUOTED_ALIASES;
  else if (normalized === 'items_sold') aliases = SOLD_ALIASES;
  else aliases = [kpiSlug, kpiKey].filter(Boolean);

  for (const alias of aliases) {
    if (targetsMap[alias] !== undefined) {
      return targetsMap[alias];
    }
  }
  return 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agencyId } = await req.json().catch(() => ({}));

    // Check if today is a valid day to send summary
    // Skip Sunday (reports on Saturday) and Monday (reports on Sunday)
    const now = new Date();
    if (!shouldSendDailySummary(now)) {
      const dayName = getDayName(now);
      logStructured('daily_summary_skipped', {
        reason: 'non_business_day_report',
        today: dayName,
        message: `Skipping daily summary - yesterday was not a business day (weekend)`
      });

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

    logStructured('daily_summary_start', { agencyId: agencyId || 'ALL' });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get agencies to process
    let agenciesQuery = supabase.from('agencies').select('*');
    if (agencyId) {
      agenciesQuery = agenciesQuery.eq('id', agencyId);
    }
    const { data: agencies, error: agenciesError } = await agenciesQuery;

    if (agenciesError) {
      logStructured('agencies_fetch_error', { error: agenciesError.message });
      throw new Error(`Failed to fetch agencies: ${agenciesError.message}`);
    }

    const results: Array<{
      agency: string;
      form: string;
      submittedCount: number;
      totalCount: number;
      recipients: number;
      emailId?: string;
      error?: string;
    }> = [];

    for (const agency of agencies || []) {
      logStructured('processing_agency', { agencyId: agency.id, agencyName: agency.name });

      // Get forms with daily summary enabled
      const { data: forms, error: formsError } = await supabase
        .from('form_templates')
        .select('*')
        .eq('agency_id', agency.id)
        .eq('is_active', true);

      if (formsError) {
        logStructured('forms_fetch_error', { agencyId: agency.id, error: formsError.message });
        continue;
      }

      for (const form of forms || []) {
        const settings = form.settings_json || {};

        // Skip if daily summary not explicitly enabled (explicit opt-in only)
        if (settings.sendDailySummary !== true) {
          logStructured('skipping_form', { formId: form.id, formName: form.name, reason: 'daily_summary_disabled' });
          continue;
        }

        logStructured('processing_form', { formId: form.id, formName: form.name, role: form.role });

        // Calculate yesterday's date
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        logStructured('date_range', { yesterday: yesterdayStr });

        // Get team members for this form's role (include Hybrid and Manager)
        // Only include members with include_in_metrics = true for tracking
        const { data: teamMembers, error: tmError } = await supabase
          .from('team_members')
          .select('id, name, email, role')
          .eq('agency_id', agency.id)
          .eq('status', 'active')
          .eq('include_in_metrics', true)
          .or(`role.eq.${form.role},role.eq.Hybrid,role.eq.Manager`);

        if (tmError) {
          logStructured('team_members_fetch_error', { formId: form.id, error: tmError.message });
          continue;
        }

        // Get yesterday's submissions for this form
        const { data: submissions, error: subError } = await supabase
          .from('submissions')
          .select('*')
          .eq('form_template_id', form.id)
          .eq('work_date', yesterdayStr)
          .eq('final', true);

        if (subError) {
          logStructured('submissions_fetch_error', { formId: form.id, error: subError.message });
          continue;
        }

        // Get targets
        const { data: targets } = await supabase
          .from('targets')
          .select('metric_key, value_number')
          .eq('agency_id', agency.id);

        const targetsMap: Record<string, number> = {};
        targets?.forEach(t => { targetsMap[t.metric_key] = t.value_number; });

        // Build submission map
        const submissionsByMember = new Map();
        submissions?.forEach(s => {
          submissionsByMember.set(s.team_member_id, s);
        });

        // ========== ADDED: Batch query for tracked household counts ==========
        // For daily summary, use lqs_households (end of day, all syncs complete)
        const { data: trackedHouseholds } = await supabase
          .from('lqs_households')
          .select('team_member_id')
          .eq('agency_id', agency.id)
          .eq('first_quote_date', yesterdayStr)
          .in('status', ['quoted', 'sold']);

        // Build map: team_member_id -> tracked count
        const trackedCountMap: Record<string, number> = {};
        trackedHouseholds?.forEach(row => {
          trackedCountMap[row.team_member_id] = (trackedCountMap[row.team_member_id] || 0) + 1;
        });

        logStructured('tracked_counts_loaded', {
          formId: form.id,
          trackedMembersCount: Object.keys(trackedCountMap).length
        });

        // ========== ADDED: Batch query metrics_daily ==========
        const { data: metricsData } = await supabase
          .from('metrics_daily')
          .select('team_member_id, quoted_count, sold_items')
          .eq('agency_id', agency.id)
          .eq('date', yesterdayStr);

        const metricsMap: Record<string, { quoted_count: number; sold_items: number }> = {};
        metricsData?.forEach(row => {
          metricsMap[row.team_member_id] = {
            quoted_count: row.quoted_count || 0,
            sold_items: row.sold_items || 0
          };
        });

        logStructured('metrics_daily_loaded', {
          formId: form.id,
          metricsCount: Object.keys(metricsMap).length
        });

        // ========== ADDED: Get agency's enabled KPIs from scorecard_rules ==========
        const formRole = form.role || 'Sales';
        const { data: scorecardRules } = await supabase
          .from('scorecard_rules')
          .select('selected_metrics')
          .eq('agency_id', agency.id)
          .eq('role', formRole)
          .single();

        const enabledKpis = new Set<string>(scorecardRules?.selected_metrics || []);

        logStructured('scorecard_rules_loaded', {
          formId: form.id,
          role: formRole,
          enabled_kpis: Array.from(enabledKpis)
        });

        // Build summary for each team member
        const summaries: SubmissionSummary[] = [];
        const kpis = form.schema_json?.kpis || [];

        for (const member of teamMembers || []) {
          const submission = submissionsByMember.get(member.id);
          const memberMetrics = metricsMap[member.id];
          const trackedQuotes = trackedCountMap[member.id] || 0;

          // Include member if they have a submission OR metrics_daily data (dashboard entries)
          if (submission || memberMetrics) {
            const payload = submission?.payload_json || {};

            const memberKpis: Array<{
              metric: string;
              actual: number;
              target: number;
              passed: boolean;
              hasDiscrepancy?: boolean;
              trackedCount?: number | null;
            }> = kpis.map((kpi: { selectedKpiSlug?: string; key?: string; label?: string; target?: { goal?: number } }) => {
              const kpiSlug = kpi.selectedKpiSlug || '';
              const kpiKey = kpi.key || '';
              const normalizedKey = normalizeMetricKey(kpiSlug || kpiKey);

              let actual: number;
              let hasDiscrepancy = false;
              let trackedCount: number | null = null;

              // For quoted_households: prefer metrics_daily
              if (normalizedKey === 'quoted_households') {
                actual = memberMetrics?.quoted_count ?? getMetricValueFromPayload(payload, kpiSlug, kpiKey);
                trackedCount = trackedQuotes;
                hasDiscrepancy = actual > trackedCount;
              } else if (normalizedKey === 'items_sold') {
                actual = memberMetrics?.sold_items ?? getMetricValueFromPayload(payload, kpiSlug, kpiKey);
              } else {
                actual = getMetricValueFromPayload(payload, kpiSlug, kpiKey);
              }

              const target = getTargetValue(targetsMap, kpiSlug, kpiKey, kpi.target?.goal);

              return {
                metric: kpi.label || kpi.selectedKpiSlug || kpi.key || 'Unknown',
                actual,
                target,
                passed: actual >= target,
                hasDiscrepancy,
                trackedCount
              };
            });

            // ========== ADDED: Include metrics not in form but enabled for agency ==========
            const quotedInForm = kpis.some((k: { selectedKpiSlug?: string; key?: string }) => {
              const normalized = normalizeMetricKey(k.selectedKpiSlug || k.key || '');
              return normalized === 'quoted_households';
            });

            // Check if quoted_households is an enabled KPI for this agency
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
              const actualQuoted = Math.max(memberMetrics?.quoted_count ?? 0, trackedQuotes);
              const quotedTarget = getTargetValue(targetsMap, 'quoted_households', 'quoted_count', undefined);
              const hasDiscrepancy = actualQuoted > trackedQuotes;

              memberKpis.push({
                metric: 'Quoted Households',
                actual: actualQuoted,
                target: quotedTarget,
                passed: quotedTarget > 0 ? actualQuoted >= quotedTarget : true,
                hasDiscrepancy,
                trackedCount: trackedQuotes
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
              const actualSold = memberMetrics?.sold_items ?? 0;
              const soldTarget = getTargetValue(targetsMap, 'items_sold', 'sold_items', undefined);

              memberKpis.push({
                metric: 'Items Sold',
                actual: actualSold,
                target: soldTarget,
                passed: soldTarget > 0 ? actualSold >= soldTarget : true,
                hasDiscrepancy: false,
                trackedCount: null
              });
            }

            const passedCount = memberKpis.filter((k: { passed: boolean }) => k.passed).length;
            const passRate = memberKpis.length > 0 ? Math.round((passedCount / memberKpis.length) * 100) : 0;

            summaries.push({
              teamMemberId: member.id,
              teamMemberName: member.name,
              submitted: !!submission, // Track whether they actually submitted a form
              passRate,
              kpis: memberKpis,
            });
          } else {
            summaries.push({
              teamMemberId: member.id,
              teamMemberName: member.name,
              submitted: false,
              passRate: 0,
              kpis: [],
            });
          }
        }

        // Calculate totals
        const submittedCount = summaries.filter(s => s.submitted).length;
        const totalCount = summaries.length;

        if (totalCount === 0) {
          logStructured('no_team_members', { formId: form.id });
          continue;
        }

        const avgPassRate = submittedCount > 0
          ? Math.round(summaries.filter(s => s.submitted).reduce((sum, s) => sum + s.passRate, 0) / submittedCount)
          : 0;

        // Build recipient list based on settings
        const recipients: string[] = [];
        const recipientSetting = settings.dailySummaryRecipients || 'all_team';

        if (recipientSetting === 'owner_only') {
          if (agency.agency_email) recipients.push(agency.agency_email);
        } else if (recipientSetting === 'custom') {
          const customIds = settings.customSummaryRecipients || [];
          if (customIds.length > 0) {
            const { data: customMembers } = await supabase
              .from('team_members')
              .select('email')
              .in('id', customIds);
            customMembers?.forEach(m => {
              if (m.email && !m.email.includes('@staff.placeholder')) {
                recipients.push(m.email);
              }
            });
          }
        } else {
          // sales_team, service_team, or all_team
          let roleFilter: string | null = form.role;
          if (recipientSetting === 'all_team') {
            roleFilter = null;
          } else if (recipientSetting === 'sales_team') {
            roleFilter = 'Sales';
          } else if (recipientSetting === 'service_team') {
            roleFilter = 'Service';
          }

          let membersQuery = supabase
            .from('team_members')
            .select('email')
            .eq('agency_id', agency.id)
            .eq('status', 'active');

          if (roleFilter) {
            membersQuery = membersQuery.or(`role.eq.${roleFilter},role.eq.Hybrid,role.eq.Manager`);
          }

          const { data: roleMembers } = await membersQuery;
          roleMembers?.forEach(m => {
            if (m.email && !m.email.includes('@staff.placeholder')) {
              recipients.push(m.email);
            }
          });
        }

        // Always include agency owner
        if (agency.agency_email && !recipients.includes(agency.agency_email)) {
          recipients.push(agency.agency_email);
        }

        // Deduplicate
        const uniqueRecipients = [...new Set(recipients)];

        logStructured('recipients_resolved', { formId: form.id, recipientCount: uniqueRecipients.length, setting: recipientSetting });

        if (uniqueRecipients.length === 0) {
          logStructured('no_recipients', { formId: form.id });
          continue;
        }

        // Check for any discrepancies across team
        const hasAnyDiscrepancy = summaries.some(s =>
          s.kpis.some(k => k.hasDiscrepancy)
        );

        // Build email HTML
        const submittedList = summaries
          .filter(s => s.submitted || s.kpis.length > 0) // Include dashboard-only entries
          .sort((a, b) => b.passRate - a.passRate)
          .map(s => {
            const hasDiscrepancy = s.kpis.some(k => k.hasDiscrepancy);
            const discrepancyMarker = hasDiscrepancy ? '*' : '';
            const statusIcon = s.submitted ? '✅' : '📊'; // 📊 for dashboard-only
            return `<tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${statusIcon} ${s.teamMemberName}${discrepancyMarker}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center; color: ${s.passRate >= 75 ? '#22c55e' : s.passRate >= 50 ? '#eab308' : '#ef4444'}; font-weight: 600;">${s.passRate}%</td>
          </tr>`;
          })
          .join('');

        const missedList = summaries
          .filter(s => !s.submitted && s.kpis.length === 0) // Only show truly missed (no submission, no dashboard data)
          .map(s => `<li style="color: #ef4444; margin-bottom: 4px;">\u274C ${s.teamMemberName}</li>`)
          .join('');

        // Calculate team KPI totals
        const kpiTotals: Record<string, { total: number; target: number; count: number; hasDiscrepancy: boolean }> = {};
        summaries.filter(s => s.submitted || s.kpis.length > 0).forEach(s => {
          s.kpis.forEach(k => {
            if (!kpiTotals[k.metric]) {
              kpiTotals[k.metric] = { total: 0, target: k.target, count: 0, hasDiscrepancy: false };
            }
            kpiTotals[k.metric].total += k.actual;
            kpiTotals[k.metric].count++;
            if (k.hasDiscrepancy) {
              kpiTotals[k.metric].hasDiscrepancy = true;
            }
          });
        });

        const kpiTotalsHtml = Object.entries(kpiTotals)
          .map(([metric, data]) => {
            const teamTarget = data.target * data.count;
            const passed = data.total >= teamTarget;
            const pct = teamTarget > 0 ? Math.round((data.total / teamTarget) * 100) : 0;
            const discrepancyMarker = data.hasDiscrepancy ? '*' : '';
            return `<tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${metric}${discrepancyMarker}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${data.total}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${teamTarget}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center; color: ${passed ? '#22c55e' : '#ef4444'}; font-weight: 600;">${passed ? '✅' : '❌'} ${pct}%</td>
            </tr>`;
          })
          .join('');

        // Discrepancy footnote for daily summary
        const discrepancyFootnote = hasAnyDiscrepancy ? `
          <div style="margin-top: 16px; padding: 12px; background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px;">
            <p style="margin: 0; font-size: 12px; color: #92400e;">
              <strong>*</strong> Some reported values exceed tracked household details. Review dashboard for accuracy.
            </p>
          </div>
        ` : '';

        const bodyContent = `
          ${EmailComponents.summaryBox(`\uD83D\uDCCA ${submittedCount} of ${totalCount} team members submitted (${avgPassRate}% avg pass rate)`)}

          <h3 style="margin: 24px 0 12px 0; color: ${BRAND.colors.primary};">Team Submissions</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="background: #f3f4f6; padding: 10px; text-align: left; font-weight: 600;">Team Member</th>
                <th style="background: #f3f4f6; padding: 10px; text-align: center; font-weight: 600;">Pass Rate</th>
              </tr>
            </thead>
            <tbody>
              ${submittedList || '<tr><td colspan="2" style="padding: 12px; color: #6b7280; text-align: center;">No submissions yesterday</td></tr>'}
            </tbody>
          </table>

          ${missedList ? `
            <h3 style="margin: 24px 0 12px 0; color: #ef4444;">\u26A0\uFE0F Did Not Submit</h3>
            <ul style="margin: 0; padding-left: 20px;">
              ${missedList}
            </ul>
          ` : ''}

          ${Object.keys(kpiTotals).length > 0 ? `
            <h3 style="margin: 24px 0 12px 0; color: ${BRAND.colors.primary};">Team KPI Totals</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr>
                  <th style="background: #f3f4f6; padding: 10px; text-align: left; font-weight: 600;">Metric</th>
                  <th style="background: #f3f4f6; padding: 10px; text-align: center; font-weight: 600;">Team Total</th>
                  <th style="background: #f3f4f6; padding: 10px; text-align: center; font-weight: 600;">Team Target</th>
                  <th style="background: #f3f4f6; padding: 10px; text-align: center; font-weight: 600;">Result</th>
                </tr>
              </thead>
              <tbody>
                ${kpiTotalsHtml}
              </tbody>
            </table>
          ` : ''}

          ${discrepancyFootnote}
        `;

        const emailHtml = buildEmailHtml({
          title: `\uD83D\uDCC8 Daily Team Summary`,
          subtitle: `${form.name} \u2022 ${form.role} \u2022 ${yesterdayStr}`,
          bodyContent,
          footerAgencyName: agency.name,
        });

        // Send email
        try {
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: BRAND.fromEmail,
              to: uniqueRecipients,
              subject: `\uD83D\uDCC8 Daily Summary: ${submittedCount}/${totalCount} submitted - ${form.name}`,
              html: emailHtml,
            }),
          });

          const emailResult = await emailResponse.json();

          if (!emailResponse.ok) {
            logStructured('email_send_error', { formId: form.id, error: emailResult });
            results.push({
              agency: agency.name,
              form: form.name,
              submittedCount,
              totalCount,
              recipients: uniqueRecipients.length,
              error: emailResult?.message || 'Email send failed',
            });
          } else {
            logStructured('email_sent', { formId: form.id, emailId: emailResult.id, recipients: uniqueRecipients.length });
            results.push({
              agency: agency.name,
              form: form.name,
              submittedCount,
              totalCount,
              recipients: uniqueRecipients.length,
              emailId: emailResult.id,
            });
          }
        } catch (emailError) {
          logStructured('email_exception', { formId: form.id, error: String(emailError) });
          results.push({
            agency: agency.name,
            form: form.name,
            submittedCount,
            totalCount,
            recipients: uniqueRecipients.length,
            error: String(emailError),
          });
        }
      }
    }

    logStructured('daily_summary_complete', { resultsCount: results.length });

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logStructured('daily_summary_error', { error: String(error) });
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
