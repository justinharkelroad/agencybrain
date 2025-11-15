import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, target, narrative, monthlyMissions } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    if (!domain || !target) {
      throw new Error('Domain and target are required');
    }

    console.log('Generating daily action for:', domain);

    const systemPrompt = `You are an expert life coach specializing in creating sustainable daily habits.
Generate ONE simple, repeatable daily action that will help achieve the target.

The daily action should:
- Be something they can do EVERY day
- Take 5-30 minutes
- Be specific and concrete
- Build momentum toward the target
- Be sustainable long-term

Return ONLY valid JSON with no markdown formatting.`;

    const userPrompt = `Generate a daily action for this quarterly target:

DOMAIN: ${domain.toUpperCase()}
QUARTERLY TARGET: ${target}
${narrative ? `CONTEXT: ${narrative}` : ''}
${monthlyMissions ? `MONTHLY MISSIONS: ${JSON.stringify(monthlyMissions)}` : ''}

Return JSON in this exact format:
{
  "daily_action": "Clear, specific daily action in 1-2 sentences",
  "why": "Brief explanation of how this builds toward the target",
  "tips": ["Tip 1 for consistency", "Tip 2 for success"]
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
        max_tokens: 500,
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

    let dailyAction;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      dailyAction = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('Failed to parse daily action from AI response');
    }

    // Validate structure
    if (!dailyAction.daily_action || 
        typeof dailyAction.daily_action !== 'string' ||
        !dailyAction.why ||
        !Array.isArray(dailyAction.tips)) {
      throw new Error('Invalid daily action structure');
    }

    console.log('Successfully generated daily action');

    return new Response(
      JSON.stringify({ dailyAction }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in life_targets_daily_actions function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error generating daily action' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
