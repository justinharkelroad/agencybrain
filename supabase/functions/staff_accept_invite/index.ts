import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PBKDF2 password hashing (same as password reset functions)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  
  const hashArray = new Uint8Array(derivedBits);
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `pbkdf2_sha256$100000$${saltHex}$${hashHex}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ success: false, error: 'Password must be at least 8 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Validate invite token
    const { data: inviteToken, error: tokenError } = await supabase
      .from('staff_invite_tokens')
      .select('id, staff_user_id, expires_at, accepted_at')
      .eq('token', token)
      .single();

    if (tokenError || !inviteToken) {
      console.log('Invalid invite token:', token);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired invite link. Please request a new invite from your administrator.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Check if token is expired
    if (new Date(inviteToken.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: 'This invite link has expired. Please request a new invite from your administrator.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Check if token is already used
    if (inviteToken.accepted_at) {
      return new Response(
        JSON.stringify({ success: false, error: 'This invite has already been used. Please log in with your credentials.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Hash the password
    const passwordHash = await hashPassword(password);

    // 5. Update staff user: set password and activate
    const { error: updateError } = await supabase
      .from('staff_users')
      .update({
        password_hash: passwordHash,
        is_active: true,
      })
      .eq('id', inviteToken.staff_user_id);

    if (updateError) {
      console.error('Failed to update staff user:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to activate account. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Mark token as used
    const { error: markUsedError } = await supabase
      .from('staff_invite_tokens')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', inviteToken.id);

    if (markUsedError) {
      console.error('Failed to mark token as used:', markUsedError);
      // Don't fail the request, the account is already activated
    }

    // Get username for the success message
    const { data: staffUser } = await supabase
      .from('staff_users')
      .select('username')
      .eq('id', inviteToken.staff_user_id)
      .single();

    console.log('Staff invite accepted, account activated for user:', inviteToken.staff_user_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        username: staffUser?.username,
        message: 'Account activated! You can now log in.' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in staff_accept_invite:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred. Please try again later.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
