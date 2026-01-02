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
      console.error('[get_staff_renewal_activities] Missing session token');
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
      .single();

    if (sessionError) {
      console.error('[get_staff_renewal_activities] Session lookup error:', sessionError);
      return new Response(JSON.stringify({ error: 'Invalid session' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!session || new Date(session.expires_at) < new Date() || !session.staff_users?.is_active) {
      console.error('[get_staff_renewal_activities] Session expired or user inactive');
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const agencyId = session.staff_users.agency_id;
    console.log('[get_staff_renewal_activities] Valid session for agency:', agencyId);

    const body = await req.json().catch(() => ({}));
    const { date, renewalRecordId } = body;

    // Build query
    let query = supabase
      .from('renewal_activities')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    // Filter by renewal record if provided
    if (renewalRecordId) {
      query = query.eq('renewal_record_id', renewalRecordId);
    }

    // Filter by date if provided (for activity summary)
    if (date) {
      const startOfDayStr = `${date}T00:00:00`;
      const endOfDayStr = `${date}T23:59:59`;
      query = query.gte('created_at', startOfDayStr).lte('created_at', endOfDayStr);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('[get_staff_renewal_activities] Query error:', error);
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('[get_staff_renewal_activities] Returning', data?.length || 0, 'activities');
    return new Response(JSON.stringify({ activities: data || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[get_staff_renewal_activities] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
