import { corsHeaders } from '../_shared/cors.ts';

interface StaffCredential {
  username: string;
  password: string;
  email?: string;
  name?: string;
}

interface SendCredentialsInput {
  email: string;
  staff_credentials: StaffCredential[];
  agency_name: string;
  start_date: string;
  owner_setup_url?: string;
  quantity?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: SendCredentialsInput = await req.json();
    const { email, staff_credentials, agency_name, start_date, owner_setup_url, quantity } = input;

    console.log('[challenge-send-credentials] Sending credentials to:', email);

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.error('[challenge-send-credentials] RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Import shared email template
    const { BRAND, buildEmailHtml, EmailComponents } = await import('../_shared/email-template.ts');

    const baseUrl = Deno.env.get('SITE_URL') || 'https://myagencybrain.com';
    const loginUrl = `${baseUrl}/auth`;
    const staffLoginUrl = `${baseUrl}/staff/login`;

    // Format start date
    const formattedStartDate = new Date(start_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const hasStaffCredentials = staff_credentials && staff_credentials.length > 0;
    const hasOwnerSetupUrl = owner_setup_url && owner_setup_url.trim() !== '';

    // Build owner setup section
    const ownerSetupHtml = hasOwnerSetupUrl ? `
      <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #22c55e;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #166534;">🔑 Set Your Password</p>
        <p style="margin: 0 0 12px 0; color: #166534; font-size: 14px;">Click the button below to set your owner portal password and manage your team:</p>
        ${EmailComponents.button('Set Your Password', owner_setup_url)}
        <p style="margin: 8px 0 0 0; color: #166534; font-size: 12px;">After setting your password, log in at <a href="${loginUrl}" style="color: #166534;">${loginUrl}</a></p>
      </div>
    ` : '';

    // Build credentials table for staff (if any)
    let credentialsHtml = '';
    if (hasStaffCredentials) {
      credentialsHtml = staff_credentials.length === 1
        ? `
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f97316;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e293b;">Staff Login Credentials:</p>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Username:</td>
                <td style="padding: 4px 0;"><code style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-family: monospace;">${staff_credentials[0].username}</code></td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Password:</td>
                <td style="padding: 4px 0;"><code style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-family: monospace;">${staff_credentials[0].password}</code></td>
              </tr>
            </table>
            <p style="margin: 8px 0 0 0; color: #64748b; font-size: 12px;">Staff login: <a href="${staffLoginUrl}" style="color: #f97316;">${staffLoginUrl}</a></p>
          </div>
        `
        : `
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f97316;">
            <p style="margin: 0 0 12px 0; font-weight: 600; color: #1e293b;">Staff Login Credentials (${staff_credentials.length} seats):</p>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 2px solid #e2e8f0;">
                  <th style="padding: 8px; text-align: left; color: #64748b; font-size: 12px;">Name</th>
                  <th style="padding: 8px; text-align: left; color: #64748b; font-size: 12px;">Username</th>
                  <th style="padding: 8px; text-align: left; color: #64748b; font-size: 12px;">Password</th>
                </tr>
              </thead>
              <tbody>
                ${staff_credentials.map((cred) => `
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px;">${cred.name || '—'}</td>
                    <td style="padding: 8px;"><code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px;">${cred.username}</code></td>
                    <td style="padding: 8px;"><code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px;">${cred.password}</code></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <p style="margin: 8px 0 0 0; color: #64748b; font-size: 12px;">Staff login: <a href="${staffLoginUrl}" style="color: #f97316;">${staffLoginUrl}</a></p>
          </div>
        `;
    }

    // Build the "what happens next" steps based on whether it's initial setup or team assignment
    const nextStepsHtml = hasOwnerSetupUrl
      ? `
        <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0; font-weight: 600; color: #92400e;">What happens next:</p>
          <ol style="margin: 8px 0 0 0; padding-left: 20px; color: #92400e;">
            <li style="margin-bottom: 4px;">Set your password using the button above</li>
            <li style="margin-bottom: 4px;">Log in to your owner portal to add your team members</li>
            <li style="margin-bottom: 4px;">Your team's challenge begins on ${formattedStartDate}</li>
            <li style="margin-bottom: 0;">Track your team's progress from your dashboard</li>
          </ol>
        </div>
      `
      : `
        <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0; font-weight: 600; color: #92400e;">What happens next:</p>
          <ol style="margin: 8px 0 0 0; padding-left: 20px; color: #92400e;">
            <li style="margin-bottom: 4px;">Share the credentials above with your team members</li>
            <li style="margin-bottom: 4px;">On ${formattedStartDate}, the first lesson will unlock</li>
            <li style="margin-bottom: 4px;">Complete one lesson per day (Monday-Friday)</li>
            <li style="margin-bottom: 0;">Track Core 4 habits daily to build your streak</li>
          </ol>
        </div>
      `;

    const bodyContent = `
      ${EmailComponents.paragraph(`Welcome to the 6-Week Challenge!`)}

      ${EmailComponents.summaryBox(`Your challenge begins on <strong>${formattedStartDate}</strong>${quantity ? ` &middot; ${quantity} seat${quantity > 1 ? 's' : ''}` : ''}`)}

      ${EmailComponents.paragraph(`Thank you for your purchase! We're excited to have you join The Challenge.`)}

      ${ownerSetupHtml}

      ${credentialsHtml}

      ${nextStepsHtml}

      ${hasOwnerSetupUrl ? EmailComponents.infoText('If the password setup button doesn\'t work, copy and paste this link into your browser: ' + owner_setup_url) : ''}

      ${EmailComponents.paragraph(`If you have any questions, reply to this email and we'll help you get started.`)}
    `;

    const emailHtml = buildEmailHtml({
      title: '🎯 Your 6-Week Challenge Awaits!',
      subtitle: hasOwnerSetupUrl ? 'Set your password to get started' : 'Your login credentials are inside',
      bodyContent,
      footerAgencyName: agency_name,
    });

    // Plain text version
    const setupText = hasOwnerSetupUrl ? `\nSET YOUR PASSWORD: ${owner_setup_url}\n` : '';
    const credentialsText = hasStaffCredentials
      ? staff_credentials.map((cred, i) =>
          staff_credentials.length === 1
            ? `Username: ${cred.username}\nPassword: ${cred.password}`
            : `${cred.name || `Seat ${i + 1}`}: ${cred.username} / ${cred.password}`
        ).join('\n')
      : '';

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: BRAND.fromEmail,
        to: [email],
        subject: '🎯 Your 6-Week Challenge Login Credentials',
        html: emailHtml,
        text: `Welcome to the 6-Week Challenge!

Your challenge begins on ${formattedStartDate}.
${setupText}
${credentialsText ? `STAFF CREDENTIALS:\n${credentialsText}\n\nSTAFF LOGIN URL: ${staffLoginUrl}` : ''}

WHAT HAPPENS NEXT:
${hasOwnerSetupUrl
  ? `1. Set your password using the link above
2. Log in to your owner portal to add your team members
3. Your team's challenge begins on ${formattedStartDate}
4. Track your team's progress from your dashboard`
  : `1. Share the credentials above with your team members
2. On ${formattedStartDate}, the first lesson will unlock
3. Complete one lesson per day (Monday-Friday)
4. Track Core 4 habits daily to build your streak`}

If you have any questions, reply to this email and we'll help you get started.

— Agency Brain`,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error('[challenge-send-credentials] Resend API error:', errorData);
      return new Response(
        JSON.stringify({ error: 'Failed to send credentials email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[challenge-send-credentials] Email sent successfully to:', email);

    return new Response(
      JSON.stringify({ success: true, message: `Credentials sent to ${email}` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[challenge-send-credentials] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
