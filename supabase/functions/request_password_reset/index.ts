import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const baseUrl = Deno.env.get('SITE_URL') || 'https://myagencybrain.com';
    const redirectTo = `${baseUrl}/reset-password`;

    // Generate a recovery link via Supabase Admin API (does NOT send an email)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo,
      },
    });

    // Always return success for security (don't reveal if user exists)
    if (linkError || !linkData) {
      console.log('generateLink failed or user not found:', email, linkError?.message);
      return new Response(
        JSON.stringify({ success: true, message: 'If an account exists with this email, you will receive a password reset link shortly.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // The generated link contains the token — extract and rebuild with our redirect
    // linkData.properties.action_link is the full Supabase verify URL
    const actionLink = linkData.properties?.action_link;
    if (!actionLink) {
      console.error('No action_link in generateLink response');
      return new Response(
        JSON.stringify({ success: true, message: 'If an account exists with this email, you will receive a password reset link shortly.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send email via Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      throw new Error('Email service not configured');
    }

    const { BRAND, buildEmailHtml, EmailComponents } = await import('../_shared/email-template.ts');

    const bodyContent = `
      ${EmailComponents.paragraph('Hi there,')}
      ${EmailComponents.paragraph('You requested a password reset for your Agency Brain account.')}
      ${EmailComponents.button('Reset Password', actionLink)}
      ${EmailComponents.paragraph('Or copy and paste this link into your browser:')}
      <p style="color: #666; word-break: break-all; font-size: 12px;">${actionLink}</p>
      ${EmailComponents.infoText("This link expires in 1 hour. If you didn't request this, you can safely ignore this email.")}
    `;

    const emailHtml = buildEmailHtml({
      title: 'Password Reset Request',
      bodyContent,
    });

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: BRAND.fromEmail,
        to: [email],
        subject: 'Reset Your Password - Agency Brain',
        text: `Hi there,

You requested a password reset for your Agency Brain account.

Click here to reset your password:
${actionLink}

This link expires in 1 hour.

If you didn't request this, you can safely ignore this email.

— Agency Brain`,
        html: emailHtml,
      })
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error('Resend API error:', errorData);
      throw new Error('Failed to send email');
    }

    console.log('Password reset email sent successfully to:', email);

    return new Response(
      JSON.stringify({ success: true, message: 'If an account exists with this email, you will receive a password reset link shortly.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in request_password_reset:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again later.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
