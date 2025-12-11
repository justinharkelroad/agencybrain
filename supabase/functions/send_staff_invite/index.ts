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
    const { team_member_id, agency_id } = await req.json();

    if (!team_member_id || !agency_id) {
      return new Response(
        JSON.stringify({ error: 'team_member_id and agency_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Get team member
    const { data: teamMember, error: tmError } = await supabase
      .from('team_members')
      .select('id, name, email, role')
      .eq('id', team_member_id)
      .single();

    if (tmError || !teamMember) {
      console.error('Team member not found:', tmError);
      return new Response(
        JSON.stringify({ error: 'Team member not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!teamMember.email) {
      return new Response(
        JSON.stringify({ error: 'Team member has no email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get agency
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('id, name')
      .eq('id', agency_id)
      .single();

    if (agencyError) {
      console.error('Agency not found:', agencyError);
      return new Response(
        JSON.stringify({ error: 'Agency not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Check if staff_user already exists for this team_member
    const { data: existingStaff } = await supabase
      .from('staff_users')
      .select('id, is_active, username')
      .eq('team_member_id', team_member_id)
      .single();

    if (existingStaff?.is_active) {
      return new Response(
        JSON.stringify({ error: 'This team member already has an active staff login' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Generate invite token (32 bytes hex = 64 characters)
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const inviteToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    // 7-day expiry
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 5. Generate username from team member name
    const username = teamMember.name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');

    let staffUserId: string;

    if (existingStaff) {
      // Re-use existing inactive staff user
      staffUserId = existingStaff.id;
    } else {
      // Check if email is already used by another ACTIVE staff user (different team member)
      const { data: emailConflict } = await supabase
        .from('staff_users')
        .select('id, username, team_member_id')
        .eq('email', teamMember.email)
        .eq('is_active', true)  // Only check active users - deactivated emails can be reused
        .neq('team_member_id', team_member_id)
        .maybeSingle();

      if (emailConflict) {
        console.log('Email conflict detected:', emailConflict.username);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'email_conflict',
            message: `This email is already used by staff account "${emailConflict.username}". Update this team member's email address first, or deactivate the conflicting staff account.`,
            existing_username: emailConflict.username,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create new staff_user with placeholder password (cannot match real password)
      const placeholderHash = `PENDING_INVITE:${crypto.randomUUID()}`;
      
      const { data: newStaff, error: createError } = await supabase
        .from('staff_users')
        .insert({
          agency_id,
          team_member_id,
          username,
          password_hash: placeholderHash,
          display_name: teamMember.name,
          email: teamMember.email,
          is_active: false, // Activated after they set password
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Failed to create staff user:', createError);
        return new Response(
          JSON.stringify({ success: false, error: createError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      staffUserId = newStaff.id;
    }

    // 6. Insert invite token
    const { error: tokenError } = await supabase
      .from('staff_invite_tokens')
      .insert({
        staff_user_id: staffUserId,
        token: inviteToken,
        expires_at: expiresAt,
      });

    if (tokenError) {
      console.error('Failed to create invite token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to create invite token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Build invite URL using SITE_URL secret
    const baseUrl = Deno.env.get('SITE_URL') || 'https://myagencybrain.com';
    const inviteUrl = `${baseUrl}/staff/accept-invite?token=${inviteToken}`;

    // 8. Send email via Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Import shared email template
    const { BRAND, buildEmailHtml, EmailComponents } = await import('../_shared/email-template.ts');

    const bodyContent = `
      ${EmailComponents.paragraph(`Hi ${teamMember.name},`)}
      ${EmailComponents.paragraph(`You've been invited to join <strong>${agency?.name || 'your agency'}</strong> on Agency Brain!`)}
      ${EmailComponents.paragraph('Click the button below to set your password and access the staff portal:')}
      ${EmailComponents.button('Accept Invite & Set Password', inviteUrl)}
      ${EmailComponents.infoText('This invite expires in 7 days.')}
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
      <p style="color: #64748b; font-size: 14px;">
        <strong>Your login details:</strong><br>
        Username: <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${username}</code><br>
        Portal URL: <a href="${baseUrl}/staff/login" style="color: #2563eb;">${baseUrl}/staff/login</a>
      </p>
    `;

    const emailHtml = buildEmailHtml({
      title: '🎉 Welcome to Agency Brain!',
      subtitle: `You've been invited to ${agency?.name || 'your agency'}`,
      bodyContent,
      footerAgencyName: agency?.name,
    });

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: BRAND.fromEmail,
        to: [teamMember.email],
        subject: `You're invited to ${agency?.name || 'Agency Brain'}!`,
        html: emailHtml,
        text: `Hi ${teamMember.name},

You've been invited to join ${agency?.name || 'your agency'} on Agency Brain!

Click here to set your password and access the staff portal:
${inviteUrl}

Your login details:
Username: ${username}
Portal URL: ${baseUrl}/staff/login

This invite expires in 7 days.

— Agency Brain`,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error('Resend API error:', errorData);
      return new Response(
        JSON.stringify({ error: 'Failed to send invite email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Invite email sent successfully to:', teamMember.email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        staff_user_id: staffUserId,
        username,
        message: `Invite sent to ${teamMember.email}` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send_staff_invite:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again later.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
