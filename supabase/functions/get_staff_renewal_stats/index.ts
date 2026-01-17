import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Build query
    let query = supabase
      .from('renewal_records')
      .select('current_status, multi_line_indicator, premium_new')
      .eq('agency_id', agencyId)
      .eq('is_active', true);

    if (dateRange?.start) {
      query = query.gte('renewal_effective_date', dateRange.start);
    }
    if (dateRange?.end) {
      query = query.lte('renewal_effective_date', dateRange.end);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('[get_staff_renewal_stats] Query error:', error);
      return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Query failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calculate stats
    const records = data || [];
    const stats = {
      total: records.length,
      byStatus: {} as Record<string, number>,
      byBundling: { mono: 0, multi: 0 },
      totalPremium: 0,
    };

    records.forEach((r: any) => {
      // Count by status
      const status = r.current_status || 'unknown';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
      
      // Count by bundling (multi_line_indicator is boolean)
      if (r.multi_line_indicator) stats.byBundling.multi++;
      else stats.byBundling.mono++;
      
      // Sum premium (premium_new is already in dollars)
      stats.totalPremium += r.premium_new || 0;
    });

    console.log('[get_staff_renewal_stats] Returning stats for', records.length, 'records');
    return new Response(JSON.stringify({ stats }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[get_staff_renewal_stats] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
