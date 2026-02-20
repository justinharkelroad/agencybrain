import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// PBKDF2 password hashing using Web Crypto API (same as admin_create_staff_user)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  const hashArray = new Uint8Array(derivedBits);
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Format: pbkdf2_sha256$100000$salt$hash
  return `pbkdf2_sha256$100000$${saltHex}$${hashHex}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is admin (pass JWT explicitly per CLAUDE.md Rule 3b)
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, agency_id')
      .eq('id', user.id)
      .single();

    // Allow super-admins OR agency owners
    const isSuperAdmin = profile?.role === 'admin';
    const isAgencyOwner = !!profile?.agency_id;

    if (!profile || (!isSuperAdmin && !isAgencyOwner)) {
      return new Response(
        JSON.stringify({ error: 'Admin or Agency Owner access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { user_id, new_password, activate } = await req.json();

    if (!user_id || !new_password) {
      return new Response(
        JSON.stringify({ error: 'user_id and new_password required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate password strength
    if (new_password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify staff user belongs to admin's agency
    const { data: staffUser, error: fetchError } = await supabase
      .from('staff_users')
      .select('agency_id, username')
      .eq('id', user_id)
      .single();

    if (fetchError || !staffUser) {
      return new Response(
        JSON.stringify({ error: 'Staff user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Super-admins can reset any staff, agency owners only their own
    if (!isSuperAdmin && staffUser.agency_id !== profile.agency_id) {
      return new Response(
        JSON.stringify({ error: 'Access denied to this staff user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash new password
    const passwordHash = await hashPassword(new_password);

    // Build update payload — optionally activate the account
    const updatePayload: Record<string, unknown> = { password_hash: passwordHash };
    if (activate === true) {
      updatePayload.is_active = true;
    }

    // Update password hash (and optionally is_active)
    const { error: updateError } = await supabase
      .from('staff_users')
      .update(updatePayload)
      .eq('id', user_id);

    if (updateError) {
      console.error('Failed to reset password:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to reset password' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const activated = activate === true;
    console.log(`Password ${activated ? 'set & account activated' : 'reset'} for staff user: ${staffUser.username} (${user_id})`);

    return new Response(
      JSON.stringify({ success: true, activated, message: activated ? 'Password set and account activated' : 'Password reset successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Admin reset staff password error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
