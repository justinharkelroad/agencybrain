import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyRequest, isVerifyError } from "../_shared/verifyRequest.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify request using dual-mode auth (Supabase JWT or Staff session)
    const authResult = await verifyRequest(req);
    
    if (isVerifyError(authResult)) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { 
          status: authResult.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse request body to get optional role filter
    let role: string | undefined;
    try {
      const body = await req.json();
      role = body?.role;
    } catch {
      // No body or invalid JSON - role stays undefined
    }

    // Create service role client for database queries
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const agencyId = authResult.agencyId;

    // Build query for current (active) KPI labels
    // Join kpis to kpi_versions where valid_to IS NULL (current version)
    let query = supabase
      .from('kpis')
      .select(`
        key,
        role,
        kpi_versions!inner(label, valid_to)
      `)
      .eq('agency_id', agencyId)
      .eq('is_active', true)
      .is('kpi_versions.valid_to', null);
    
    // Filter by role if provided (include role-specific OR agency-wide NULL role)
    if (role) {
      query = query.or(`role.eq.${role},role.is.null`);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching KPI labels:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch KPI labels' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Build a map of slug -> current label
    // Deduplicate: role-specific labels take priority over NULL role labels
    const labelMap: Record<string, string> = {};
    const nullLabels: Record<string, string> = {};
    
    data?.forEach((kpi: any) => {
      const currentVersion = kpi.kpi_versions?.[0];
      if (currentVersion) {
        if (kpi.role === role) {
          // Role-specific takes priority
          labelMap[kpi.key] = currentVersion.label;
        } else if (kpi.role === null && !labelMap[kpi.key]) {
          // NULL fallback only if no role-specific exists yet
          nullLabels[kpi.key] = currentVersion.label;
        }
      }
    });

    // Merge: NULL labels first, then role-specific (role-specific wins)
    const mergedLabels = { ...nullLabels, ...labelMap };

    console.log(`list_agency_kpis [${authResult.mode}]: Found ${Object.keys(mergedLabels).length} KPI labels for agency ${agencyId}${role ? ` (role: ${role})` : ''}`);

    return new Response(
      JSON.stringify({ labels: mergedLabels }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('List agency kpis error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});