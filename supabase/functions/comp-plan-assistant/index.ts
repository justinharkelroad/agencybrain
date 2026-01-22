import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

// ============ CAPABILITY MANIFEST ============
// This tells Claude exactly what the comp plan system can do
const CAPABILITY_MANIFEST = `
## COMP PLAN SCHEMA - What You Can Configure

### Basic Settings
- **name**: Plan name (string, required)
- **description**: Plan description (string, optional)
- **is_active**: Whether plan is active (boolean, default true)

### Payout Configuration
- **payout_type**: How commission is calculated
  - "percent_of_premium" - Percentage of written premium
  - "flat_per_item" - Flat dollar amount per item/policy written
  - "flat_per_policy" - Flat dollar amount per policy
  - "flat_per_household" - Flat dollar amount per household

- **tier_metric**: What metric determines tier qualification
  - "items" - Number of items written
  - "policies" - Number of policies written
  - "premium" - Dollar amount of written premium
  - "points" - Custom points (requires point_values config)
  - "households" - Number of households sold

- **chargeback_rule**: How chargebacks are handled
  - "none" - No chargeback deductions
  - "three_month" - Only if cancelled within first 90 days
  - "full" - All chargebacks

  WHEN ASKING ABOUT CHARGEBACKS, just ask:
  "Do you deduct chargebacks from commission? Options:
   • Only cancellations within first 90 days
   • All chargebacks
   • No chargebacks"
  Don't try to interpret terms like "first term" - just present the options.

### Commission Tiers (Array)
Each tier has:
- **min_threshold**: Minimum metric value to qualify (number)
- **commission_value**: The commission rate/amount for this tier (number)

Example: [
  { min_threshold: 0, commission_value: 0 },
  { min_threshold: 200, commission_value: 50 },
  { min_threshold: 300, commission_value: 75 },
  { min_threshold: 400, commission_value: 100 }
]

### Brokered Business
- **brokered_payout_type**: "flat_per_item", "percent_of_premium", or "tiered"
- **brokered_flat_rate**: The rate for non-tiered brokered (number)
- **brokered_counts_toward_tier**: Whether brokered counts toward tier threshold (boolean)
- **brokered_tiers**: Tier array for tiered brokered (same structure as tiers)

### Bundle Type Configuration (bundle_configs)
Configure different rates for Monoline vs Standard vs Preferred bundles:
{
  "monoline": { "enabled": true, "payout_type": "flat_per_item", "rate": 40 },
  "standard": { "enabled": true, "payout_type": "flat_per_item", "rate": 50 },
  "preferred": { "enabled": true, "payout_type": "flat_per_item", "rate": 60 }
}

### Product-Specific Rates (product_rates)
Configure different rates per product (overrides bundle_configs):
{
  "Auto": { "payout_type": "flat_per_item", "rate": 25 },
  "Homeowners": { "payout_type": "flat_per_item", "rate": 40 },
  "Life": { "payout_type": "percent_of_premium", "rate": 10 }
}

### Point Values (point_values)
When tier_metric is "points", assign custom point weights:
{
  "Auto": 10,
  "Homeowners": 20,
  "Renters": 5,
  "Life": 15,
  "Umbrella": 10
}

### Bundling Multipliers (bundling_multipliers)
Bonus multiplier based on bundling percentage:
{
  "thresholds": [
    { "min_percent": 50, "multiplier": 1.05 },
    { "min_percent": 70, "multiplier": 1.10 },
    { "min_percent": 85, "multiplier": 1.15 }
  ]
}

### Commission Modifiers (commission_modifiers)
**Self-Gen Requirement** - Minimum self-generated business percentage:
{
  "self_gen_requirement": {
    "min_percent": 25,
    "source": "written",  // or "issued"
    "affects_qualification": true,  // fails tier if not met
    "affects_payout": false
  }
}

**Self-Gen Kicker** - Bonus for high self-gen percentage:
{
  "self_gen_kicker": {
    "enabled": true,
    "type": "per_item",  // or "per_policy", "per_household"
    "amount": 5,
    "min_self_gen_percent": 30
  }
}

## WHAT CANNOT BE CONFIGURED (Requires Custom Development)
- OR-based tier qualification (e.g., "50 items OR $30k premium")
- Multiple tier metrics simultaneously
- Time-based tier changes (different rates by month)
- Team-based bonuses (based on team performance)
- Cross-plan dependencies
- Custom formulas or calculations
`;

const SYSTEM_PROMPT = `You are a compensation plan configuration assistant for AgencyBrain, an insurance agency management platform.

Your job is to help users set up commission/compensation plans for their insurance sales team by:
1. Understanding their requirements (from conversation OR uploaded documents)
2. Mapping their requirements to our system's capabilities
3. Generating a configuration when ready

${CAPABILITY_MANIFEST}

## YOUR BEHAVIOR

### When analyzing a document or user description:
1. Extract all compensation-related information
2. Map each element to our schema fields
3. Ask clarifying questions for ambiguous items
4. Keep responses simple and conversational - avoid technical jargon

### Response Style:
- Be conversational and friendly
- Use simple bullet points and checkmarks
- NEVER show JSON or code to the user - they don't need to see technical details
- Keep responses concise (under 200 words when possible)

### When you have enough information to create the plan:
1. Summarize what you understood with checkmarks (✅)
2. Tell the user: "Your plan is ready! Click **'Open in Builder'** below to review and create it."
3. THEN output the JSON config block (the system extracts this automatically - user won't see it)

### Response Format when ready:
✅ [Key point 1]
✅ [Key point 2]
✅ [Key point 3]

Your plan is ready! Click **"Open in Builder"** below to review and finalize it.

\`\`\`json
{ ... your config here ... }
\`\`\`

### If you need more information:
Just ask simple, direct questions. One or two at a time max.

### Important Rules:
1. NEVER show JSON/code to users - it confuses them
2. NEVER promise features that aren't in the capability manifest
3. ALWAYS ask for clarification rather than guessing - especially for:
   - "First term" or "policy term" (ask: how many months?)
   - Ambiguous time periods
   - Vague percentage references
4. If something can't be configured, briefly mention it but don't dwell on it
5. Keep the conversation moving toward a complete configuration
6. When in doubt, ASK - don't assume`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CompPlanConfig {
  name?: string;
  description?: string;
  is_active?: boolean;
  payout_type?: string;
  tier_metric?: string;
  chargeback_rule?: string;
  tiers?: Array<{ min_threshold: number; commission_value: number }>;
  brokered_payout_type?: string;
  brokered_flat_rate?: number;
  brokered_counts_toward_tier?: boolean;
  brokered_tiers?: Array<{ min_threshold: number; commission_value: number }>;
  bundle_configs?: Record<string, { enabled: boolean; payout_type: string; rate: number }>;
  product_rates?: Record<string, { payout_type: string; rate: number }>;
  point_values?: Record<string, number>;
  bundling_multipliers?: { thresholds: Array<{ min_percent: number; multiplier: number }> };
  commission_modifiers?: {
    self_gen_requirement?: {
      min_percent: number;
      source: 'written' | 'issued';
      affects_qualification: boolean;
      affects_payout: boolean;
    };
    self_gen_kicker?: {
      enabled: boolean;
      type: 'per_item' | 'per_policy' | 'per_household';
      amount: number;
      min_self_gen_percent: number;
    };
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      message,
      conversation_history = [],
      document_content = null,
      document_type = null,
      agency_id = null,
      user_id = null
    } = await req.json();

    console.log('Comp Plan Assistant request:', {
      message: message?.substring(0, 100),
      hasDocument: !!document_content,
      documentType: document_type,
      historyLength: conversation_history.length
    });

    if (!ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }

    // Build messages array for Claude
    const messages: Array<{ role: string; content: any }> = [];

    // Add conversation history
    for (const msg of conversation_history.slice(-10)) {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      });
    }

    // Build current message content
    let currentContent: any[] = [];

    // If document is provided, add it first
    if (document_content) {
      if (document_type === 'image' || document_type === 'pdf') {
        // For images/PDFs, Claude can process them directly via base64
        currentContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: document_type === 'pdf' ? 'application/pdf' : 'image/png',
            data: document_content
          }
        });
      } else {
        // For text/extracted content
        currentContent.push({
          type: 'text',
          text: `[UPLOADED DOCUMENT CONTENT]\n${document_content}\n[END DOCUMENT]`
        });
      }
    }

    // Add user message
    if (message) {
      currentContent.push({
        type: 'text',
        text: message
      });
    }

    messages.push({
      role: 'user',
      content: currentContent.length === 1 && currentContent[0].type === 'text'
        ? currentContent[0].text
        : currentContent
    });

    // Call Claude API
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages
      })
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      console.error('Anthropic API error:', errorText);
      throw new Error(`Anthropic API error: ${anthropicResponse.status}`);
    }

    const anthropicData = await anthropicResponse.json();
    const assistantResponse = anthropicData.content?.[0]?.text ||
      "I'm having trouble processing that. Please try again or contact support.";

    console.log('Assistant response generated, length:', assistantResponse.length);

    // Try to extract JSON config from the response if present
    let extractedConfig: CompPlanConfig | null = null;
    const jsonMatch = assistantResponse.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        extractedConfig = JSON.parse(jsonMatch[1]);
        console.log('Extracted config:', extractedConfig ? Object.keys(extractedConfig) : 'null');
      } catch (e) {
        console.log('Could not parse JSON from response');
      }
    }

    // Save conversation if we have agency context
    if (agency_id && user_id) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: existingConvo } = await supabase
          .from('comp_plan_assistant_conversations')
          .select('id, messages')
          .eq('user_id', user_id)
          .eq('agency_id', agency_id)
          .gte('created_at', today)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const newMessages = [
          ...conversation_history,
          { role: 'user', content: message, timestamp: new Date().toISOString() },
          { role: 'assistant', content: assistantResponse, timestamp: new Date().toISOString() }
        ];

        if (existingConvo) {
          await supabase
            .from('comp_plan_assistant_conversations')
            .update({
              messages: newMessages,
              extracted_config: extractedConfig,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingConvo.id);
        } else {
          await supabase
            .from('comp_plan_assistant_conversations')
            .insert({
              user_id,
              agency_id,
              messages: newMessages,
              extracted_config: extractedConfig
            });
        }
      } catch (saveError) {
        console.error('Error saving conversation:', saveError);
        // Don't fail the request if save fails
      }
    }

    return new Response(
      JSON.stringify({
        response: assistantResponse,
        extracted_config: extractedConfig,
        has_config: !!extractedConfig
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Comp Plan Assistant error:', error);
    return new Response(
      JSON.stringify({
        response: "I'm having trouble right now. Please try again or contact info@standardplaybook.com for help.",
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
