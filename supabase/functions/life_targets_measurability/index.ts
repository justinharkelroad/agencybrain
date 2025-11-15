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
2. A rewritten version that is MORE clear, specific, and measurable

CRITICAL: Do NOT add dates, quarters, years, or timeframes unless they are ALREADY PRESENT in the original target.
CRITICAL: Do NOT invent information. Only improve clarity of what's already stated.
Return ONLY valid JSON with no markdown formatting.`;

    const userPrompt = `Analyze these quarterly targets for measurability. For EACH item in EACH domain, provide clarity_score and rewritten_target:

BODY: ${JSON.stringify(targets.body || [])}
BEING: ${JSON.stringify(targets.being || [])}
BALANCE: ${JSON.stringify(targets.balance || [])}
BUSINESS: ${JSON.stringify(targets.business || [])}

CRITICAL RULES:
1. Do NOT add dates, quarters, or timeframes unless already in the original
2. Do NOT invent new information or metrics
3. Only clarify and make more specific what is already stated
4. Example: "Lose 20#" → "Lose 20 pounds" NOT "Lose 20 pounds by Q4 2023"

Return JSON in this EXACT format:
{
  "body": [
    {
      "original": "the original target text",
      "clarity_score": 7,
      "rewritten_target": "More specific and measurable version"
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
