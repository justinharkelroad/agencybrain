import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { targets } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    if (!targets || typeof targets !== 'object') {
      throw new Error('Invalid targets object');
    }

    console.log('Analyzing measurability for targets:', targets);

    const systemPrompt = `You are an expert life coach specializing in goal-setting and measurement frameworks.
Analyze the user's quarterly targets and provide measurability analysis for each domain.

For each domain (body, being, balance, business), return:
- clarity_score: 0-10 (how clear and specific is the target?)
- measurability_score: 0-10 (how measurable is the target?)
- suggestions: array of 2-3 specific suggestions to make it more measurable
- suggested_metrics: array of 1-3 specific metrics they could track

Return ONLY valid JSON with no markdown formatting.`;

    const userPrompt = `Analyze these quarterly targets for measurability:

BODY: ${targets.body || 'Not specified'}
BEING: ${targets.being || 'Not specified'}
BALANCE: ${targets.balance || 'Not specified'}
BUSINESS: ${targets.business || 'Not specified'}

Return JSON in this exact format:
{
  "body": {
    "clarity_score": 8,
    "measurability_score": 7,
    "suggestions": ["Add specific weight or fitness metric", "Define workout frequency"],
    "suggested_metrics": ["Weight in lbs", "Workout days per week"]
  },
  "being": { ... },
  "balance": { ... },
  "business": { ... }
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
        temperature: 0.7,
        max_tokens: 1500,
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

    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('Failed to parse analysis from AI response');
    }

    // Validate structure
    const domains = ['body', 'being', 'balance', 'business'];
    for (const domain of domains) {
      if (!analysis[domain] || 
          typeof analysis[domain].clarity_score !== 'number' ||
          typeof analysis[domain].measurability_score !== 'number' ||
          !Array.isArray(analysis[domain].suggestions) ||
          !Array.isArray(analysis[domain].suggested_metrics)) {
        throw new Error(`Invalid analysis structure for domain: ${domain}`);
      }
    }

    console.log('Successfully generated measurability analysis');

    return new Response(
      JSON.stringify({ analysis }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in life_targets_measurability function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error analyzing measurability' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
