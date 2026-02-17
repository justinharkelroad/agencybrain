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
      console.error('[get_staff_renewal_stats] Missing session token');
      return new Response(JSON.stringify({ error: 'Missing session token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate staff session
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id, expires_at, staff_users(id, agency_id, is_active)')
      .eq('session_token', sessionToken)
      .single() as { data: any; error: any };

    if (sessionError) {
      console.error('[get_staff_renewal_stats] Session lookup error:', sessionError);
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!session || new Date(session.expires_at) < new Date() || !session.staff_users?.is_active) {
      console.error('[get_staff_renewal_stats] Session expired or user inactive');
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const agencyId = session.staff_users.agency_id;
    console.log('[get_staff_renewal_stats] Valid session for agency:', agencyId);

    const body = await req.json().catch(() => ({}));
    const { dateRange } = body;

    // Call the RPC — counts server-side, no 1,000-row PostgREST cap
    const { data, error } = await supabase.rpc('get_renewal_stats', {
      p_agency_id: agencyId,
      p_date_start: dateRange?.start || null,
      p_date_end: dateRange?.end || null,
    });

    if (error) {
      console.error('[get_staff_renewal_stats] RPC error:', error);
      return new Response(JSON.stringify({ error: error.message || 'Query failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // RPC returns a JSON object with stats + productNames
    const result = data || {};
    const stats = {
      total: result.total || 0,
      uncontacted: result.uncontacted || 0,
      pending: result.pending || 0,
      success: result.success || 0,
      unsuccessful: result.unsuccessful || 0,
      bundled: result.bundled || 0,
      monoline: result.monoline || 0,
      unknown: result.unknown || 0,
    };
    const productNames = result.productNames || [];

    console.log('[get_staff_renewal_stats] Returning stats: total=', stats.total, ', products=', productNames.length);
    return new Response(JSON.stringify({ stats, productNames }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[get_staff_renewal_stats] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
