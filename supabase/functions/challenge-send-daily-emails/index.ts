import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

const MAX_RETRY_COUNT = 3;
const BATCH_SIZE = 10;

interface EmailQueueItem {
  id: string;
  assignment_id: string;
  lesson_id: string;
  staff_user_id: string;
  recipient_email: string;
  recipient_name: string | null;
  email_subject: string;
  scheduled_for: string;
  retry_count: number;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  recipientName?: string | null
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'The Challenge <challenge@standardplaybook.com>',
        to: [to],
        subject: subject,
        html: html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Resend API error:', errorData);
      return { success: false, error: errorData };
    }

    const data = await response.json();
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: String(error) };
  }
}

async function generateEmailHtml(
  lesson: any,
  recipientName: string | null,
  assignmentId: string
): Promise<string> {
  const firstName = recipientName?.split(' ')[0] || 'there';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${lesson.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e283a 0%, #020817 100%); padding: 30px; border-radius: 12px; margin-bottom: 24px;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">Day ${lesson.day_number}: ${lesson.title}</h1>
    <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 14px;">Week ${lesson.week_number} of The Challenge</p>
  </div>

  <p style="font-size: 16px; color: #374151;">Hey ${firstName},</p>

  <p style="font-size: 16px; color: #374151;">${lesson.preview_text || 'Your daily challenge is ready. Take a few minutes to watch today\'s video and complete your action items.'}</p>

  ${lesson.is_discovery_stack ? `
  <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
    <p style="margin: 0; color: #92400e; font-weight: 600;">Friday Discovery Stack</p>
    <p style="margin: 8px 0 0 0; color: #92400e; font-size: 14px;">Today's lesson includes your weekly Discovery Stack reflection. Don't skip this one!</p>
  </div>
  ` : ''}

  <div style="text-align: center; margin: 32px 0;">
    <a href="https://app.agencybrain.io/staff/challenge" style="background: #2563eb; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Start Today's Lesson</a>
  </div>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px;">
    <p style="margin: 0 0 12px 0; font-weight: 600; color: #374151;">Daily Core 4 Reminder</p>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">Have you checked in on your Core 4 today?</p>
    <ul style="margin: 12px 0 0 0; padding-left: 20px; color: #6b7280; font-size: 14px;">
      <li><strong>Body</strong> – Did you move today?</li>
      <li><strong>Being</strong> – Did you take time for mindfulness?</li>
      <li><strong>Balance</strong> – Did you nurture a relationship?</li>
      <li><strong>Business</strong> – Did you take action on your goals?</li>
    </ul>
  </div>

  <p style="font-size: 12px; color: #9ca3af; margin-top: 32px; text-align: center;">
    You're receiving this because you're enrolled in The Challenge.<br>
    Keep showing up. Keep growing. Keep winning.
  </p>
</body>
</html>
  `;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get pending emails that are scheduled for now or earlier
    const now = new Date().toISOString();

    const { data: pendingEmails, error: fetchError } = await supabase
      .from('challenge_email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .lt('retry_count', MAX_RETRY_COUNT)
      .order('scheduled_for')
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('Error fetching pending emails:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending emails' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No pending emails to send' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${pendingEmails.length} pending emails`);

    let sentCount = 0;
    let failedCount = 0;

    for (const email of pendingEmails as EmailQueueItem[]) {
      // Fetch lesson content
      const { data: lesson, error: lessonError } = await supabase
        .from('challenge_lessons')
        .select('*')
        .eq('id', email.lesson_id)
        .single();

      if (lessonError || !lesson) {
        console.error(`Lesson not found for email ${email.id}`);
        // Mark as failed
        await supabase
          .from('challenge_email_queue')
          .update({
            status: 'failed',
            error_message: 'Lesson not found',
            retry_count: MAX_RETRY_COUNT,
          })
          .eq('id', email.id);
        failedCount++;
        continue;
      }

      // Generate email HTML
      const html = await generateEmailHtml(lesson, email.recipient_name, email.assignment_id);

      // Send email
      const result = await sendEmail(
        email.recipient_email,
        email.email_subject,
        html,
        email.recipient_name
      );

      if (result.success) {
        // Update status to sent
        await supabase
          .from('challenge_email_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            resend_message_id: result.messageId,
          })
          .eq('id', email.id);
        sentCount++;
        console.log(`Email sent successfully: ${email.id}`);
      } else {
        // Increment retry count or mark as failed
        const newRetryCount = email.retry_count + 1;
        const newStatus = newRetryCount >= MAX_RETRY_COUNT ? 'failed' : 'pending';

        await supabase
          .from('challenge_email_queue')
          .update({
            status: newStatus,
            retry_count: newRetryCount,
            error_message: result.error,
          })
          .eq('id', email.id);

        failedCount++;
        console.error(`Email send failed: ${email.id}`, result.error);
      }

      // Small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        total: pendingEmails.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Email sending error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send emails' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
