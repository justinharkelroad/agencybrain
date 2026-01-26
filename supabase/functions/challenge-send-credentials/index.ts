import { corsHeaders } from '../_shared/cors.ts';

interface StaffCredential {
  username: string;
  password: string;
  email: string;
}

interface SendCredentialsInput {
  email: string;
  staff_credentials: StaffCredential[];
  agency_name: string;
  start_date: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: SendCredentialsInput = await req.json();
    const { email, staff_credentials, agency_name, start_date } = input;

    console.log('[challenge-send-credentials] Sending credentials to:', email);

    if (!email || !staff_credentials || staff_credentials.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Email and staff_credentials are required' }),
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
    const loginUrl = `${baseUrl}/staff/login`;

    // Format start date
    const formattedStartDate = new Date(start_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Build credentials table
    const credentialsHtml = staff_credentials.length === 1
      ? `
        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f97316;">
          <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e293b;">Your Login Credentials:</p>
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
        </div>
      `
      : `
        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f97316;">
          <p style="margin: 0 0 12px 0; font-weight: 600; color: #1e293b;">Login Credentials for ${staff_credentials.length} seats:</p>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 2px solid #e2e8f0;">
                <th style="padding: 8px; text-align: left; color: #64748b; font-size: 12px;">Seat</th>
                <th style="padding: 8px; text-align: left; color: #64748b; font-size: 12px;">Username</th>
                <th style="padding: 8px; text-align: left; color: #64748b; font-size: 12px;">Password</th>
              </tr>
            </thead>
            <tbody>
              ${staff_credentials.map((cred, i) => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px;">${i + 1}</td>
                  <td style="padding: 8px;"><code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px;">${cred.username}</code></td>
                  <td style="padding: 8px;"><code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px;">${cred.password}</code></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

    const bodyContent = `
      ${EmailComponents.paragraph(`Welcome to the 6-Week Challenge!`)}

      ${EmailComponents.summaryBox(`Your challenge begins on <strong>${formattedStartDate}</strong>`)}

      ${EmailComponents.paragraph(`Thank you for your purchase! We're excited to have you join The Challenge. Below are your login credentials to access the staff portal.`)}

      ${credentialsHtml}

      ${EmailComponents.button('Log In to Start', loginUrl)}

      <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0; font-weight: 600; color: #92400e;">📝 What happens next:</p>
        <ol style="margin: 8px 0 0 0; padding-left: 20px; color: #92400e;">
          <li style="margin-bottom: 4px;">Log in to the Staff Portal using your credentials above</li>
          <li style="margin-bottom: 4px;">On ${formattedStartDate}, your first lesson will unlock</li>
          <li style="margin-bottom: 4px;">Complete one lesson per day (Monday-Friday)</li>
          <li style="margin-bottom: 0;">Track your Core 4 habits daily to build your streak</li>
        </ol>
      </div>

      ${EmailComponents.infoText('Keep this email handy - you\'ll need your credentials to log in.')}

      ${EmailComponents.paragraph(`If you have any questions, reply to this email and we'll help you get started.`)}
    `;

    const emailHtml = buildEmailHtml({
      title: '🎯 Your 6-Week Challenge Awaits!',
      subtitle: 'Your login credentials are inside',
      bodyContent,
      footerAgencyName: agency_name,
    });

    // Plain text version
    const credentialsText = staff_credentials.map((cred, i) =>
      staff_credentials.length === 1
        ? `Username: ${cred.username}\nPassword: ${cred.password}`
        : `Seat ${i + 1}: ${cred.username} / ${cred.password}`
    ).join('\n');

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

LOGIN CREDENTIALS:
${credentialsText}

LOGIN URL: ${loginUrl}

WHAT HAPPENS NEXT:
1. Log in to the Staff Portal using your credentials above
2. On ${formattedStartDate}, your first lesson will unlock
3. Complete one lesson per day (Monday-Friday)
4. Track your Core 4 habits daily to build your streak

Keep this email handy - you'll need your credentials to log in.

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
