import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AssignSequenceRequest {
  sale_id: string;
  sequence_id: string;
  assigned_to_staff_user_id: string;
  start_date: string; // YYYY-MM-DD
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use anon key with user's auth for verification
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

    const body: AssignSequenceRequest = await req.json();
    const {
      sale_id,
      sequence_id,
      assigned_to_staff_user_id,
      start_date,
      customer_name,
      customer_phone,
      customer_email,
    } = body;

    // Validate required fields
    if (!sale_id || !sequence_id || !assigned_to_staff_user_id || !start_date || !customer_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for database operations (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    if (sequence.agency_id !== profile.agency_id) {
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

    // Verify the sale exists and belongs to this agency
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

    if (sale.agency_id !== profile.agency_id) {
      return new Response(
        JSON.stringify({ error: 'Sale does not belong to your agency' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the assignee exists and belongs to this agency
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

    if (staffUser.agency_id !== profile.agency_id) {
      return new Response(
        JSON.stringify({ error: 'Staff user does not belong to your agency' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if a sequence is already assigned to this sale
    const { data: existingInstance } = await supabase
      .from('onboarding_instances')
      .select('id, status')
      .eq('sale_id', sale_id)
      .in('status', ['active', 'paused'])
      .maybeSingle();

    if (existingInstance) {
      return new Response(
        JSON.stringify({ error: 'A sequence is already assigned to this sale' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the onboarding instance
    // The trigger will automatically create all tasks
    const { data: instance, error: instanceError } = await supabase
      .from('onboarding_instances')
      .insert({
        agency_id: profile.agency_id,
        sequence_id: sequence_id,
        sale_id: sale_id,
        customer_name: customer_name,
        customer_phone: customer_phone || null,
        customer_email: customer_email || null,
        assigned_to_staff_user_id: assigned_to_staff_user_id,
        assigned_by: user.id,
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

    console.log(`[assign_onboarding_sequence] Instance ${instance.id} created with ${taskCount} tasks for sale ${sale_id}`);

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
