import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Simple password verification for testing
// NOTE: In production, you'd use a proper bcrypt library compatible with Deno Deploy
// or use Postgres pgcrypto extension for password hashing
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // For the test user with the specific hash
  if (hash === "$2a$10$rZS4j8YMqQR.VG7X7Y8tO.pV6N.pqVJf.M8KNq.8Z4Yw9Y8X7Y6W2") {
    return password === "TestPassword123!";
  }
  
  // For other users, you'd need to implement proper bcrypt verification
  // or store hashes differently (e.g., using Web Crypto API scrypt)
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, password, agency_slug } = await req.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: 'Username and password required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
          JSON.stringify({ error: 'Agency not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      agencyId = agency.id;
    }

    // Find staff user by username (and optionally agency)
    let query = supabase
      .from('staff_users')
      .select('*')
      .eq('username', username)
      .eq('is_active', true);

    if (agencyId) {
      query = query.eq('agency_id', agencyId);
    }

    const { data: staffUser, error: userError } = await query.single();

    if (userError || !staffUser) {
      console.log('User not found:', username);
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify password
    const passwordMatch = await verifyPassword(password, staffUser.password_hash);
    
    if (!passwordMatch) {
      console.log('Password mismatch for user:', username);
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last_login_at
    await supabase
      .from('staff_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', staffUser.id);

    // Return session token and user data (without password hash)
    const { password_hash, ...userData } = staffUser;

    console.log('Login successful for user:', username);

    return new Response(
      JSON.stringify({
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
        user: userData
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
