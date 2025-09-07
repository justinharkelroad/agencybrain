import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log("🔧 Starting Explorer data repair process...");

    // Find all quoted_household_details with generic names like "Household 1", "Household 2", etc.
    const { data: brokenRecords, error: fetchError } = await supabaseClient
      .from('quoted_household_details')
      .select(`
        id,
        household_name,
        submission_id,
        submissions(payload_json)
      `)
      .or('household_name.is.null,household_name.like.Household %');

    if (fetchError) {
      console.error("❌ Error fetching broken records:", fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch records', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔍 Found ${brokenRecords?.length || 0} records needing repair`);

    if (!brokenRecords || brokenRecords.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No records need repair', repaired: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const repairedRecords = [];
    
    for (const record of brokenRecords) {
      const payload = record.submissions?.payload_json;
      if (!payload) {
        console.log(`⚠️ No payload found for submission ${record.submission_id}`);
        continue;
      }

      console.log(`🔧 Repairing record ${record.id} from submission ${record.submission_id}`);

      // Extract prospect name from dynamic fields in the payload
      let extractedName = null;
      
      // Look for field values that might be prospect names
      for (const [key, value] of Object.entries(payload)) {
        if (key.startsWith('field_') && typeof value === 'string' && 
            value.length > 0 && value.length < 50 && 
            !value.match(/^\d+$/) && // not just numbers
            !value.includes('$') && // not currency
            !value.match(/^\d{5}(-\d{4})?$/)) { // not zip code
          extractedName = value;
          console.log(`🔍 Found prospect name in ${key}: ${extractedName}`);
          break;
        }
      }

      if (extractedName && extractedName !== record.household_name) {
        // Update the record with the extracted name
        const { error: updateError } = await supabaseClient
          .from('quoted_household_details')
          .update({ household_name: extractedName })
          .eq('id', record.id);

        if (updateError) {
          console.error(`❌ Failed to update record ${record.id}:`, updateError);
        } else {
          console.log(`✅ Updated record ${record.id}: "${record.household_name}" → "${extractedName}"`);
          repairedRecords.push({
            id: record.id,
            old_name: record.household_name,
            new_name: extractedName
          });
        }
      } else {
        console.log(`⚠️ No valid prospect name found for record ${record.id}`);
      }
    }

    // Also update the quoted_households table to match
    console.log("🔧 Updating quoted_households table to match...");
    
    for (const repaired of repairedRecords) {
      const { error: householdUpdateError } = await supabaseClient
        .from('quoted_households')
        .update({ household_name: repaired.new_name })
        .eq('submission_id', brokenRecords.find(r => r.id === repaired.id)?.submission_id);

      if (householdUpdateError) {
        console.error(`❌ Failed to update quoted_households for record ${repaired.id}:`, householdUpdateError);
      }
    }

    console.log(`✅ Repair completed. Fixed ${repairedRecords.length} records.`);

    return new Response(
      JSON.stringify({
        message: 'Repair completed successfully',
        total_checked: brokenRecords.length,
        repaired: repairedRecords.length,
        repaired_records: repairedRecords
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Repair function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});