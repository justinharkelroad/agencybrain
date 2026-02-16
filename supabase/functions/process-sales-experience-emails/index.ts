import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const BRAND = {
  fromEmail: 'Agency Brain <info@agencybrain.standardplaybook.com>',
  name: 'Agency Brain',
};

const MAX_RETRIES = 3;
const BATCH_SIZE = 50;

interface QueuedEmail {
  id: string;
  assignment_id: string;
  template_key: string;
  recipient_email: string;
  recipient_name: string | null;
  recipient_type: string;
  scheduled_for: string;
  email_subject: string;
  email_body_html: string | null;
  variables_json: Record<string, string>;
  status: string;
  retry_count: number;
}

interface EmailTemplate {
  template_key: string;
  subject_template: string;
  body_template: string;
  is_active: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Allow GET for cron jobs, POST for manual triggers
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const startTime = Date.now();
  console.log('[process-se-emails] Starting email queue processing');

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.error('[process-se-emails] RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date().toISOString();

    // Only process emails created within the last 24 hours to prevent
    // sending stale/outdated lesson reminders after outages
    const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Mark stale pending emails so they don't pile up
    const { count: staleCount } = await supabase
      .from('sales_experience_email_queue')
      .update({
        status: 'failed',
        error_message: 'Stale email - older than 24 hours, skipped to prevent outdated content',
        updated_at: now,
      })
      .eq('status', 'pending')
      .lt('created_at', staleThreshold)
      .lt('retry_count', MAX_RETRIES);

    if (staleCount && staleCount > 0) {
      console.log(`[process-se-emails] Marked ${staleCount} stale emails as failed`);
    }

    // Fetch pending emails that are due (scheduled_for <= now)
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('sales_experience_email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .lt('retry_count', MAX_RETRIES)
      .order('scheduled_for', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('[process-se-emails] Failed to fetch queue:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch email queue' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log('[process-se-emails] No pending emails to process');
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No pending emails' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[process-se-emails] Found ${pendingEmails.length} pending emails`);

    // Get unique template keys to fetch templates
    const templateKeys = [...new Set(pendingEmails.map((e: QueuedEmail) => e.template_key))];

    const { data: templates, error: templateError } = await supabase
      .from('sales_experience_email_templates')
      .select('template_key, subject_template, body_template, is_active')
      .in('template_key', templateKeys);

    if (templateError) {
      console.error('[process-se-emails] Failed to fetch templates:', templateError);
    }

    const templateMap = new Map<string, EmailTemplate>();
    templates?.forEach((t: EmailTemplate) => templateMap.set(t.template_key, t));

    // Process results tracking
    const results = {
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [] as { id: string; error: string }[],
    };

    // Process emails in smaller batches for Resend API
    const emailsToSend: { queueId: string; from: string; to: string; subject: string; html: string }[] = [];

    for (const email of pendingEmails as QueuedEmail[]) {
      const template = templateMap.get(email.template_key);

      // Skip if template is disabled or doesn't exist
      if (!template || !template.is_active) {
        console.log(`[process-se-emails] Skipping email ${email.id}: template ${email.template_key} inactive or missing`);

        // Mark as skipped (using 'failed' status with note)
        await supabase
          .from('sales_experience_email_queue')
          .update({
            status: 'failed',
            error_message: `Template '${email.template_key}' is inactive or not found`,
            updated_at: now,
          })
          .eq('id', email.id);

        results.skipped++;
        continue;
      }

      // Build email content - use pre-generated subject/body if available, otherwise use template
      let subject = email.email_subject;
      let html = email.email_body_html || template.body_template;

      // Replace variables in body
      const variables = email.variables_json || {};
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        html = html.replace(regex, String(value));
        subject = subject.replace(regex, String(value));
      }

      // Clean up any remaining template tags
      html = html.replace(/\{\{#if[^}]*\}\}/g, '');
      html = html.replace(/\{\{\/if\}\}/g, '');
      html = html.replace(/\{\{[^}]+\}\}/g, ''); // Remove any unreplaced variables

      emailsToSend.push({
        queueId: email.id,
        from: BRAND.fromEmail,
        to: email.recipient_email,
        subject,
        html,
      });
    }

    if (emailsToSend.length === 0) {
      console.log('[process-se-emails] No valid emails to send after filtering');
      return new Response(
        JSON.stringify({
          success: true,
          processed: pendingEmails.length,
          sent: 0,
          skipped: results.skipped,
          message: 'All emails skipped due to inactive templates'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send emails via Resend batch API (max 100 per request)
    const batchPayload = emailsToSend.map(e => ({
      from: e.from,
      to: e.to,
      subject: e.subject,
      html: e.html,
    }));

    console.log(`[process-se-emails] Sending ${batchPayload.length} emails via Resend`);

    const response = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batchPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[process-se-emails] Resend API error:', response.status, errorText);

      // Mark all as failed with retry increment
      for (const email of emailsToSend) {
        const queuedEmail = (pendingEmails as QueuedEmail[]).find(e => e.id === email.queueId);
        await supabase
          .from('sales_experience_email_queue')
          .update({
            status: (queuedEmail?.retry_count || 0) + 1 >= MAX_RETRIES ? 'failed' : 'pending',
            retry_count: (queuedEmail?.retry_count || 0) + 1,
            error_message: `Resend API error: ${response.status} - ${errorText.substring(0, 200)}`,
            updated_at: now,
          })
          .eq('id', email.queueId);

        results.failed++;
        results.errors.push({ id: email.queueId, error: `API error: ${response.status}` });
      }
    } else {
      const responseData = await response.json();
      console.log('[process-se-emails] Resend response:', JSON.stringify(responseData));

      // Resend returns { data: [{ id: 'msg_id' }, ...] } for batch
      const messageIds = responseData.data || [];

      // Mark all as sent
      for (let i = 0; i < emailsToSend.length; i++) {
        const email = emailsToSend[i];
        const messageId = messageIds[i]?.id;

        await supabase
          .from('sales_experience_email_queue')
          .update({
            status: 'sent',
            sent_at: now,
            resend_message_id: messageId || null,
            error_message: null,
            updated_at: now,
          })
          .eq('id', email.queueId);

        results.sent++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[process-se-emails] Completed in ${duration}ms. Sent: ${results.sent}, Failed: ${results.failed}, Skipped: ${results.skipped}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: pendingEmails.length,
        sent: results.sent,
        failed: results.failed,
        skipped: results.skipped,
        duration_ms: duration,
        errors: results.errors.length > 0 ? results.errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[process-se-emails] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to process email queue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
