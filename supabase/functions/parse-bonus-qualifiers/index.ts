import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    
    if (!imageBase64) {
      throw new Error("No image data provided");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Calling Lovable AI Gateway for bonus qualifiers extraction...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract ONLY the PG Point Goal targets from this image. There are TWO tables:

1. "Portfolio Growth - Auto, Home, AFS" (left table) - Auto/Home goals
2. "Portfolio Growth - Other Personal Lines" (right table) - SPL goals

Each table has 7 rows. I ONLY need the GOAL column values (the point targets).
The bonus percentages are HARDCODED in our system (industry standard) - DO NOT extract them.

Return ONLY valid JSON in this exact format (no markdown, no code blocks, just raw JSON):
{
  "autoHomeTargets": [254, 1226, 2198, 3170, 4142, 5114, 6086],
  "splTargets": [442, 588, 733, 878, 1024, 1169, 1315]
}

CRITICAL INSTRUCTIONS:
- Extract ONLY the GOAL numbers (integers, remove any commas)
- autoHomeTargets: All 7 goal values from the LEFT table, sorted lowest to highest
- splTargets: All 7 goal values from the RIGHT table, sorted lowest to highest
- Each array must have exactly 7 numbers
- Do NOT include percentages - we don't need them`
              },
              {
                type: "image_url",
                image_url: { url: imageBase64 }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI Gateway returned ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    console.log("AI Response content:", content);
    
    if (!content) {
      throw new Error("No content in AI response");
    }
    
    // Parse JSON from response - handle markdown code blocks if present
    let jsonStr = content.trim();
    
    // Remove markdown code blocks if present
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();
    
    // Find JSON object
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in response:", content);
      throw new Error("Could not parse AI response as JSON");
    }
    
    const extracted = JSON.parse(jsonMatch[0]);
    
    // Validate structure - now we expect just arrays of targets
    if (!extracted.autoHomeTargets || !Array.isArray(extracted.autoHomeTargets)) {
      throw new Error("Missing or invalid autoHomeTargets in response");
    }
    if (!extracted.splTargets || !Array.isArray(extracted.splTargets)) {
      throw new Error("Missing or invalid splTargets in response");
    }
    
    // HARDCODED tier percentages - Allstate industry standard
    const AUTO_HOME_PERCENTAGES = [0.0005, 0.005, 0.010, 0.015, 0.020, 0.025, 0.030];
    const SPL_PERCENTAGES = [0.0005, 0.0015, 0.003, 0.0045, 0.006, 0.008, 0.010];
    
    // Validate and clean target data
    const validateTargets = (targets: any[], name: string): number[] => {
      if (targets.length !== 7) {
        console.warn(`${name} has ${targets.length} targets instead of expected 7`);
      }
      return targets
        .map(t => Math.round(Number(t) || 0))
        .filter(t => t > 0)
        .sort((a, b) => a - b)
        .slice(0, 7);
    };
    
    const ahTargets = validateTargets(extracted.autoHomeTargets, "autoHomeTargets");
    const splTargets = validateTargets(extracted.splTargets, "splTargets");
    
    // Build the response in the format expected by the frontend
    // (which expects { pgPointTarget, bonusPercentage } objects)
    const result = {
      autoHomeTiers: ahTargets.map((target, i) => ({
        pgPointTarget: target,
        bonusPercentage: AUTO_HOME_PERCENTAGES[i] || 0
      })),
      splTiers: splTargets.map((target, i) => ({
        pgPointTarget: target,
        bonusPercentage: SPL_PERCENTAGES[i] || 0
      }))
    };
    
    console.log("Extracted bonus qualifiers:", JSON.stringify(result, null, 2));
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error parsing bonus qualifiers:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
