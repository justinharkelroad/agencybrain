import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

interface DomainTargets {
  target1?: string;
  target2?: string;
  narrative?: string;
}

interface BatchInput {
  body?: DomainTargets;
  being?: DomainTargets;
  balance?: DomainTargets;
  business?: DomainTargets;
  quarter: string; // e.g., "Q1 2025"
}

interface MonthlyMission {
  mission: string;
  why: string;
}

interface TargetMissions {
  [month: string]: MonthlyMission; // e.g., "January", "February", "March"
}

interface DomainMissions {
  target1?: TargetMissions;
  target2?: TargetMissions;
}

interface MissionsOutput {
  body?: DomainMissions;
  being?: DomainMissions;
  balance?: DomainMissions;
  business?: DomainMissions;
}

const getMonthsForQuarter = (quarter: string): string[] => {
  const q = quarter.toUpperCase();
  if (q.includes('Q1')) return ['January', 'February', 'March'];
  if (q.includes('Q2')) return ['April', 'May', 'June'];
  if (q.includes('Q3')) return ['July', 'August', 'September'];
  if (q.includes('Q4')) return ['October', 'November', 'December'];
  return ['Month 1', 'Month 2', 'Month 3'];
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: BatchInput = await req.json();

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    if (!input.quarter) {
      throw new Error('Quarter is required');
    }

    console.log('Generating monthly missions for batch:', JSON.stringify(input, null, 2));

    const months = getMonthsForQuarter(input.quarter);

    const systemPrompt = `You are an expert life coach specializing in breaking down quarterly goals into progressive monthly missions.
For each target provided, generate 3 monthly missions that build upon each other.

Each mission should:
- Be specific and actionable
- Build toward the quarterly target
- Progress logically from month to month
- Include a brief "why" explaining its importance

Return ONLY valid JSON with no markdown formatting.`;

    // Build the targets list for the prompt
    const targetsList: string[] = [];
    const domains = ['body', 'being', 'balance', 'business'] as const;
    
    for (const domain of domains) {
      const domainData = input[domain];
      if (domainData) {
        if (domainData.target1) {
          targetsList.push(`${domain.toUpperCase()}_TARGET1: ${domainData.target1}${domainData.narrative ? ` (Context: ${domainData.narrative})` : ''}`);
        }
        if (domainData.target2) {
          targetsList.push(`${domain.toUpperCase()}_TARGET2: ${domainData.target2}${domainData.narrative ? ` (Context: ${domainData.narrative})` : ''}`);
        }
      }
    }

    const userPrompt = `Generate monthly missions for ${input.quarter} (${months.join(', ')}) for ALL these targets:

${targetsList.join('\n\n')}

Return JSON in this EXACT format:
{
  "body": {
    "target1": {
      "${months[0]}": { "mission": "...", "why": "..." },
      "${months[1]}": { "mission": "...", "why": "..." },
      "${months[2]}": { "mission": "...", "why": "..." }
    },
    "target2": { ... }
  },
  "being": { ... },
  "balance": { ... },
  "business": { ... }
}

IMPORTANT: Only include domains and targets that were provided in the input. If a domain has only target1, don't include target2.`;

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
        max_tokens: 3500,
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

    let missions: MissionsOutput;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      missions = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('Failed to parse missions from AI response');
    }

    // Validate structure
    for (const domain of domains) {
      const domainMissions = missions[domain];
      if (!domainMissions) continue;

      for (const targetKey of ['target1', 'target2'] as const) {
        const targetMissions = domainMissions[targetKey];
        if (!targetMissions) continue;

        for (const month of months) {
          const monthMission = targetMissions[month];
          if (!monthMission || !monthMission.mission || !monthMission.why) {
            throw new Error(`Invalid mission structure for ${domain}.${targetKey}.${month}`);
          }
        }
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
