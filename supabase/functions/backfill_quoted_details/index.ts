import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' }
        }
      }
    );

    const { agencySlug, daysBack = 30 } = await req.json();

    if (!agencySlug) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: agencySlug' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get agency ID from slug
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('id')
      .eq('slug', agencySlug)
      .single();

    if (agencyError || !agency) {
      console.error('Agency lookup error:', agencyError);
      return new Response(
        JSON.stringify({ error: 'Agency not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Call the backfill function
    const { data, error } = await supabase.rpc('backfill_quoted_details_for_agency', {
      p_agency_id: agency.id,
      p_days_back: daysBack
    });

    if (error) {
      console.error('Backfill error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to backfill quoted details' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Backfill completed for agency ${agencySlug}:`, data);

    return new Response(
      JSON.stringify({ 
        success: true,
        result: data
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Backfill function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});