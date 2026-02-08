import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BRAND = {
  colors: {
    primary: '#1e283a',
    secondary: '#020817',
    gray: '#60626c',
    red: '#dc2626',
    lightBg: '#f1f5f9',
    white: '#ffffff',
  },
  logo: 'https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/AgencyBrain%20Logo/Agency%20Brain%20Logo%20Stan.png',
  name: 'Agency Brain',
  fromEmail: 'Agency Brain <info@agencybrain.standardplaybook.com>',
};

interface OverdueTask {
  id: string;
  title: string;
  due_date: string;
  day_number: number;
  action_type: string;
  instance: {
    customer_name: string;
    customer_phone: string | null;
  };
}

interface StaffWithOverdueTasks {
  staff_user_id: string;
  email: string;
  display_name: string;
  agency_name: string;
  tasks: OverdueTask[];
}

/**
 * CRON Job: Send Onboarding Overdue Alerts
 *
 * This function should be called daily (e.g., at 9 AM local time)
 * to send email notifications to staff members who have overdue tasks.
 *
 * - Groups overdue tasks by assigned staff user
 * - Sends one email per staff member with all their overdue tasks
 * - Only sends if staff user has a valid email address
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!RESEND_API_KEY) {
      console.error('[send_onboarding_overdue_alerts] RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body for test mode
    let forceTest = false;
    let testEmail: string | null = null;
    let testStaffUserId: string | null = null;
    try {
      const body = await req.json();
      forceTest = body?.forceTest === true;
      testEmail = body?.testEmail || null;
      testStaffUserId = body?.testStaffUserId || null;

      if (forceTest && !testEmail) {
        return new Response(
          JSON.stringify({ error: 'forceTest mode requires testEmail parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (forceTest) {
        console.log(`[send_onboarding_overdue_alerts] FORCE TEST MODE: sending ONLY to ${testEmail}`);
      }
    } catch {
      // No body or invalid JSON, continue normally
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[send_onboarding_overdue_alerts] Fetching overdue tasks...');

    // Build query for overdue tasks
    let query = supabase
      .from('onboarding_tasks')
      .select(`
        id,
        title,
        due_date,
        day_number,
        action_type,
        assigned_to_staff_user_id,
        instance:onboarding_instances!inner(
          customer_name,
          customer_phone
        )
      `)
      .eq('status', 'overdue')
      .not('assigned_to_staff_user_id', 'is', null)
      .order('due_date', { ascending: true });

    if (testStaffUserId) {
      query = query.eq('assigned_to_staff_user_id', testStaffUserId);
    }

    const { data: overdueTasks, error: tasksError } = await query;

    if (tasksError) {
      console.error('[send_onboarding_overdue_alerts] Error fetching tasks:', tasksError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch overdue tasks', details: tasksError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!overdueTasks || overdueTasks.length === 0) {
      console.log('[send_onboarding_overdue_alerts] No overdue tasks found');
      return new Response(
        JSON.stringify({ success: true, message: 'No overdue tasks', emailsSent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send_onboarding_overdue_alerts] Found ${overdueTasks.length} overdue tasks`);

    // Group tasks by staff user
    const tasksByStaff: Map<string, OverdueTask[]> = new Map();
    for (const task of overdueTasks) {
      const staffId = task.assigned_to_staff_user_id;
      if (!tasksByStaff.has(staffId)) {
        tasksByStaff.set(staffId, []);
      }
      tasksByStaff.get(staffId)!.push({
        id: task.id,
        title: task.title,
        due_date: task.due_date,
        day_number: task.day_number,
        action_type: task.action_type,
        instance: task.instance as { customer_name: string; customer_phone: string | null },
      });
    }

    // Get staff user details (email, name, agency)
    const staffIds = Array.from(tasksByStaff.keys());
    const { data: staffUsers, error: staffError } = await supabase
      .from('staff_users')
      .select(`
        id,
        email,
        display_name,
        username,
        agency:agencies!inner(name)
      `)
      .in('id', staffIds)
      .eq('is_active', true)
      .not('email', 'is', null);

    if (staffError) {
      console.error('[send_onboarding_overdue_alerts] Error fetching staff users:', staffError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch staff users', details: staffError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build list of staff with their tasks
    const staffWithTasks: StaffWithOverdueTasks[] = [];
    for (const staff of staffUsers || []) {
      const tasks = tasksByStaff.get(staff.id);
      if (tasks && tasks.length > 0 && staff.email) {
        staffWithTasks.push({
          staff_user_id: staff.id,
          email: staff.email,
          display_name: staff.display_name || staff.username,
          agency_name: (staff.agency as { name: string })?.name || 'Your Agency',
          tasks,
        });
      }
    }

    if (staffWithTasks.length === 0) {
      console.log('[send_onboarding_overdue_alerts] No staff with valid emails and overdue tasks');
      return new Response(
        JSON.stringify({ success: true, message: 'No staff with valid emails', emailsSent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format helpers
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const getActionIcon = (type: string) => {
      switch (type) {
        case 'call': return '📞';
        case 'text': return '💬';
        case 'email': return '📧';
        default: return '📋';
      }
    };

    const getDaysOverdue = (dueDate: string) => {
      const due = new Date(dueDate + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      return diff;
    };

    // Send emails
    const results: { email: string; status: string; taskCount?: number }[] = [];
    const todayFormatted = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    for (const staffData of staffWithTasks) {
      try {
        // In test mode, override the recipient email
        const recipientEmail = forceTest && testEmail ? testEmail : staffData.email;

        // Build task rows HTML
        const taskRowsHtml = staffData.tasks.map(task => {
          const daysOverdue = getDaysOverdue(task.due_date);
          return `
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 12px; vertical-align: top;">
                <span style="font-size: 20px;">${getActionIcon(task.action_type)}</span>
              </td>
              <td style="padding: 12px;">
                <div style="font-weight: 600; color: #1f2937;">${task.title}</div>
                <div style="font-size: 13px; color: #6b7280;">Customer: ${task.instance.customer_name}</div>
                ${task.instance.customer_phone ? `<div style="font-size: 13px; color: #6b7280;">Phone: ${task.instance.customer_phone}</div>` : ''}
              </td>
              <td style="padding: 12px; text-align: center; white-space: nowrap;">
                <div style="color: ${BRAND.colors.red}; font-weight: 600;">${formatDate(task.due_date)}</div>
                <div style="font-size: 12px; color: ${BRAND.colors.red};">${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue</div>
              </td>
            </tr>
          `;
        }).join('');

        const emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">

    <!-- Header -->
    <div style="background-color: #991b1b; background: linear-gradient(135deg, ${BRAND.colors.red}, #991b1b); color: white; padding: 24px; border-radius: 8px 8px 0 0;">
      <div style="display: inline-block; padding: 8px 10px; background-color: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.28); border-radius: 8px; margin-bottom: 16px;">
        <img src="${BRAND.logo}" alt="${BRAND.name}" style="height: 36px; display: block;">
      </div>
      <h1 style="margin: 0; font-size: 22px;">⚠️ Overdue Tasks Alert</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">You have ${staffData.tasks.length} overdue follow-up task${staffData.tasks.length !== 1 ? 's' : ''}</p>
    </div>

    <!-- Body -->
    <div style="background: ${BRAND.colors.white}; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">

      <p style="margin: 0 0 20px 0;">Hi ${staffData.display_name},</p>

      <p style="margin: 0 0 20px 0;">The following onboarding tasks are <strong style="color: ${BRAND.colors.red};">overdue</strong> and need your attention:</p>

      <!-- Tasks Table -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
        <thead>
          <tr style="background: ${BRAND.colors.lightBg};">
            <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; width: 50px;"></th>
            <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Task</th>
            <th style="padding: 12px; text-align: center; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Due Date</th>
          </tr>
        </thead>
        <tbody>
          ${taskRowsHtml}
        </tbody>
      </table>

      <p style="margin: 0 0 20px 0;">Please complete these tasks as soon as possible to ensure a great customer experience.</p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="https://app.agencybrain.io/staff/onboarding-tasks" style="display: inline-block; background: ${BRAND.colors.primary}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View My Tasks</a>
      </div>

    </div>

    <!-- Footer -->
    <div style="background: ${BRAND.colors.lightBg}; padding: 16px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
      <p style="margin: 0; text-align: center; color: ${BRAND.colors.gray}; font-size: 12px;">
        ${staffData.agency_name} • Powered by ${BRAND.name}
      </p>
    </div>

  </div>
</body>
</html>`;

        const subject = `⚠️ ${staffData.tasks.length} Overdue Task${staffData.tasks.length !== 1 ? 's' : ''} - Action Required | ${staffData.agency_name}`;

        // Send email via Resend
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: BRAND.fromEmail,
            to: recipientEmail,
            subject,
            html: emailHtml,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[send_onboarding_overdue_alerts] Resend error for ${recipientEmail}:`, errorText);
          results.push({ email: recipientEmail, status: 'error' });
          continue;
        }

        console.log(`[send_onboarding_overdue_alerts] Sent to ${recipientEmail} (${staffData.tasks.length} tasks)`);
        results.push({ email: recipientEmail, status: 'sent', taskCount: staffData.tasks.length });

      } catch (emailError) {
        console.error(`[send_onboarding_overdue_alerts] Error sending to ${staffData.email}:`, emailError);
        results.push({ email: staffData.email, status: 'error' });
      }
    }

    const sentCount = results.filter(r => r.status === 'sent').length;
    console.log(`[send_onboarding_overdue_alerts] Complete - sent ${sentCount} emails`);

    return new Response(
      JSON.stringify({
        success: true,
        date: todayFormatted,
        totalOverdueTasks: overdueTasks.length,
        emailsSent: sentCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send_onboarding_overdue_alerts] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
