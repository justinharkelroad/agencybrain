import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');

    // Create Supabase client with user's JWT for RLS
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { purchase_id, staff_user_ids, start_date, timezone } = await req.json();

    if (!purchase_id || !staff_user_ids || !Array.isArray(staff_user_ids) || staff_user_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid purchase_id or staff_user_ids' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!start_date) {
      return new Response(
        JSON.stringify({ error: 'Start date is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if caller is admin (admins can set any date, including past dates)
    const { data: isAdmin } = await supabaseUser.rpc('has_role', { _user_id: user.id, _role: 'admin' });

    // Non-admin: validate start_date is a weekday (Mon-Fri)
    if (!isAdmin) {
      const startDateObj = new Date(start_date);
      const dayOfWeek = startDateObj.getDay(); // 0 = Sunday, 6 = Saturday
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return new Response(
          JSON.stringify({ error: 'Start date must be a weekday (Monday-Friday)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, agency_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !profile.agency_id) {
      return new Response(
        JSON.stringify({ error: 'User profile not found or no agency' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify purchase belongs to user's agency and has available seats
    const { data: purchase, error: purchaseError } = await supabase
      .from('challenge_purchases')
      .select('*')
      .eq('id', purchase_id)
      .eq('agency_id', profile.agency_id)
      .eq('status', 'completed')
      .single();

    if (purchaseError || !purchase) {
      console.error('Purchase error:', purchaseError);
      return new Response(
        JSON.stringify({ error: 'Purchase not found or not completed' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check available seats
    const availableSeats = purchase.quantity - purchase.seats_used;
    if (staff_user_ids.length > availableSeats) {
      return new Response(
        JSON.stringify({
          error: `Not enough seats available. Requested: ${staff_user_ids.length}, Available: ${availableSeats}`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify all staff users exist and belong to the agency
    const { data: staffUsers, error: staffError } = await supabase
      .from('staff_users')
      .select('id, team_member_id')
      .in('id', staff_user_ids)
      .eq('agency_id', profile.agency_id)
      .eq('is_active', true);

    if (staffError || !staffUsers || staffUsers.length !== staff_user_ids.length) {
      return new Response(
        JSON.stringify({ error: 'One or more staff users not found or inactive' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing assignments
    const { data: existingAssignments } = await supabase
      .from('challenge_assignments')
      .select('staff_user_id')
      .eq('purchase_id', purchase_id)
      .in('staff_user_id', staff_user_ids);

    if (existingAssignments && existingAssignments.length > 0) {
      const existingIds = existingAssignments.map(a => a.staff_user_id);
      return new Response(
        JSON.stringify({
          error: 'Some staff members are already assigned to this challenge',
          existing_ids: existingIds
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create assignments
    const assignmentData = staffUsers.map(staff => ({
      purchase_id: purchase_id,
      challenge_product_id: purchase.challenge_product_id,
      agency_id: profile.agency_id,
      staff_user_id: staff.id,
      team_member_id: staff.team_member_id,
      assigned_by: profile.id,
      start_date: start_date,
      timezone: timezone || 'America/New_York',
      status: 'active',
    }));

    const { data: assignments, error: assignmentError } = await supabase
      .from('challenge_assignments')
      .insert(assignmentData)
      .select();

    if (assignmentError || !assignments) {
      console.error('Assignment creation error:', assignmentError);
      return new Response(
        JSON.stringify({ error: 'Failed to create assignments' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Created ${assignments.length} challenge assignments for purchase ${purchase_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        assignments: assignments,
        message: `Successfully assigned ${assignments.length} staff member(s) to the challenge`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Assignment error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to assign staff' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
