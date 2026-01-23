import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sessionToken = req.headers.get('x-staff-session');
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: 'Missing session token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate session and get staff user info
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id, expires_at')
      .eq('session_token', sessionToken)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (sessionError || !session) {
      console.error('Session validation failed:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get staff user details
    const { data: staffUser, error: staffError } = await supabase
      .from('staff_users')
      .select('id, team_member_id, agency_id')
      .eq('id', session.staff_user_id)
      .single();

    if (staffError || !staffUser) {
      console.error('Staff user lookup failed:', staffError);
      return new Response(
        JSON.stringify({ error: 'Staff user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!staffUser.team_member_id) {
      return new Response(
        JSON.stringify({ error: 'Staff user not linked to team member' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get team member's role
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('role')
      .eq('id', staffUser.team_member_id)
      .single();

    const role = teamMember?.role || 'Sales';

    // Parse work_date from request body
    const body = await req.json().catch(() => ({}));
    const workDate = body.work_date;

    if (!workDate) {
      return new Response(
        JSON.stringify({ error: 'Missing work_date parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Staff dashboard: Loading data for team_member_id=${staffUser.team_member_id}, work_date=${workDate}`);

    // Load targets for this agency
    const { data: targetRows } = await supabase
      .from('targets')
      .select('metric_key, value_number, team_member_id')
      .eq('agency_id', staffUser.agency_id);

    const targetsMap: Record<string, number> = {};
    if (targetRows) {
      // First load agency defaults
      targetRows.forEach((t: any) => {
        if (!t.team_member_id) {
          targetsMap[t.metric_key] = t.value_number;
        }
      });
      // Then override with member-specific
      targetRows.forEach((t: any) => {
        if (t.team_member_id === staffUser.team_member_id) {
          targetsMap[t.metric_key] = t.value_number;
        }
      });
    }

    // Load form template for user's role to get KPIs
    const { data: formTemplate } = await supabase
      .from('form_templates')
      .select('schema_json')
      .eq('agency_id', staffUser.agency_id)
      .eq('role', role)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    // Load submission for the work date
    const { data: submissionData, error: subError } = await supabase
      .from('submissions')
      .select(`
        id,
        payload_json,
        form_template_id
      `)
      .eq('team_member_id', staffUser.team_member_id)
      .eq('work_date', workDate)
      .eq('final', true)
      .maybeSingle();

    if (subError) {
      console.error('Error loading submission:', subError);
    }

    let submissionSchema = null;
    if (submissionData?.form_template_id) {
      const { data: subFormTemplate } = await supabase
        .from('form_templates')
        .select('name, schema_json')
        .eq('id', submissionData.form_template_id)
        .single();
      
      submissionSchema = subFormTemplate;
    }

    console.log(`Staff dashboard: Found submission=${!!submissionData}, targets=${Object.keys(targetsMap).length}`);

    return new Response(
      JSON.stringify({
        success: true,
        submission: submissionData,
        submissionSchema,
        formTemplateSchema: formTemplate?.schema_json,
        targets: targetsMap,
        role
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('get_staff_dashboard error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
