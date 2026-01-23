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
  kpis: Array<{ metric: string; actual: number; target: number; passed: boolean }>;
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
  // 3. Determine aliases based on normalized key
  const normalized = normalizeMetricKey(kpiSlug || kpiKey);
  let aliases: string[] = [];
  if (normalized === 'quoted_households') aliases = QUOTED_ALIASES;
  else if (normalized === 'items_sold') aliases = SOLD_ALIASES;
  else aliases = [kpiSlug, kpiKey].filter(Boolean);
  
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
        const { data: teamMembers, error: tmError } = await supabase
          .from('team_members')
          .select('id, name, email, role')
          .eq('agency_id', agency.id)
          .eq('status', 'active')
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

        // Build summary for each team member
        const summaries: SubmissionSummary[] = [];
        const kpis = form.schema_json?.kpis || [];

        for (const member of teamMembers || []) {
          const submission = submissionsByMember.get(member.id);
          
          if (submission) {
            const payload = submission.payload_json || {};
            const memberKpis = kpis.map((kpi: { selectedKpiSlug?: string; key?: string; label?: string; target?: { goal?: number } }) => {
              const kpiSlug = kpi.selectedKpiSlug || '';
              const kpiKey = kpi.key || '';
              
              // Use alias-aware resolution for actual and target
              const actual = getMetricValueFromPayload(payload, kpiSlug, kpiKey);
              const target = getTargetValue(targetsMap, kpiSlug, kpiKey, kpi.target?.goal);
              
              return {
                metric: kpi.label || kpi.selectedKpiSlug || kpi.key || 'Unknown',
                actual,
                target,
                passed: actual >= target,
              };
            });

            const passedCount = memberKpis.filter((k: { passed: boolean }) => k.passed).length;
            const passRate = memberKpis.length > 0 ? Math.round((passedCount / memberKpis.length) * 100) : 0;

            summaries.push({
              teamMemberId: member.id,
              teamMemberName: member.name,
              submitted: true,
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

        // Build email HTML
        const submittedList = summaries
          .filter(s => s.submitted)
          .sort((a, b) => b.passRate - a.passRate)
          .map(s => `<tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">✅ ${s.teamMemberName}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center; color: ${s.passRate >= 75 ? '#22c55e' : s.passRate >= 50 ? '#eab308' : '#ef4444'}; font-weight: 600;">${s.passRate}%</td>
          </tr>`)
          .join('');

        const missedList = summaries
          .filter(s => !s.submitted)
          .map(s => `<li style="color: #ef4444; margin-bottom: 4px;">❌ ${s.teamMemberName}</li>`)
          .join('');

        // Calculate team KPI totals
        const kpiTotals: Record<string, { total: number; target: number; count: number }> = {};
        summaries.filter(s => s.submitted).forEach(s => {
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
          ${EmailComponents.summaryBox(`📊 ${submittedCount} of ${totalCount} team members submitted (${avgPassRate}% avg pass rate)`)}
          
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
          title: `📈 Daily Team Summary`,
          subtitle: `${form.name} • ${form.role} • ${yesterdayStr}`,
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
              subject: `📈 Daily Summary: ${submittedCount}/${totalCount} submitted - ${form.name}`,
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
