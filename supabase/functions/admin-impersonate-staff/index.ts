import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client for user verification
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the calling user's JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error('User verification failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get request body
    const { staff_user_id } = await req.json();
    
    if (!staff_user_id) {
      return new Response(
        JSON.stringify({ error: 'staff_user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get calling user's profile to check if they're admin/owner
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('agency_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch failed:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin or agency owner
    const isAdmin = profile.role === 'admin';
    const isAgencyOwner = !!profile.agency_id;

    // Key employees should NOT be able to impersonate staff
    const { data: keyEmployee } = await supabaseClient
      .from('key_employees')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const isKeyEmployee = !!keyEmployee;

    if (!isAdmin && (!isAgencyOwner || isKeyEmployee)) {
      return new Response(
        JSON.stringify({ error: 'Only admins and agency owners can impersonate staff' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the target staff user
    const { data: staffUser, error: staffError } = await supabaseClient
      .from('staff_users')
      .select('id, agency_id, username, display_name, email, team_member_id')
      .eq('id', staff_user_id)
      .single();

    if (staffError || !staffUser) {
      console.error('Staff user fetch failed:', staffError);
      return new Response(
        JSON.stringify({ error: 'Staff user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify staff user belongs to the same agency
    if (staffUser.agency_id !== profile.agency_id) {
      return new Response(
        JSON.stringify({ error: 'Cannot impersonate staff from another agency' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate session token
    const sessionToken = crypto.randomUUID();
    
    // Create impersonation session (expires in 30 minutes)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    
    const { error: sessionError } = await supabaseClient
      .from('staff_sessions')
      .insert({
        staff_user_id: staff_user_id,
        session_token: sessionToken,
        expires_at: expiresAt,
        is_impersonation: true,
        impersonated_by: user.id,
      });

    if (sessionError) {
      console.error('Session creation failed:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create impersonation session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get additional staff info for the response
    let role = null;
    let teamMemberName = null;
    let agencyMembershipTier = null;

    if (staffUser.team_member_id) {
      const { data: teamMember } = await supabaseClient
        .from('team_members')
        .select('name, role')
        .eq('id', staffUser.team_member_id)
        .single();
      
      if (teamMember) {
        role = teamMember.role;
        teamMemberName = teamMember.name;
      }
    }

    // Get agency membership tier
    const { data: agency } = await supabaseClient
      .from('agencies')
      .select('id')
      .eq('id', staffUser.agency_id)
      .single();

    if (agency) {
      const { data: membership } = await supabaseClient
        .from('agency_memberships')
        .select('tier')
        .eq('agency_id', agency.id)
        .single();
      
      if (membership) {
        agencyMembershipTier = membership.tier;
      }
    }

    console.log(`Impersonation session created for staff ${staffUser.username} by user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        session_token: sessionToken,
        user: {
          id: staffUser.id,
          username: staffUser.username,
          display_name: staffUser.display_name,
          agency_id: staffUser.agency_id,
          team_member_id: staffUser.team_member_id,
          role: role,
          team_member_name: teamMemberName,
          email: staffUser.email,
          agency_membership_tier: agencyMembershipTier,
          is_impersonation: true,
        },
        expires_at: expiresAt,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Impersonation error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
