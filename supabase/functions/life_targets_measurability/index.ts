import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

interface TargetsInput {
  body: string[];
  being: string[];
  balance: string[];
  business: string[];
}

interface ItemAnalysis {
  original: string;
  clarity_score: number;
  rewritten_target: string;
}

interface AnalysisOutput {
  body: ItemAnalysis[];
  being: ItemAnalysis[];
  balance: ItemAnalysis[];
  business: ItemAnalysis[];
}

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

    console.log('Analyzing measurability for targets:', JSON.stringify(targets, null, 2));

    const systemPrompt = `You are an expert life coach specializing in goal-setting and SMART criteria.
Analyze each target item and provide:
1. A clarity score (0-10) based on how specific, measurable, achievable, and relevant it is
2. A rewritten version that is MORE clear, specific, and MEASURABLE with actual numbers

CRITICAL: These are QUARTERLY targets (90-day timeframe). Add specific measurability:
- For recurring activities: suggest realistic frequency (e.g., "1-2x per week = 12-24 times this quarter")
- For quantities: suggest specific numbers, percentages, or minimum thresholds
- For vague goals: add countable metrics (e.g., "at least X", "minimum Y per week", "increase by Z%")

CRITICAL: MEASURABLE means countable/verifiable at the end of 90 days. Words like "regular", "consistent", "more" are NOT measurable unless paired with specific numbers.

CRITICAL: Do NOT add calendar dates, quarters, or years (e.g., "by Q4 2023" or "in December") - but DO add quantities and frequencies.

Return ONLY valid JSON with no markdown formatting.`;

    const userPrompt = `Analyze these QUARTERLY (90-day) targets for measurability. For EACH item in EACH domain, provide clarity_score and rewritten_target with SPECIFIC NUMBERS:

BODY: ${JSON.stringify(targets.body || [])}
BEING: ${JSON.stringify(targets.being || [])}
BALANCE: ${JSON.stringify(targets.balance || [])}
BUSINESS: ${JSON.stringify(targets.business || [])}

CRITICAL RULES FOR MEASURABILITY:
1. ADD specific numbers, frequencies, or percentages to make targets countable
2. For recurring activities, suggest realistic frequencies for 90 days:
   - "Date my wife" → "Have at least 12 date nights with my wife (1x per week)" 
   - "Exercise" → "Complete 40+ workout sessions (3-4x per week)"
   - "Pray" → "Spend 15 minutes in prayer daily (90 sessions)"
3. For business/financial goals, suggest quantities or percentages:
   - "Sell more insurance" → "Increase quarterly premium sales by 20%"
   - "Sell more insurance" → "Close at least 15 new insurance policies"
   - "Grow revenue" → "Add $50,000 in new quarterly revenue"
4. For weight/fitness, use specific measurements:
   - "Lose weight" → "Lose 15-20 pounds"
   - "Get stronger" → "Increase bench press by 20 pounds"
5. Use measurable language: "at least X", "minimum Y per week", "X-Y range", "increase by Z%", "X+ times"
6. AVOID leaving targets vague: "regular", "consistent", "more", "better" are NOT measurable alone
7. DO NOT add calendar dates or timeframes (no "by March" or "in Q2") - but DO add frequencies and quantities

Return JSON in this EXACT format:
{
  "body": [
    {
      "original": "the original target text",
      "clarity_score": 7,
      "rewritten_target": "Specific measurable version with numbers"
    }
  ],
  "being": [...],
  "balance": [...],
  "business": [...]
}

IMPORTANT: Return one analysis object for EACH item in EACH domain array. If a domain has 2 items, return 2 analysis objects for that domain.`;

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
        max_tokens: 2000,
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

    let analysis: AnalysisOutput;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('Failed to parse analysis from AI response');
    }

    // Validate structure
    const domains = ['body', 'being', 'balance', 'business'] as const;
    for (const domain of domains) {
      if (!Array.isArray(analysis[domain])) {
        throw new Error(`Invalid analysis structure: ${domain} must be an array`);
      }
      
      for (const item of analysis[domain]) {
        if (!item.original || 
            typeof item.clarity_score !== 'number' ||
            !item.rewritten_target) {
          throw new Error(`Invalid item structure in domain: ${domain}`);
        }
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
