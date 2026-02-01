import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

interface AssignSequenceRequest {
  sequence_id: string;
  // Either staff user or profile user (exactly one required)
  assigned_to_staff_user_id?: string;
  assigned_to_user_id?: string;
  start_date: string; // YYYY-MM-DD
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  // Either contact_id or sale_id must be provided
  contact_id?: string;  // For contact-based sequences
  sale_id?: string;     // For sale-based sequences (backward compatible)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Service role client for all DB operations
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    let agencyId: string;
    let assignedByUserId: string | null = null;
    let assignedByStaffUserId: string | null = null;

    // Check for staff session token first
    const staffSessionToken = req.headers.get('x-staff-session');
    const authHeader = req.headers.get('Authorization');

    if (staffSessionToken) {
      // Staff authentication via custom session token
      const nowISO = new Date().toISOString();
      const { data: session, error: sessionError } = await supabaseService
        .from('staff_sessions')
        .select('staff_user_id, expires_at, is_valid')
        .eq('session_token', staffSessionToken)
        .eq('is_valid', true)
        .gt('expires_at', nowISO)
        .maybeSingle();

      if (sessionError || !session) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized - invalid or expired staff session' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get staff user details
      const { data: staffUser, error: staffError } = await supabaseService
        .from('staff_users')
        .select('id, agency_id, is_active')
        .eq('id', session.staff_user_id)
        .single();

      if (staffError || !staffUser || !staffUser.is_active) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized - staff user not found or inactive' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      agencyId = staffUser.agency_id;
      assignedByStaffUserId = staffUser.id;
      console.log('[assign_onboarding_sequence] Authenticated via staff session:', staffUser.id);

    } else if (authHeader) {
      // Regular user authentication via Supabase Auth JWT
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user's agency_id
      const { data: profile } = await supabaseAuth
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();

      if (!profile?.agency_id) {
        return new Response(
          JSON.stringify({ error: 'User has no agency' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      agencyId = agencyId;
      assignedByUserId = user.id;
      console.log('[assign_onboarding_sequence] Authenticated via JWT:', user.id);

    } else {
      return new Response(
        JSON.stringify({ error: 'No authorization provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: AssignSequenceRequest = await req.json();
    const {
      contact_id,
      sale_id,
      sequence_id,
      assigned_to_staff_user_id,
      assigned_to_user_id,
      start_date,
      customer_name,
      customer_phone,
      customer_email,
    } = body;

    // Validate required fields
    if (!sequence_id || !start_date || !customer_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sequence_id, start_date, customer_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Require exactly one assignee type
    if (!assigned_to_staff_user_id && !assigned_to_user_id) {
      return new Response(
        JSON.stringify({ error: 'Either assigned_to_staff_user_id or assigned_to_user_id must be provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (assigned_to_staff_user_id && assigned_to_user_id) {
      return new Response(
        JSON.stringify({ error: 'Provide only one of assigned_to_staff_user_id or assigned_to_user_id, not both' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Require either contact_id or sale_id
    if (!contact_id && !sale_id) {
      return new Response(
        JSON.stringify({ error: 'Either contact_id or sale_id must be provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for database operations (bypasses RLS)
    const supabase = supabaseService;

    // Verify the sequence exists and belongs to this agency
    const { data: sequence, error: seqError } = await supabase
      .from('onboarding_sequences')
      .select('id, name, agency_id, is_active')
      .eq('id', sequence_id)
      .single();

    if (seqError || !sequence) {
      console.error('[assign_onboarding_sequence] Sequence not found:', seqError);
      return new Response(
        JSON.stringify({ error: 'Sequence not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (sequence.agency_id !== agencyId) {
      return new Response(
        JSON.stringify({ error: 'Sequence does not belong to your agency' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!sequence.is_active) {
      return new Response(
        JSON.stringify({ error: 'Cannot assign an inactive sequence' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the contact exists and belongs to this agency (if provided)
    if (contact_id) {
      const { data: contact, error: contactError } = await supabase
        .from('agency_contacts')
        .select('id, agency_id')
        .eq('id', contact_id)
        .single();

      if (contactError || !contact) {
        console.error('[assign_onboarding_sequence] Contact not found:', contactError);
        return new Response(
          JSON.stringify({ error: 'Contact not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (contact.agency_id !== agencyId) {
        return new Response(
          JSON.stringify({ error: 'Contact does not belong to your agency' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Verify the sale exists and belongs to this agency (if provided)
    if (sale_id) {
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('id, agency_id')
        .eq('id', sale_id)
        .single();

      if (saleError || !sale) {
        console.error('[assign_onboarding_sequence] Sale not found:', saleError);
        return new Response(
          JSON.stringify({ error: 'Sale not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (sale.agency_id !== agencyId) {
        return new Response(
          JSON.stringify({ error: 'Sale does not belong to your agency' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Verify the assignee exists and belongs to this agency
    if (assigned_to_staff_user_id) {
      // Validate staff user
      const { data: staffUser, error: staffError } = await supabase
        .from('staff_users')
        .select('id, agency_id, is_active')
        .eq('id', assigned_to_staff_user_id)
        .single();

      if (staffError || !staffUser) {
        console.error('[assign_onboarding_sequence] Staff user not found:', staffError);
        return new Response(
          JSON.stringify({ error: 'Staff user not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (staffUser.agency_id !== agencyId) {
        return new Response(
          JSON.stringify({ error: 'Staff user does not belong to your agency' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!staffUser.is_active) {
        return new Response(
          JSON.stringify({ error: 'Cannot assign to an inactive staff user' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (assigned_to_user_id) {
      // Validate profile user
      const { data: profileUser, error: profileError } = await supabase
        .from('profiles')
        .select('id, agency_id')
        .eq('id', assigned_to_user_id)
        .single();

      if (profileError || !profileUser) {
        console.error('[assign_onboarding_sequence] User profile not found:', profileError);
        return new Response(
          JSON.stringify({ error: 'User profile not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (profileUser.agency_id !== agencyId) {
        return new Response(
          JSON.stringify({ error: 'User does not belong to your agency' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if an active sequence is already assigned to this contact or sale
    if (contact_id) {
      // Check for active sequence on this contact
      const { data: existingContactInstance } = await supabase
        .from('onboarding_instances')
        .select('id, status')
        .eq('contact_id', contact_id)
        .eq('status', 'active')
        .maybeSingle();

      if (existingContactInstance) {
        return new Response(
          JSON.stringify({ error: 'A sequence is already assigned to this contact' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (sale_id) {
      // Also check for active sequence on this sale
      const { data: existingSaleInstance } = await supabase
        .from('onboarding_instances')
        .select('id, status')
        .eq('sale_id', sale_id)
        .eq('status', 'active')
        .maybeSingle();

      if (existingSaleInstance) {
        return new Response(
          JSON.stringify({ error: 'A sequence is already assigned to this sale' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create the onboarding instance
    // The trigger will automatically create all tasks
    const { data: instance, error: instanceError } = await supabase
      .from('onboarding_instances')
      .insert({
        agency_id: agencyId,
        sequence_id: sequence_id,
        contact_id: contact_id || null,
        sale_id: sale_id || null,
        customer_name: customer_name,
        customer_phone: customer_phone || null,
        customer_email: customer_email || null,
        assigned_to_staff_user_id: assigned_to_staff_user_id || null,
        assigned_to_user_id: assigned_to_user_id || null,
        assigned_by: assignedByUserId,  // null for staff users
        start_date: start_date,
        status: 'active',
      })
      .select('id')
      .single();

    if (instanceError) {
      console.error('[assign_onboarding_sequence] Failed to create instance:', instanceError);
      return new Response(
        JSON.stringify({ error: 'Failed to create onboarding instance', details: instanceError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the created tasks to return count
    const { data: tasks, error: tasksError } = await supabase
      .from('onboarding_tasks')
      .select('id')
      .eq('instance_id', instance.id);

    const taskCount = tasks?.length || 0;

    const targetLabel = contact_id ? `contact ${contact_id}` : `sale ${sale_id}`;
    const assigneeLabel = assigned_to_staff_user_id 
      ? `staff user ${assigned_to_staff_user_id}` 
      : `profile user ${assigned_to_user_id}`;
    console.log(`[assign_onboarding_sequence] Instance ${instance.id} created with ${taskCount} tasks for ${targetLabel}, assigned to ${assigneeLabel}`);

    return new Response(
      JSON.stringify({
        success: true,
        instance_id: instance.id,
        tasks_created: taskCount,
        sequence_name: sequence.name,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[assign_onboarding_sequence] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
