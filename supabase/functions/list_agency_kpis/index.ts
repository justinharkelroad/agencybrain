import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

    // Create service role client for database queries
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const agencyId = authResult.agencyId;

    // Get current (active) KPI labels for the agency
    // Join kpis to kpi_versions where valid_to IS NULL (current version)
    const { data, error } = await supabase
      .from('kpis')
      .select(`
        key,
        kpi_versions!inner(label, valid_to)
      `)
      .eq('agency_id', agencyId)
      .eq('is_active', true)
      .is('kpi_versions.valid_to', null);
    
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
    const labelMap: Record<string, string> = {};
    data?.forEach((kpi: any) => {
      const currentVersion = kpi.kpi_versions?.[0];
      if (currentVersion) {
        labelMap[kpi.key] = currentVersion.label;
      }
    });

    console.log(`list_agency_kpis [${authResult.mode}]: Found ${Object.keys(labelMap).length} KPI labels for agency ${agencyId}`);

    return new Response(
      JSON.stringify({ labels: labelMap }),
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
