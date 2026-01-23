import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface LinkRequest {
  staff_user_id: string;
  team_member_id: string;
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

    // Verify user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: LinkRequest = await req.json();
    const { staff_user_id, team_member_id } = body;

    if (!staff_user_id || !team_member_id) {
      return new Response(
        JSON.stringify({ error: 'staff_user_id and team_member_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify staff user exists
    const { data: staffUser, error: staffError } = await supabase
      .from('staff_users')
      .select('id, agency_id, team_member_id')
      .eq('id', staff_user_id)
      .single();

    if (staffError || !staffUser) {
      return new Response(
        JSON.stringify({ error: 'Staff user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (staffUser.team_member_id) {
      return new Response(
        JSON.stringify({ error: 'Staff user is already linked to a team member' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify team member exists and belongs to same agency
    const { data: teamMember, error: tmError } = await supabase
      .from('team_members')
      .select('id, agency_id, name')
      .eq('id', team_member_id)
      .single();

    if (tmError || !teamMember) {
      return new Response(
        JSON.stringify({ error: 'Team member not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (teamMember.agency_id !== staffUser.agency_id) {
      return new Response(
        JSON.stringify({ error: 'Team member belongs to different agency' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if team member is already linked to another staff user
    const { data: existingLink } = await supabase
      .from('staff_users')
      .select('id')
      .eq('team_member_id', team_member_id)
      .single();

    if (existingLink) {
      return new Response(
        JSON.stringify({ error: 'Team member is already linked to another staff user' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update staff user with team_member_id
    const { error: updateError } = await supabase
      .from('staff_users')
      .update({ team_member_id })
      .eq('id', staff_user_id);

    if (updateError) {
      console.error('Failed to link staff user:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to link staff user to team member' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Linked staff user ${staff_user_id} to team member ${team_member_id} (${teamMember.name})`);

    return new Response(
      JSON.stringify({ success: true, message: `Linked to ${teamMember.name}` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Admin link staff team member error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
