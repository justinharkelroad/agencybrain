import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
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

    // LAYER 1: Comprehensive validation - check forms AND ring_metrics
    const { data: validation, error: validationError } = await supabase
      .rpc('validate_kpi_deletion', {
        p_agency_id: agency_id,
        p_kpi_key: kpi_key
      });

    if (validationError) {
      console.error('Error validating KPI deletion:', validationError);
      // Fall back to the simpler check
      const { data: affectedForms } = await supabase
        .rpc('check_kpi_in_active_forms', {
          p_agency_id: agency_id,
          p_kpi_key: kpi_key
        });

      if (affectedForms && affectedForms.length > 0) {
        const formNames = affectedForms.map((f: any) => f.name).join(', ');
        return new Response(
          JSON.stringify({
            error: `Cannot delete "${kpi_key}" because it is currently used in: ${formNames}`,
            blocked: true
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (validation && !validation.can_delete) {
      const blockers = validation.blockers || [];
      const formBlockers = blockers.filter((b: any) => b.type === 'form');
      const ringBlockers = blockers.filter((b: any) => b.type === 'ring_metrics');

      let errorMsg = `Cannot delete "${kpi_key}" because:\n`;

      if (formBlockers.length > 0) {
        const formNames = formBlockers.map((b: any) => b.name).join(', ');
        errorMsg += `• It is used in active forms: ${formNames}\n`;
      }

      if (ringBlockers.length > 0) {
        const roles = ringBlockers.map((b: any) => b.role).join(', ');
        errorMsg += `• It is displayed in ring metrics for: ${roles}. Disable the KPI first, then delete it.\n`;
      }

      console.log(`Blocking KPI deletion:`, blockers);
      return new Response(
        JSON.stringify({
          error: errorMsg.trim(),
          blockers: blockers,
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
        JSON.stringify({ error: error.message || 'Delete failed' }),
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
