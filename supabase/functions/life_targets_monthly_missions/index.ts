import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, target, narrative, quarter } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    if (!domain || !target) {
      throw new Error('Domain and target are required');
    }

    console.log('Generating monthly missions for:', { domain, quarter });

    // Parse quarter to get month names (e.g., "Q1 2025" -> Jan, Feb, Mar)
    const quarterMatch = quarter?.match(/Q(\d)/);
    const quarterNum = quarterMatch ? parseInt(quarterMatch[1]) : 1;
    const monthNames = [
      ['Jan', 'Feb', 'Mar'],
      ['Apr', 'May', 'Jun'],
      ['Jul', 'Aug', 'Sep'],
      ['Oct', 'Nov', 'Dec']
    ][quarterNum - 1] || ['Month 1', 'Month 2', 'Month 3'];

    const systemPrompt = `You are an expert life coach specializing in breaking down quarterly goals into actionable monthly missions.
Generate 3 progressive monthly missions that build toward the quarterly target.

Each mission should:
- Be specific and actionable
- Build progressively (Month 1 → Month 2 → Month 3)
- Be achievable within one month
- Directly contribute to the quarterly target

Return ONLY valid JSON with no markdown formatting.`;

    const userPrompt = `Generate monthly missions for this quarterly target:

DOMAIN: ${domain.toUpperCase()}
QUARTERLY TARGET: ${target}
${narrative ? `CONTEXT: ${narrative}` : ''}
QUARTER: ${quarter || 'Current Quarter'}

The three months are: ${monthNames.join(', ')}

Return JSON in this exact format:
{
  "${monthNames[0]}": ["Mission 1 for ${monthNames[0]}", "Mission 2 for ${monthNames[0]}", "Mission 3 for ${monthNames[0]}"],
  "${monthNames[1]}": ["Mission 1 for ${monthNames[1]}", "Mission 2 for ${monthNames[1]}", "Mission 3 for ${monthNames[1]}"],
  "${monthNames[2]}": ["Mission 1 for ${monthNames[2]}", "Mission 2 for ${monthNames[2]}", "Mission 3 for ${monthNames[2]}"]
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log('OpenAI raw response:', content);

    let missions;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      missions = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('Failed to parse missions from AI response');
    }

    // Validate structure
    for (const month of monthNames) {
      if (!Array.isArray(missions[month]) || missions[month].length !== 3) {
        throw new Error(`Invalid missions structure for month: ${month}`);
      }
    }

    console.log('Successfully generated monthly missions');

    return new Response(
      JSON.stringify({ missions }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in life_targets_monthly_missions function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error generating missions' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
