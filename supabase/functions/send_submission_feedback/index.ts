// SEND SUBMISSION FEEDBACK - AI-powered performance email
// Triggered after form submission is finalized
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

function logStructured(level: 'info' | 'warn' | 'error', eventType: string, data: Record<string, any>) {
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

    // 6. Build performance data
    const payload = submission.payload_json || {};
    const kpis = formTemplate.schema_json?.kpis || [];
    
    const performanceData: Array<{
      metric: string;
      actual: number;
      target: number;
      passed: boolean;
      percentage: number;
    }> = [];

    for (const kpi of kpis) {
      // Try selectedKpiSlug first (matches payload keys like "outbound_calls"), then fall back to full key
      const actual = Number(payload[kpi.selectedKpiSlug]) || Number(payload[kpi.key]) || 0;
      // Priority: kpi.target.goal → targets table by selectedKpiSlug → targets table by key
      const target = kpi.target?.goal || targetsMap[kpi.selectedKpiSlug] || targetsMap[kpi.key] || 0;
      const percentage = target > 0 ? Math.round((actual / target) * 100) : 100;
      
      performanceData.push({
        metric: kpi.label,
        actual,
        target,
        passed: actual >= target,
        percentage
      });
    }

    logStructured('info', 'performance_calculated', { 
      request_id: requestId, 
      metrics_count: performanceData.length,
      passed_count: performanceData.filter(p => p.passed).length
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

    // 9. Build recipient list
    const recipients: string[] = [];
    
    // Submitter email (use staff_users email if available, else team_members email)
    if (submitterEmail && !submitterEmail.includes('@staff.placeholder')) {
      recipients.push(submitterEmail);
    }

    // Agency owner email (from agencies.agency_email)
    if (agency?.agency_email && !recipients.includes(agency.agency_email)) {
      recipients.push(agency.agency_email);
    }

    // Additional recipients from settings
    const additionalIds = settings.additionalImmediateRecipients || [];
    if (additionalIds.length > 0) {
      const { data: additionalMembers } = await supabase
        .from('team_members')
        .select('email')
        .in('id', additionalIds);

      additionalMembers?.forEach(m => {
        // Skip placeholder emails
        if (m.email && !m.email.includes('@staff.placeholder') && !recipients.includes(m.email)) {
          recipients.push(m.email);
        }
      });
    }

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

    // 11. Send email via Resend
    logStructured('info', 'sending_email', { request_id: requestId, recipient_count: recipients.length });
    
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: BRAND.fromEmail,
        to: recipients,
        subject: `📊 Daily Report: ${passedCount}/${totalCount} targets met - ${teamMember?.name || 'Team Member'}`,
        html: emailHtml,
      }),
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
      email_id: emailResult?.id,
      recipients,
      passed_count: passedCount,
      total_count: totalCount,
      has_ai_feedback: !!aiFeedback
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: emailResult?.id,
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
