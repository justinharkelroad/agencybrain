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

    // Build the analysis prompt - custom insurance sales methodology
    const systemPrompt = `You are an advanced sales-performance evaluator analyzing a transcribed insurance sales call. Your mission is to:
- Extract CRM-worthy data points that directly reflect the talk path.
- Surface precision-targeted coaching insights tied to the agency's script.
- Maintain an evidence-backed, judgment-free tone.

All analysis must be:
- Specific — No vagueness or conjecture.
- Grounded — Each conclusion must cite transcript-based observations.
- Challenged — Actively attempt to disprove assumptions via cross-validation.
- Triple-Checked — Verify every item through at least two distinct signals.
- No PII — Never include last names, DOBs, specific addresses, bank/card info, SSNs.

OPERATIONAL DEFINITIONS:
- Explicit Close Attempt = a direct request for commitment today (e.g., "Let's get this started," "We can activate coverage now")
- Assumptive Ownership Phrase = language implying the decision is made (e.g., "when we switch you," "your new policy will…")
- Objection Loop = Acknowledge → Address/Reframe → Check ("does that solve it?") → Ask again

Voice profile:
- Tone: blunt, clean, directive, zero hype.
- Sentences: short, active, present tense. 6–14 words.
- POV: second person ("you"). Address the salesperson directly.
- Use imperatives for fixes.

You must respond with ONLY valid JSON - no markdown, no explanation.`;

    const userPrompt = `Analyze this insurance sales call transcript and provide a structured evaluation.

## SCORING FRAMEWORK

**1. RAPPORT (HWF Framework - Home, Work, Family)**
Objective: Build trust through genuine connection BEFORE discussing insurance.
- Home: "How long have you been here?" / "Are you from here originally?"
- Work: "Are you working or retired?" / "What kind of work do you do?"
- Family: "Do you have any kids?" / "Any family in town?"
Note: Asking about roof year or home details is NOT rapport - those are required facts. Look for EXPANSION conversations.

**2. COVERAGE & LIABILITY**
Objective: Differentiate through education, not order-taking.
- Did they educate on coverage and liability even if budget was main concern?
- Did they hold the frame while acknowledging budget?
- Did they position as advisor vs price-quoting agent?
- Look for phrases like "coverage assessment" or "I'm going to ask questions to make sure you're properly protected"

**3. CLOSING**
Objective: Use Assumptive Close Language to convert.
Requirements:
- Minimum two Assumptive Close attempts (e.g., "We'll just get this set up for you today")
- Final ask for the sale (yes/no question for finality)
- If follow-up set: must include exact date/time and clear desired outcome
- Bonus: Did they ask for referrals or additional quotes?

**4. OBJECTION HANDLING**
Objective: Use the Objection Loop to overcome resistance.
- Did they Acknowledge the concern?
- Did they Address/Reframe with value or proof?
- Did they Check if resolved ("does that solve it?")?
- Did they Ask again after handling?

## REQUIRED JSON RESPONSE FORMAT

{
  "salesperson_name": "<first name only, from transcript>",
  "potential_rank": "<VERY LOW | LOW | MEDIUM | HIGH | VERY HIGH>",
  "potential_rank_rationale": "<2-3 sentences citing specific observations, 80% prospect signals, 20% salesperson effectiveness>",
  
  "critical_assessment": "<1-2 sentence summary of the main issue or success>",
  
  "rapport_score": <0-100>,
  "rapport_failures": ["<specific failures with quotes if available>"],
  "rapport_coaching": "<one directive sentence for improvement>",
  
  "coverage_score": <0-100>,
  "coverage_failures": ["<specific failures>"],
  "coverage_coaching": "<one directive sentence>",
  
  "closing_score": <0-100>,
  "closing_failures": ["<specific failures>"],
  "closing_coaching": "<one directive sentence>",
  
  "objection_handling_score": <0-100>,
  "discovery_score": <0-100>,
  
  "execution_checklist": {
    "hwf_framework": <true/false>,
    "ask_about_work": <true/false>,
    "explain_coverage": <true/false>,
    "deductible_value": <true/false>,
    "advisor_frame": <true/false>,
    "assumptive_close": <true/false>,
    "ask_for_sale": <true/false>,
    "set_follow_up": <true/false>
  },
  
  "crm_notes": {
    "personal_rapport": "<family, work, hobbies mentioned>",
    "motivation_to_switch": "<reasons stated>",
    "coverage_gaps_discussed": "<limits, deductibles, concerns>",
    "premium_insights": "<current carrier, budget, price expectations>",
    "decision_process": "<who decides, timing, stakeholders>",
    "quote_summary": "<what was quoted>",
    "follow_up_details": "<date/time/purpose if set, otherwise 'None scheduled'>"
  },
  
  "extracted_data": {
    "client_first_name": "<first name only>",
    "current_carrier": "<carrier name>",
    "your_quote": "<monthly or annual premium quoted>",
    "competitor_quote": "<their current premium if mentioned>",
    "assets": ["<vehicles, home, etc>"],
    "timeline": "<decision timeline if mentioned>"
  },
  
  "call_outcome": "<sold | not_sold | follow_up_scheduled | undecided>",
  "summary": "<2-3 sentences: why call occurred, outcome, next step>"
}

## TRANSCRIPT
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

    // Calculate overall score as average of the three sections
    const overallScore = Math.round(
      (analysis.rapport_score + analysis.coverage_score + analysis.closing_score) / 3
    );

    // Update the call record with analysis results - mapped to new structure
    const { error: updateError } = await supabase
      .from("agency_calls")
      .update({
        overall_score: overallScore,
        potential_rank: analysis.potential_rank,
        skill_scores: {
          rapport: analysis.rapport_score,
          coverage: analysis.coverage_score,
          closing: analysis.closing_score,
          objection_handling: analysis.objection_handling_score,
          discovery: analysis.discovery_score
        },
        section_scores: {
          rapport: {
            score: analysis.rapport_score,
            failures: analysis.rapport_failures,
            coaching: analysis.rapport_coaching
          },
          coverage: {
            score: analysis.coverage_score,
            failures: analysis.coverage_failures,
            coaching: analysis.coverage_coaching
          },
          closing: {
            score: analysis.closing_score,
            failures: analysis.closing_failures,
            coaching: analysis.closing_coaching
          }
        },
        client_profile: analysis.extracted_data,
        discovery_wins: analysis.execution_checklist,
        critical_gaps: [analysis.critical_assessment],
        closing_attempts: analysis.crm_notes,
        summary: analysis.summary,
        missed_signals: [analysis.potential_rank_rationale],
        status: "analyzed",
        analyzed_at: new Date().toISOString(),
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
