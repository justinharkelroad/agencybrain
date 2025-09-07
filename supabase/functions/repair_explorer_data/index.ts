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

      // Extract prospect name, notes, and custom fields from quotedDetails array
      let extractedName = null;
      let extractedNotes = null;
      let extractedCustomFields = {};
      
      // First check quotedDetails array for prospect_name and detailed_notes
      const quotedDetails = payload.quotedDetails;
      if (Array.isArray(quotedDetails) && quotedDetails.length > 0) {
        for (const prospect of quotedDetails) {
          if (prospect.prospect_name && typeof prospect.prospect_name === 'string') {
            extractedName = prospect.prospect_name;
            console.log(`🔍 Found prospect name in quotedDetails: ${extractedName}`);
          }
          
          if (prospect.detailed_notes && typeof prospect.detailed_notes === 'string') {
            extractedNotes = prospect.detailed_notes;
            console.log(`🔍 Found notes in quotedDetails: ${extractedNotes}`);
          }
          
          // Extract custom fields
          Object.keys(prospect).forEach(key => {
            if (key.startsWith('field_')) {
              extractedCustomFields[key] = prospect[key];
            }
          });
          
          if (extractedName) break;
        }
      }
      
      // Fallback: Look for field values that might be prospect names
      if (!extractedName) {
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
      }

      if (extractedName && extractedName !== record.household_name) {
        // Prepare update data
        const updateData = { household_name: extractedName };
        if (Object.keys(extractedCustomFields).length > 0) {
          updateData.extras = extractedCustomFields;
        }

        // Update the record with the extracted name and custom fields
        const { error: updateError } = await supabaseClient
          .from('quoted_household_details')
          .update(updateData)
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
      const originalRecord = brokenRecords.find(r => r.id === repaired.id);
      const payload = originalRecord?.submissions?.payload_json;
      
      // Prepare household update data
      const householdUpdateData = { household_name: repaired.new_name };
      
      // Extract notes from quotedDetails if available
      if (payload?.quotedDetails && Array.isArray(payload.quotedDetails)) {
        const prospect = payload.quotedDetails.find(p => p.prospect_name === repaired.new_name);
        if (prospect?.detailed_notes) {
          householdUpdateData.notes = prospect.detailed_notes;
        }
      }

      const { error: householdUpdateError } = await supabaseClient
        .from('quoted_households')
        .update(householdUpdateData)
        .eq('submission_id', originalRecord?.submission_id);

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