import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

interface DomainInput {
  target?: string;
  monthlyMissions?: Record<string, any>;
  narrative?: string;
}

interface BatchInput {
  body?: DomainInput;
  being?: DomainInput;
  balance?: DomainInput;
  business?: DomainInput;
}

interface DailyActionsOutput {
  body: string[];
  being: string[];
  balance: string[];
  business: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: BatchInput = await req.json();

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log('Generating daily actions for batch:', JSON.stringify(input, null, 2));

    const systemPrompt = `You are an expert life coach specializing in creating sustainable daily habits.
For each domain provided, generate 10 SIMPLE daily action options that support the quarterly target.

Each action should:
- Be something they can do EVERY day
- Take 5-30 minutes
- Be specific and concrete
- Build momentum toward the target
- Be sustainable long-term

Return ONLY valid JSON with no markdown formatting. Each action should be a simple string (no objects, no metadata).`;

    // Build the input list for the prompt
    const domainInputs: string[] = [];
    const domains = ['body', 'being', 'balance', 'business'] as const;
    
    for (const domain of domains) {
      const domainData = input[domain];
      if (domainData && domainData.target) {
        let domainText = `${domain.toUpperCase()}:\n`;
        domainText += `Target: ${domainData.target}\n`;
        if (domainData.narrative) {
          domainText += `Context: ${domainData.narrative}\n`;
        }
        if (domainData.monthlyMissions) {
          domainText += `Monthly Missions: ${JSON.stringify(domainData.monthlyMissions, null, 2)}\n`;
        }
        domainInputs.push(domainText);
      }
    }

    const userPrompt = `Generate 10 daily action options for EACH of these domains:

${domainInputs.join('\n\n')}

Return JSON in this EXACT format - just arrays of simple strings:
{
  "body": [
    "Walk 10,000 steps every day",
    "Do 20 push-ups in the morning",
    "Drink 8 glasses of water",
    "Stretch for 10 minutes before bed",
    "Take the stairs instead of elevator",
    "Do a 5-minute plank",
    "Practice yoga poses for 15 minutes",
    "Track daily protein intake",
    "Meditate for 5 minutes after waking",
    "Journal about physical sensations for 5 minutes"
  ],
  "being": [...10 actions...],
  "balance": [...10 actions...],
  "business": [...10 actions...]
}

IMPORTANT: 
- Return EXACTLY 10 actions per domain
- Each action should be a simple string (no objects)
- Make actions diverse and varied
- Only include domains that were provided in the input`;

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
        max_tokens: 2500,
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

    let dailyActions: Partial<DailyActionsOutput>;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      dailyActions = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('Failed to parse daily actions from AI response');
    }

    // Validate structure
    for (const domain of domains) {
      const actions = dailyActions[domain];
      if (actions) {
        if (!Array.isArray(actions)) {
          throw new Error(`${domain} must be an array`);
        }
        if (actions.length !== 10) {
          throw new Error(`${domain} must have exactly 10 actions, got ${actions.length}`);
        }
        for (const action of actions) {
          if (typeof action !== 'string') {
            throw new Error(`All actions in ${domain} must be strings`);
          }
        }
      }
    }

    console.log('Successfully generated daily actions');

    return new Response(
      JSON.stringify({ dailyActions }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in life_targets_daily_actions function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error generating daily actions' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
