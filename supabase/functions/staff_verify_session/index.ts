import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_token } = await req.json();

    if (!session_token) {
      return new Response(
        JSON.stringify({ error: 'Session token required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find valid session with team_member info
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select(`
        *,
        staff_users (
          id,
          username,
          display_name,
          agency_id,
          team_member_id,
          email,
          is_active
        )
      `)
      .eq('session_token', session_token)
      .eq('is_valid', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      console.log('Invalid or expired session');
      // Return 200 with valid: false instead of 401 to prevent error throwing
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid or expired session' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return user data (without password hash)
    const { password_hash, ...userData } = session.staff_users as any;

    // If staff user is linked to a team member, fetch the role
    let role: string | null = null;
    let team_member_name: string | null = null;
    
    if (userData.team_member_id) {
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('name, role')
        .eq('id', userData.team_member_id)
        .single();
      
      if (teamMember) {
        role = teamMember.role;
        team_member_name = teamMember.name;
      }
    }

    return new Response(
      JSON.stringify({
        valid: true,
        user: { ...userData, role, team_member_name },
        expires_at: session.expires_at
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Session verification error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
