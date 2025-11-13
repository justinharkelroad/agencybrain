import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { targets, tone } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const toneDescriptions = {
      inspiring: "inspiring and uplifting, focusing on potential and possibility",
      motivational: "motivational and action-oriented, focusing on drive and achievement",
      calm: "calm and peaceful, focusing on inner peace and balance",
      energizing: "energizing and powerful, focusing on strength and vitality"
    };

    const systemPrompt = `You are an expert affirmation writer specializing in theta brainwave meditation scripts.
Generate 5 powerful first-person affirmations for EACH of the 4 life categories based on the user's specific goals.
The tone should be ${toneDescriptions[tone as keyof typeof toneDescriptions]}.

Rules:
- Each affirmation must be in first person ("I am...", "I have...", "I create...")
- Keep affirmations between 10-20 words
- Make them present tense, as if already achieved
- Make them specific to the user's goals
- Each category must have exactly 5 affirmations
- Return ONLY valid JSON with no markdown formatting`;

    const userPrompt = `Generate affirmations for these goals:

BODY (Physical health, fitness, nutrition, energy):
${targets.body || 'General wellness and vitality'}

BEING (Mental health, mindfulness, spiritual practices, personal growth):
${targets.being || 'Inner peace and personal growth'}

BALANCE (Work-life harmony, time management, boundaries, relationships):
${targets.balance || 'Harmony and healthy boundaries'}

BUSINESS (Career goals, income targets, skill development, professional growth):
${targets.business || 'Career success and abundance'}

Return JSON in this exact format:
{
  "body": ["affirmation 1", "affirmation 2", "affirmation 3", "affirmation 4", "affirmation 5"],
  "being": ["affirmation 1", "affirmation 2", "affirmation 3", "affirmation 4", "affirmation 5"],
  "balance": ["affirmation 1", "affirmation 2", "affirmation 3", "affirmation 4", "affirmation 5"],
  "business": ["affirmation 1", "affirmation 2", "affirmation 3", "affirmation 4", "affirmation 5"]
}`;

    console.log('Calling OpenAI with tone:', tone);

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

    // Parse JSON from response (handle potential markdown code blocks)
    let affirmations;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      affirmations = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('Failed to parse affirmations from AI response');
    }

    // Validate structure
    const categories = ['body', 'being', 'balance', 'business'];
    for (const category of categories) {
      if (!Array.isArray(affirmations[category]) || affirmations[category].length !== 5) {
        throw new Error(`Invalid affirmations structure for category: ${category}`);
      }
    }

    console.log('Successfully generated affirmations');

    return new Response(
      JSON.stringify({ affirmations, tone }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-affirmations function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error generating affirmations' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
