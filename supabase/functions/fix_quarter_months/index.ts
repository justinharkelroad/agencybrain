import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORRECT_MONTHS: Record<string, string[]> = {
  'Q1': ['January', 'February', 'March'],
  'Q2': ['April', 'May', 'June'],
  'Q3': ['July', 'August', 'September'],
  'Q4': ['October', 'November', 'December'],
};

function remapMissionsToCorrectMonths(missions: any, quarter: string): any {
  if (!missions || typeof missions !== 'object') return missions;
  
  const quarterPart = quarter.split('-')[1] as keyof typeof CORRECT_MONTHS;
  const correctMonths = CORRECT_MONTHS[quarterPart];
  
  if (!correctMonths) return missions;
  
  const remapped: any = {};
  
  // For each target (target1, target2)
  Object.keys(missions).forEach(targetKey => {
    if (missions[targetKey] && typeof missions[targetKey] === 'object') {
      remapped[targetKey] = {};
      
      // Get all month entries and sort them
      const monthEntries = Object.entries(missions[targetKey]);
      
      // Map to correct months in order
      monthEntries.forEach(([_, value], index) => {
        if (index < correctMonths.length) {
          remapped[targetKey][correctMonths[index]] = value;
        }
      });
    }
  });
  
  return remapped;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { userId, quarter } = await req.json();

    if (!userId || !quarter) {
      throw new Error('userId and quarter are required');
    }

    console.log(`Fixing month labels for user ${userId}, quarter ${quarter}`);

    // Fetch the existing data
    const { data: existing, error: fetchError } = await supabase
      .from('life_targets_quarterly')
      .select('*')
      .eq('user_id', userId)
      .eq('quarter', quarter)
      .single();

    if (fetchError) throw fetchError;
    if (!existing) throw new Error('No data found for this quarter');

    // Remap all monthly missions to correct months
    const correctedData = {
      body_monthly_missions: remapMissionsToCorrectMonths(existing.body_monthly_missions, quarter),
      being_monthly_missions: remapMissionsToCorrectMonths(existing.being_monthly_missions, quarter),
      balance_monthly_missions: remapMissionsToCorrectMonths(existing.balance_monthly_missions, quarter),
      business_monthly_missions: remapMissionsToCorrectMonths(existing.business_monthly_missions, quarter),
      updated_at: new Date().toISOString(),
    };

    // Update the record
    const { error: updateError } = await supabase
      .from('life_targets_quarterly')
      .update(correctedData)
      .eq('user_id', userId)
      .eq('quarter', quarter);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Month labels corrected',
        correctedData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Fix quarter months error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
