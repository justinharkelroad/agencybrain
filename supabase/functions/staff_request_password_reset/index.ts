import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    // Find staff user by email
    const { data: staffUser, error: findError } = await supabase
      .from('staff_users')
      .select('id, email, display_name, username')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    // Always return success for security (don't reveal if user exists)
    if (findError || !staffUser) {
      console.log('Staff user not found or inactive:', email);
      return new Response(
        JSON.stringify({ success: true, message: 'If an account exists with this email, you will receive a password reset link shortly.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate secure token (32 bytes hex = 64 characters)
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    // Set expiration (1 hour from now)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // Insert token into database
    const { error: insertError } = await supabase
      .from('staff_password_reset_tokens')
      .insert({
        staff_user_id: staffUser.id,
        token,
        expires_at: expiresAt
      });

    if (insertError) {
      console.error('Failed to insert reset token:', insertError);
      throw new Error('Failed to create reset token');
    }

    // Send email via Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      throw new Error('Email service not configured');
    }

    const resetUrl = `https://preview--agencybrain.lovable.app/staff/reset-password?token=${token}`;
    
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Agency Brain <info@agencybrain.standardplaybook.com>',
        to: [email],
        subject: 'Reset Your Password - Agency Brain Training Portal',
        text: `Hi ${staffUser.display_name || staffUser.username},

You requested a password reset for your training portal account.

Click here to reset your password:
${resetUrl}

This link expires in 1 hour.

If you didn't request this, you can safely ignore this email.

— Agency Brain`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Reset Your Password</h2>
            <p>Hi ${staffUser.display_name || staffUser.username},</p>
            <p>You requested a password reset for your training portal account.</p>
            <p>
              <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 6px;">
                Reset Password
              </a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="color: #666; word-break: break-all;">${resetUrl}</p>
            <p style="color: #666; font-size: 14px;">This link expires in 1 hour.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
            <p style="color: #999; font-size: 12px;">— Agency Brain</p>
          </div>
        `
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
    console.error('Error in staff_request_password_reset:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again later.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
