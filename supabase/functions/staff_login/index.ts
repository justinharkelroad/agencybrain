import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// PBKDF2 password verification using Web Crypto API
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    // Parse stored hash: pbkdf2_sha256$iterations$salt$hash
    const parts = storedHash.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') {
      console.error('Invalid hash format');
      return false;
    }

    const iterations = parseInt(parts[1]);
    const saltHex = parts[2];
    const storedHashHex = parts[3];

    // Convert hex strings back to Uint8Array
    const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
    const storedHashArray = new Uint8Array(storedHashHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));

    // Hash the provided password with the same salt
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    
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
        iterations: iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );
    
    const computedHash = new Uint8Array(derivedBits);

    // Compare hashes in constant time
    if (computedHash.length !== storedHashArray.length) {
      return false;
    }

    let diff = 0;
    for (let i = 0; i < computedHash.length; i++) {
      diff |= computedHash[i] ^ storedHashArray[i];
    }

    return diff === 0;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, password, agency_slug } = await req.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Please enter both username and password' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find agency by slug if provided
    let agencyId = null;
    if (agency_slug) {
      const { data: agency } = await supabase
        .from('agencies')
        .select('id')
        .eq('slug', agency_slug)
        .single();
      
      if (!agency) {
        return new Response(
          JSON.stringify({ success: false, error: 'Agency code not recognized. Please check and try again.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      agencyId = agency.id;
    }

    // Find staff user.
    // If input looks like an email, prefer exact email lookup to avoid ambiguity.
    // If input is username and agency code is omitted, detect ambiguous matches across agencies.
    const loginInput = String(username).trim();
    const isEmailLogin = loginInput.includes('@');
    let staffUser: any = null;

    if (isEmailLogin) {
      let emailQuery = supabase
        .from('staff_users')
        .select('*')
        .eq('email', loginInput)
        .eq('is_active', true);

      if (agencyId) {
        emailQuery = emailQuery.eq('agency_id', agencyId);
      }

      const { data: byEmail, error: byEmailError } = await emailQuery.maybeSingle();
      if (byEmailError || !byEmail) {
        console.log('User not found by email:', loginInput);
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid username or password. Please try again.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      staffUser = byEmail;
    } else {
      let usernameQuery = supabase
        .from('staff_users')
        .select('*')
        .eq('username', loginInput)
        .eq('is_active', true);

      if (agencyId) {
        usernameQuery = usernameQuery.eq('agency_id', agencyId);
      }

      const { data: byUsername, error: byUsernameError } = await usernameQuery.limit(2);
      if (byUsernameError || !byUsername || byUsername.length === 0) {
        console.log('User not found by username:', loginInput);
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid username or password. Please try again.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!agencyId && byUsername.length > 1) {
        return new Response(
          JSON.stringify({ success: false, error: 'Multiple staff accounts found for this username. Enter your agency code.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      staffUser = byUsername[0];
    }

    // Verify password using PBKDF2
    const passwordMatch = await verifyPassword(password, staffUser.password_hash);
    
    if (!passwordMatch) {
      console.log('Password mismatch for user:', username);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid username or password. Please try again.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate session token
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour session

    // Create session in database
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .insert({
        staff_user_id: staffUser.id,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Session creation error:', sessionError);
      return new Response(
        JSON.stringify({ success: false, error: 'Something went wrong. Please try again.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last_login_at
    await supabase
      .from('staff_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', staffUser.id);

    // Return session token and user data (without password hash)
    const { password_hash, ...userData } = staffUser;

    // Fetch additional data: role, team_member_name from team_members
    let role = null;
    let team_member_name = null;
    if (staffUser.team_member_id) {
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('name, role')
        .eq('id', staffUser.team_member_id)
        .single();
      
      if (teamMember) {
        role = teamMember.role;
        team_member_name = teamMember.name;
      }
    }

    // Fetch agency_membership_tier from profiles table
    let agency_membership_tier = null;
    if (staffUser.agency_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('membership_tier')
        .eq('agency_id', staffUser.agency_id)
        .limit(1)
        .single();
      
      if (profile) {
        agency_membership_tier = profile.membership_tier;
      }
    }

    console.log('Login successful for user:', username, 'tier:', agency_membership_tier);

    return new Response(
      JSON.stringify({
        success: true,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
        user: {
          ...userData,
          role,
          team_member_name,
          agency_membership_tier
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Something went wrong. Please try again later.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
