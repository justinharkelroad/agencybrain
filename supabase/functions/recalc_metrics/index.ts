// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...corsHeaders
    }
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") return json(405, {code:"METHOD_NOT_ALLOWED"});
    
    const { agencyId, days = 7, memberId, start, end } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log('Recalc metrics request:', { agencyId, days, memberId, start, end });

    // Option 1: Recompute streaks for specific member and date range
    if (memberId && start && end) {
      console.log('Recomputing streaks for member:', memberId, 'from', start, 'to', end);
      const { error } = await supabase.rpc("recompute_streaks_for_member", { 
        p_member: memberId, 
        p_start: start, 
        p_end: end 
      });
      
      if (error) {
        console.error('Error recomputing streaks:', error);
        return json(500, {code:"RPC_ERROR", detail: error.message});
      }
      
      console.log('Successfully recomputed streaks');
      return json(200, {ok: true, operation: 'streak_recompute'});
    }

    // Option 2: Backfill metrics for agency's last N days
    if (!agencyId) return json(400, {code:"BAD_REQUEST", message: "agencyId required"});
    
    console.log('Backfilling metrics for agency:', agencyId, 'for last', days, 'days');
    const { error } = await supabase.rpc("backfill_metrics_last_n_days", { 
      p_agency: agencyId, 
      p_days: days 
    });
    
    if (error) {
      console.error('Error backfilling metrics:', error);
      return json(500, {code:"RPC_ERROR", detail: error.message});
    }
    
    console.log('Successfully backfilled metrics');
    return json(200, {ok: true, operation: 'backfill_metrics', days});
    
  } catch (e) {
    console.error('Server error:', e);
    return json(500, {code:"SERVER_ERROR", detail: e.message});
  }
});