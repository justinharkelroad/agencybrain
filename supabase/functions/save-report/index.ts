import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyRequest, isVerifyError } from "../_shared/verifyRequest.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // JWT-auth only endpoint. Staff users do not have profiles-backed user IDs for saved_reports.
    const authResult = await verifyRequest(req);
    if (isVerifyError(authResult) || authResult.mode !== 'supabase' || !authResult.userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get user's agency_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('id', authResult.userId)
      .single();

    if (!profile?.agency_id) {
      return new Response(
        JSON.stringify({ error: 'User has no agency' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { report_type, title, input_data, results_data } = body;

    if (!report_type || !title || !input_data || !results_data) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['staff_roi', 'vendor_verifier', 'data_lead', 'mailer', 'live_transfer', 'call_efficiency'].includes(report_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid report type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: report, error: insertError } = await supabase
      .from('saved_reports')
      .insert({
        user_id: authResult.userId,
        agency_id: profile.agency_id,
        report_type,
        title,
        input_data,
        results_data,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save report' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Report saved: ${report.id} by user ${authResult.userId}`);

    return new Response(
      JSON.stringify({ success: true, report }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
