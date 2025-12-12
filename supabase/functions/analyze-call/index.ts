import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { call_id } = await req.json();

    if (!call_id) {
      return new Response(
        JSON.stringify({ error: "Missing call_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the call record with template
    const { data: call, error: callError } = await supabase
      .from("agency_calls")
      .select(`
        *,
        call_scoring_templates (
          name,
          system_prompt,
          skill_categories
        )
      `)
      .eq("id", call_id)
      .single();

    if (callError || !call) {
      return new Response(
        JSON.stringify({ error: "Call not found", details: callError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!call.transcript) {
      return new Response(
        JSON.stringify({ error: "Call has no transcript" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const template = call.call_scoring_templates;
    const skillCategories = template?.skill_categories || ["Rapport", "Discovery", "Coverage", "Closing", "Cross-Sell"];

    // Build the analysis prompt
    const systemPrompt = `You are an expert insurance sales coach analyzing recorded sales calls. Your job is to provide detailed, actionable coaching feedback.

${template?.system_prompt || "Analyze this insurance sales call and provide detailed coaching feedback."}

You must respond with ONLY valid JSON - no markdown, no explanation, just the JSON object.`;

    const userPrompt = `Analyze this insurance sales call transcript and score the agent's performance.

## Skill Categories to Score (0-100 each)
${skillCategories.map((skill: string, i: number) => `${i + 1}. ${skill}`).join("\n")}

## Required JSON Response Format
{
  "overall_score": <number 0-100>,
  "skill_scores": {
    ${skillCategories.map((skill: string) => `"${skill}": <number 0-100>`).join(",\n    ")}
  },
  "summary": "<2-3 sentence summary of the call>",
  "client_profile": {
    "name": "<client name if mentioned>",
    "current_carrier": "<their current insurance company>",
    "policies_discussed": ["<list of policy types discussed>"],
    "estimated_premium": "<if mentioned>",
    "hot_buttons": ["<key concerns or motivations>"]
  },
  "discovery_wins": ["<specific things the agent did well in discovery>"],
  "critical_gaps": ["<important things the agent missed or should improve>"],
  "closing_attempts": ["<any closing attempts made and their effectiveness>"],
  "missed_signals": ["<buying signals or objections the agent missed>"],
  "coaching_recommendations": ["<3-5 specific actionable recommendations>"],
  "notable_quotes": ["<1-2 notable quotes from the call>"]
}

## Call Transcript
${call.transcript}`;

    console.log("Sending transcript to GPT-4o for analysis...");

    // Call OpenAI API
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI API error:", errorText);
      return new Response(
        JSON.stringify({ error: "AI analysis failed", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiResult = await openaiResponse.json();
    const analysisText = openaiResult.choices?.[0]?.message?.content;

    if (!analysisText) {
      return new Response(
        JSON.stringify({ error: "No analysis returned from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Raw AI response:", analysisText.substring(0, 500));

    // Parse the JSON response
    let analysis;
    try {
      // Clean up potential markdown formatting
      let cleanJson = analysisText.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.slice(7);
      }
      if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.slice(3);
      }
      if (cleanJson.endsWith("```")) {
        cleanJson = cleanJson.slice(0, -3);
      }
      analysis = JSON.parse(cleanJson.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI analysis", raw: analysisText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the call record with analysis results
    const { error: updateError } = await supabase
      .from("agency_calls")
      .update({
        overall_score: analysis.overall_score,
        skill_scores: analysis.skill_scores,
        summary: analysis.summary,
        client_profile: analysis.client_profile,
        discovery_wins: analysis.discovery_wins,
        critical_gaps: analysis.critical_gaps,
        closing_attempts: analysis.closing_attempts,
        missed_signals: analysis.missed_signals,
        premium_analysis: {
          coaching_recommendations: analysis.coaching_recommendations,
          notable_quotes: analysis.notable_quotes,
        },
        status: "analyzed",
      })
      .eq("id", call_id);

    if (updateError) {
      console.error("Failed to update call record:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to save analysis", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Analysis complete and saved for call:", call_id);

    return new Response(
      JSON.stringify({
        success: true,
        call_id,
        analysis,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
