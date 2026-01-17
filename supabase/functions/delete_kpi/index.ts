import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyRequest, isVerifyError } from '../_shared/verifyRequest.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify request using dual-mode auth (Supabase JWT or staff session)
    const authResult = await verifyRequest(req);
    if (isVerifyError(authResult)) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { mode, agencyId, isManager, userId, staffUserId } = authResult;

    // Authorization: staff must be manager/owner
    if (mode === 'staff' && !isManager) {
      return new Response(
        JSON.stringify({ error: 'Manager access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { agency_id, kpi_key } = await req.json();
    
    // Validate agency_id matches authenticated user's agency
    if (agency_id !== agencyId) {
      return new Response(
        JSON.stringify({ error: 'Agency ID mismatch' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!agency_id || !kpi_key) {
      return new Response(
        JSON.stringify({ error: 'agency_id and kpi_key are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const actorId = userId || staffUserId;
    console.log(`Deleting KPI: ${kpi_key} for agency: ${agency_id} by ${mode} user: ${actorId}`);

    // Create service role client for DB operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // LAYER 1: Block deletion if KPI is used in any active forms
    // Check schema_json for selectedKpiSlug or key references
    const { data: affectedForms, error: formsError } = await supabase
      .from('form_templates')
      .select('id, name')
      .eq('agency_id', agency_id)
      .eq('is_active', true)
      .or(`schema_json::text.ilike.%"selectedKpiSlug":"${kpi_key}"%,schema_json::text.ilike.%"${kpi_key}"%`);

    if (formsError) {
      console.error('Error checking affected forms:', formsError);
      // Continue anyway - don't block on query error, let transaction handle it
    }

    if (affectedForms && affectedForms.length > 0) {
      const formNames = affectedForms.map(f => f.name).join(', ');
      console.log(`Blocking KPI deletion - used in active forms: ${formNames}`);
      return new Response(
        JSON.stringify({ 
          error: `Cannot delete "${kpi_key}" because it is currently used in these active forms: ${formNames}. To delete this KPI, first remove it from those forms or deactivate the forms, then try again.`,
          affected_forms: affectedForms.map(f => ({ id: f.id, name: f.name })),
          blocked: true
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call the database function with actual user ID for audit trail
    const { data, error } = await supabase.rpc('delete_kpi_transaction', {
      p_agency_id: agency_id,
      p_kpi_key: kpi_key,
      p_actor_id: actorId
    });

    if (error) {
      console.error('Delete KPI error:', error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Delete failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('KPI deleted successfully:', data);

    return new Response(
      JSON.stringify({ success: true, impact: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Delete KPI error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
