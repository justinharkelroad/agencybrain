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
                text: `Extract the bonus tier data from this image. There are TWO tables:

1. "Portfolio Growth - Auto, Home, AFS" (left table) - This is the Auto/Home table
2. "Portfolio Growth - Other Personal Lines" (right table) - This is the SPL table

Each table has 7 rows with GOAL and % BONUS columns.

Return ONLY valid JSON in this exact format (no markdown, no code blocks, just raw JSON):
{
  "autoHomeTiers": [
    { "pgPointTarget": 254, "bonusPercentage": 0.05 },
    { "pgPointTarget": 1226, "bonusPercentage": 0.50 },
    { "pgPointTarget": 2198, "bonusPercentage": 1.00 },
    { "pgPointTarget": 3170, "bonusPercentage": 1.50 },
    { "pgPointTarget": 4142, "bonusPercentage": 2.00 },
    { "pgPointTarget": 5114, "bonusPercentage": 2.50 },
    { "pgPointTarget": 6086, "bonusPercentage": 3.00 }
  ],
  "splTiers": [
    { "pgPointTarget": 442, "bonusPercentage": 0.05 },
    { "pgPointTarget": 588, "bonusPercentage": 0.15 },
    { "pgPointTarget": 733, "bonusPercentage": 0.30 },
    { "pgPointTarget": 878, "bonusPercentage": 0.45 },
    { "pgPointTarget": 1024, "bonusPercentage": 0.60 },
    { "pgPointTarget": 1169, "bonusPercentage": 0.80 },
    { "pgPointTarget": 1315, "bonusPercentage": 1.00 }
  ]
}

CRITICAL INSTRUCTIONS:
- pgPointTarget is the GOAL number (integer, remove any commas)
- bonusPercentage is the % BONUS column value. Read it EXACTLY as shown:
  - If it says "0.0500%" in the image, that equals 0.05 in the JSON
  - If it says "3.0000%" in the image, that equals 3.0 in the JSON
  - Do NOT divide by 100 - the values in the image are already the final percentages
- Sort each array by bonusPercentage ascending (lowest percentage first)
- Extract ALL 7 tiers from EACH table separately
- The LEFT table is autoHomeTiers, the RIGHT table is splTiers
- Do NOT copy data between tables - they have DIFFERENT values`
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
    
    // Validate structure
    if (!extracted.autoHomeTiers || !Array.isArray(extracted.autoHomeTiers)) {
      throw new Error("Missing or invalid autoHomeTiers in response");
    }
    if (!extracted.splTiers || !Array.isArray(extracted.splTiers)) {
      throw new Error("Missing or invalid splTiers in response");
    }
    
    // Validate and clean tier data
    // IMPORTANT: AI extracts values like 0.05 meaning "0.05%", but our system
    // stores percentages as decimals (0.0005 for 0.05%). Divide by 100 to convert.
    const validateTiers = (tiers: any[], name: string) => {
      if (tiers.length !== 7) {
        console.warn(`${name} has ${tiers.length} tiers instead of expected 7`);
      }
      return tiers.map(tier => {
        const rawPercentage = Number(tier.bonusPercentage) || 0;
        // Convert from display format (0.05 = 0.05%) to decimal format (0.0005)
        const decimalPercentage = rawPercentage / 100;
        return {
          pgPointTarget: Math.round(Number(tier.pgPointTarget) || 0),
          bonusPercentage: decimalPercentage
        };
      }).sort((a, b) => a.bonusPercentage - b.bonusPercentage);
    };
    
    const result = {
      autoHomeTiers: validateTiers(extracted.autoHomeTiers, "autoHomeTiers"),
      splTiers: validateTiers(extracted.splTiers, "splTiers")
    };
    
    console.log("Extracted bonus qualifiers:", JSON.stringify(result, null, 2));
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error parsing bonus qualifiers:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
