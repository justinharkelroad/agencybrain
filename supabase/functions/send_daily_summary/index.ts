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
  }>;
}

interface SnapshotRow {
  team_member_id: string;
  metric_payload: Record<string, unknown> | null;
  target_payload: Record<string, unknown> | null;
  source_payload: Record<string, unknown> | null;
  status_payload: Record<string, unknown> | null;
}

function logStructured(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ...data, timestamp: new Date().toISOString() }));
}

function getLocalHour(timezone: string): number {
  try {
    const hour = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(new Date());
    return parseInt(hour, 10);
  } catch {
    const fallbackHour = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false,
    }).format(new Date());
    return parseInt(fallbackHour, 10);
  }
}

const QUOTED_ALIASES = ['quoted_households', 'quoted_count', 'policies_quoted', 'items_quoted', 'households_quoted'];
const SOLD_ALIASES = ['items_sold', 'sold_items', 'sold_count'];

function normalizeMetricKey(key: string): string {
  const lower = key?.toLowerCase() || '';
  if (QUOTED_ALIASES.includes(lower)) return 'quoted_households';
  if (SOLD_ALIASES.includes(lower)) return 'items_sold';
  return key;
}

function getMetricValueFromPayload(payload: Record<string, unknown>, kpiSlug: string, kpiKey: string): number {
  if (payload[kpiSlug] !== undefined && payload[kpiSlug] !== null) {
    return Number(payload[kpiSlug]) || 0;
  }
  if (kpiKey && payload[kpiKey] !== undefined && payload[kpiKey] !== null) {
    return Number(payload[kpiKey]) || 0;
  }
  const strippedKey = kpiKey?.replace(/^preselected_kpi_\d+_/, '') || '';
  if (strippedKey && strippedKey !== kpiKey && payload[strippedKey] !== undefined && payload[strippedKey] !== null) {
    return Number(payload[strippedKey]) || 0;
  }

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

function getTargetValue(targetsMap: Record<string, number>, kpiSlug: string, kpiKey: string, kpiGoal?: number): number {
  if (kpiGoal !== undefined && kpiGoal !== null && kpiGoal > 0) {
    return kpiGoal;
  }
  if (targetsMap[kpiSlug] !== undefined) {
    return targetsMap[kpiSlug];
  }
  if (kpiKey && targetsMap[kpiKey] !== undefined) {
    return targetsMap[kpiKey];
  }

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

async function resolveLockedSnapshotId(
  supabase: ReturnType<typeof createClient>,
  agencyId: string,
  snapshotDate: string,
): Promise<{ id: string; version: number } | null> {
  const { data: existing, error: existingError } = await supabase
    .from('metrics_daily_snapshots')
    .select('id, version')
    .eq('agency_id', agencyId)
    .eq('snapshot_date', snapshotDate)
    .eq('status', 'locked')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(`snapshot_lookup_failed: ${existingError.message}`);
  }

  if (existing) {
    return existing;
  }

  const { error: createError } = await supabase.rpc('create_metrics_daily_snapshot', {
    p_agency_id: agencyId,
    p_snapshot_date: snapshotDate,
    p_lock_type: 'hard_lock',
    p_created_by: null,
  });

  if (createError) {
    throw new Error(`snapshot_create_failed: ${createError.message}`);
  }

  const { data: created, error: createdError } = await supabase
    .from('metrics_daily_snapshots')
    .select('id, version')
    .eq('agency_id', agencyId)
    .eq('snapshot_date', snapshotDate)
    .eq('status', 'locked')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (createdError) {
    throw new Error(`snapshot_post_create_lookup_failed: ${createdError.message}`);
  }

  return created;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agencyId, forceSend } = await req.json().catch(() => ({}));

    const now = new Date();
    if (!shouldSendDailySummary(now)) {
      const dayName = getDayName(now);
      logStructured('daily_summary_skipped', {
        reason: 'non_business_day_report',
        today: dayName,
        message: 'Skipping daily summary - yesterday was not a business day (weekend)'
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

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    logStructured('daily_summary_start', { agencyId: agencyId || 'ALL', snapshotDate: yesterdayStr });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

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
      emailIds?: string[];
      error?: string;
    }> = [];

    for (const agency of agencies || []) {
      logStructured('processing_agency', { agencyId: agency.id, agencyName: agency.name });

      const timezone = agency.timezone || 'America/New_York';
      const localHour = getLocalHour(timezone);

      if (!forceSend && localHour !== 10) {
        logStructured('skipping_agency_for_hour', {
          agencyId: agency.id,
          agencyName: agency.name,
          timezone,
          localHour,
          requiredHour: 10,
        });
        continue;
      }

      let snapshotId: string | null = null;
      let snapshotVersion = 0;
      const snapshotByMember = new Map<string, SnapshotRow>();

      try {
        const snapshot = await resolveLockedSnapshotId(supabase, agency.id, yesterdayStr);
        if (snapshot) {
          snapshotId = snapshot.id;
          snapshotVersion = snapshot.version;

          const { data: snapshotRows, error: snapshotRowsError } = await supabase
            .from('metrics_daily_snapshot_rows')
            .select('team_member_id, metric_payload, target_payload, source_payload, status_payload')
            .eq('snapshot_id', snapshotId);

          if (snapshotRowsError) {
            throw new Error(`snapshot_rows_fetch_failed: ${snapshotRowsError.message}`);
          }

          (snapshotRows || []).forEach((row) => {
            snapshotByMember.set(row.team_member_id, row as SnapshotRow);
          });

          logStructured('snapshot_loaded', {
            agencyId: agency.id,
            snapshotId,
            snapshotVersion,
            rowCount: snapshotByMember.size,
          });
        }
      } catch (snapshotError) {
        logStructured('snapshot_error', {
          agencyId: agency.id,
          date: yesterdayStr,
          error: String(snapshotError),
        });
      }

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
        if (settings.sendDailySummary !== true) {
          logStructured('skipping_form', { formId: form.id, formName: form.name, reason: 'daily_summary_disabled' });
          continue;
        }

        logStructured('processing_form', {
          formId: form.id,
          formName: form.name,
          role: form.role,
          snapshotVersion,
        });

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

        const { data: targets } = await supabase
          .from('targets')
          .select('metric_key, value_number')
          .eq('agency_id', agency.id);

        const targetsMap: Record<string, number> = {};
        targets?.forEach(t => { targetsMap[t.metric_key] = t.value_number; });

        const formRole = form.role || 'Sales';
        const { data: scorecardRules } = await supabase
          .from('scorecard_rules')
          .select('selected_metrics')
          .eq('agency_id', agency.id)
          .eq('role', formRole)
          .single();

        const enabledKpis = new Set<string>(scorecardRules?.selected_metrics || []);
        const summaries: SubmissionSummary[] = [];
        const kpis = form.schema_json?.kpis || [];
        const submittedTeamMemberIds = new Set<string>();

        if ((teamMembers || []).length > 0) {
          const memberIds = (teamMembers || []).map((member) => member.id);
          const { data: submittedRows, error: submittedRowsError } = await supabase
            .from('metrics_daily')
            .select('team_member_id')
            .eq('agency_id', agency.id)
            .eq('date', yesterdayStr)
            .in('team_member_id', memberIds);

          if (submittedRowsError) {
            logStructured('submitted_rows_fetch_error', {
              agencyId: agency.id,
              formId: form.id,
              date: yesterdayStr,
              error: submittedRowsError.message,
            });
          } else {
            (submittedRows || []).forEach((row) => {
              if (row.team_member_id) {
                submittedTeamMemberIds.add(row.team_member_id);
              }
            });
          }
        }

        for (const member of teamMembers || []) {
          const snapshotRow = snapshotByMember.get(member.id);
          const didSubmit = submittedTeamMemberIds.has(member.id);

          if (snapshotRow) {
            const metricPayload = (snapshotRow.metric_payload || {}) as Record<string, unknown>;
            const targetPayload = (snapshotRow.target_payload || {}) as Record<string, unknown>;

            const memberKpis: Array<{ metric: string; actual: number; target: number; passed: boolean }> =
              kpis.map((kpi: { selectedKpiSlug?: string; key?: string; label?: string; target?: { goal?: number } }) => {
                const kpiSlug = kpi.selectedKpiSlug || '';
                const kpiKey = kpi.key || '';
                const normalizedKey = normalizeMetricKey(kpiSlug || kpiKey);

                const actual = getMetricValueFromPayload(metricPayload, kpiSlug, kpiKey);
                const payloadTarget = Number(targetPayload[normalizedKey]);
                const fallbackTarget = getTargetValue(targetsMap, kpiSlug, kpiKey, kpi.target?.goal);
                const target = Number.isFinite(payloadTarget) && payloadTarget > 0 ? payloadTarget : fallbackTarget;

                return {
                  metric: kpi.label || kpi.selectedKpiSlug || kpi.key || 'Unknown',
                  actual,
                  target,
                  passed: target > 0 ? actual >= target : true,
                };
              });

            const quotedInForm = kpis.some((k: { selectedKpiSlug?: string; key?: string }) => {
              const normalized = normalizeMetricKey(k.selectedKpiSlug || k.key || '');
              return normalized === 'quoted_households';
            });

            const quotedEnabled = enabledKpis.has('quoted_households') ||
                                  enabledKpis.has('quoted_count') ||
                                  enabledKpis.has('policies_quoted') ||
                                  enabledKpis.has('households_quoted');

            if (!quotedInForm && quotedEnabled) {
              const actualQuoted = Number(metricPayload.quoted_households) || 0;
              const quotedTarget = Number(targetPayload.quoted_households)
                || getTargetValue(targetsMap, 'quoted_households', 'quoted_count', undefined);

              memberKpis.push({
                metric: 'Quoted Households',
                actual: actualQuoted,
                target: quotedTarget,
                passed: quotedTarget > 0 ? actualQuoted >= quotedTarget : true,
              });
            }

            const soldInForm = kpis.some((k: { selectedKpiSlug?: string; key?: string }) => {
              const normalized = normalizeMetricKey(k.selectedKpiSlug || k.key || '');
              return normalized === 'items_sold';
            });

            const soldEnabled = enabledKpis.has('items_sold') ||
                                enabledKpis.has('sold_items') ||
                                enabledKpis.has('sold_count');

            if (!soldInForm && soldEnabled) {
              const actualSold = Number(metricPayload.items_sold) || 0;
              const soldTarget = Number(targetPayload.items_sold)
                || getTargetValue(targetsMap, 'items_sold', 'sold_items', undefined);

              memberKpis.push({
                metric: 'Items Sold',
                actual: actualSold,
                target: soldTarget,
                passed: soldTarget > 0 ? actualSold >= soldTarget : true,
              });
            }

            const passedCount = memberKpis.filter((k) => k.passed).length;
            const passRate = memberKpis.length > 0 ? Math.round((passedCount / memberKpis.length) * 100) : 0;

            summaries.push({
              teamMemberId: member.id,
              teamMemberName: member.name,
              submitted: didSubmit,
              passRate,
              kpis: memberKpis,
            });
          } else {
            summaries.push({
              teamMemberId: member.id,
              teamMemberName: member.name,
              submitted: didSubmit,
              passRate: 0,
              kpis: [],
            });
          }
        }

        const submittedCount = summaries.filter(s => s.submitted).length;
        const totalCount = summaries.length;

        if (totalCount === 0) {
          logStructured('no_team_members', { formId: form.id });
          continue;
        }

        const avgPassRate = submittedCount > 0
          ? Math.round(summaries.filter(s => s.submitted).reduce((sum, s) => sum + s.passRate, 0) / submittedCount)
          : 0;

        const recipientSet = new Set<string>();
        const recipientSetting = settings.dailySummaryRecipients || 'all_team';

        if (recipientSetting === 'owner_only') {
          if (agency.agency_email) recipientSet.add(agency.agency_email.toLowerCase());
        } else if (recipientSetting === 'custom') {
          const customIds = settings.customSummaryRecipients || [];
          if (customIds.length > 0) {
            const { data: customMembers } = await supabase
              .from('team_members')
              .select('email')
              .in('id', customIds);
            customMembers?.forEach(m => {
              if (m.email && !m.email.includes('@staff.placeholder')) {
                recipientSet.add(m.email.toLowerCase());
              }
            });
          }
        } else {
          let roleFilter: string | null = form.role;
          if (recipientSetting === 'all_team') roleFilter = null;
          else if (recipientSetting === 'sales_team') roleFilter = 'Sales';
          else if (recipientSetting === 'service_team') roleFilter = 'Service';

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
              recipientSet.add(m.email.toLowerCase());
            }
          });
        }

        if (agency.agency_email) {
          recipientSet.add(agency.agency_email.toLowerCase());
        }

        const { data: staffUsers } = await supabase
          .from('staff_users')
          .select('email')
          .eq('agency_id', agency.id)
          .eq('is_active', true)
          .not('email', 'is', null);

        staffUsers?.forEach(u => {
          if (u.email && !u.email.includes('@staff.placeholder')) {
            recipientSet.add(u.email.toLowerCase());
          }
        });

        const uniqueRecipients = Array.from(recipientSet);

        logStructured('recipients_resolved', {
          formId: form.id,
          recipientCount: uniqueRecipients.length,
          setting: recipientSetting,
        });

        if (uniqueRecipients.length === 0) {
          logStructured('no_recipients', { formId: form.id });
          continue;
        }

        const submittedList = summaries
          .filter(s => s.submitted || s.kpis.length > 0)
          .sort((a, b) => b.passRate - a.passRate)
          .map(s => {
            const statusIcon = s.submitted ? '✅' : '📊';
            return `<tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${statusIcon} ${s.teamMemberName}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center; color: ${s.passRate >= 75 ? '#22c55e' : s.passRate >= 50 ? '#eab308' : '#ef4444'}; font-weight: 600;">${s.passRate}%</td>
          </tr>`;
          })
          .join('');

        const missedList = summaries
          .filter(s => !s.submitted && s.kpis.length === 0)
          .map(s => `<li style="color: #ef4444; margin-bottom: 4px;">❌ ${s.teamMemberName}</li>`)
          .join('');

        const kpiTotals: Record<string, { total: number; target: number; count: number }> = {};
        summaries.filter(s => s.submitted || s.kpis.length > 0).forEach(s => {
          s.kpis.forEach(k => {
            if (!kpiTotals[k.metric]) {
              kpiTotals[k.metric] = { total: 0, target: k.target, count: 0 };
            }
            kpiTotals[k.metric].total += k.actual;
            kpiTotals[k.metric].count++;
          });
        });

        const kpiTotalsHtml = Object.entries(kpiTotals)
          .map(([metric, data]) => {
            const teamTarget = data.target * data.count;
            const passed = data.total >= teamTarget;
            const pct = teamTarget > 0 ? Math.round((data.total / teamTarget) * 100) : 0;
            return `<tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${metric}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${data.total}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${teamTarget}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center; color: ${passed ? '#22c55e' : '#ef4444'}; font-weight: 600;">${passed ? '✅' : '❌'} ${pct}%</td>
            </tr>`;
          })
          .join('');

        const bodyContent = `
          ${EmailComponents.summaryBox(`📊 ${submittedCount} of ${totalCount} team members submitted (${avgPassRate}% avg pass rate)`) }

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
            <h3 style="margin: 24px 0 12px 0; color: #ef4444;">⚠️ Did Not Submit</h3>
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
        `;

        const emailHtml = buildEmailHtml({
          title: '📈 Daily Team Summary',
          subtitle: `${form.name} • ${form.role} • ${yesterdayStr}`,
          bodyContent,
          footerAgencyName: agency.name,
        });

        try {
          const subject = `📈 Daily Summary: ${submittedCount}/${totalCount} submitted - ${form.name}`;
          const emailBatch = uniqueRecipients.map(email => ({
            from: BRAND.fromEmail,
            to: email,
            subject,
            html: emailHtml,
          }));

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
            const emailIds = emailResult?.data?.map((e: { id: string }) => e.id) || [];
            logStructured('email_sent', { formId: form.id, emailIds, recipients: uniqueRecipients.length });
            results.push({
              agency: agency.name,
              form: form.name,
              submittedCount,
              totalCount,
              recipients: uniqueRecipients.length,
              emailIds,
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
