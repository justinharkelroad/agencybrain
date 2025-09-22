import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { agencyId } = await req.json();

    if (!agencyId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: agencyId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Configure field mappings for all active form templates in the agency
    const fieldMappings = {
      quoted_details: {
        notes: "detailed_notes",
        policies_quoted: "field_1757604704272",
        items_quoted: "items_quoted",
        premium_potential_cents: "premium_potential_cents"
      }
    };

    const { data: templates, error: selectError } = await supabase
      .from('form_templates')
      .select('id, name')
      .eq('agency_id', agencyId)
      .eq('is_active', true);

    if (selectError) {
      console.error('Error selecting form templates:', selectError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch form templates' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let updatedCount = 0;
    
    for (const template of templates || []) {
      const { error: updateError } = await supabase
        .from('form_templates')
        .update({
          field_mappings: fieldMappings,
          updated_at: new Date().toISOString()
        })
        .eq('id', template.id);

      if (updateError) {
        console.error(`Error updating template ${template.id}:`, updateError);
      } else {
        updatedCount++;
        console.log(`Updated field mappings for template: ${template.name}`);
      }
    }

    // Now run backfill for this agency
    const { data: agency } = await supabase
      .from('agencies')
      .select('slug')
      .eq('id', agencyId)
      .single();

    let backfillResult = null;
    if (agency?.slug) {
      const { data: backfillData, error: backfillError } = await supabase.rpc('backfill_quoted_details_for_agency', {
        p_agency_id: agencyId,
        p_days_back: 30
      });

      if (backfillError) {
        console.error('Backfill error:', backfillError);
      } else {
        backfillResult = backfillData;
        console.log('Backfill completed:', backfillData);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        templates_updated: updatedCount,
        total_templates: templates?.length || 0,
        backfill_result: backfillResult
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Auto setup error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});