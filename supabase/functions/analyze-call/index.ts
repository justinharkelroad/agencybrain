import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log('analyze-call invoked');
  console.log('Request method:', req.method);

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
    console.log('Call ID received:', call_id);
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
          skill_categories,
          call_type
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

    // Determine call type from template
    const callType = call.call_scoring_templates?.call_type || 'sales';
    console.log(`Analyzing ${callType} call...`);

    // Use template prompt if available, otherwise fall back to hardcoded defaults
    const templatePrompt = call.call_scoring_templates?.system_prompt;
    
    const defaultServicePrompt = `You are an advanced service-call evaluator analyzing a transcribed insurance service/customer support call. Your mission is to:
- Evaluate CSR performance across key service dimensions
- Extract CRM-worthy data points for follow-up
- Surface coaching insights tied to best practices
- Maintain an evidence-backed, professional tone

All analysis must be:
- Specific — No vagueness or conjecture.
- Grounded — Each conclusion must cite transcript-based observations.
- No PII — Never include last names, DOBs, specific addresses, bank/card info, SSNs.

Voice profile:
- Tone: supportive, constructive, clear.
- Sentences: short, active, present tense.
- POV: second person ("you"). Address the CSR directly.

You must respond with ONLY valid JSON - no markdown, no explanation.`;

    const defaultSalesPrompt = `You are an advanced sales-performance evaluator analyzing a transcribed insurance sales call. Your mission is to:
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

    const systemPrompt = templatePrompt && templatePrompt.trim().length > 0
      ? templatePrompt  // Use the custom prompt from the template
      : (callType === 'service' ? defaultServicePrompt : defaultSalesPrompt);

    // Enforce JSON-only output even if a custom template prompt asks for formatting.
    const enforcedSystemPrompt = `${systemPrompt}\n\nCRITICAL OUTPUT FORMAT: Respond with ONLY valid JSON. Do NOT use markdown. Do NOT use HTML. Do NOT add commentary.`;

    console.log('Using prompt source:', templatePrompt && templatePrompt.trim().length > 0 ? 'TEMPLATE' : 'HARDCODED DEFAULT');

    // Service call user prompt
    const serviceUserPrompt = `Analyze this insurance service/customer support call transcript and provide a structured evaluation.

## SCORING FRAMEWORK

**1. OPENING & RAPPORT**
- Did the CSR greet warmly and identify themselves?
- Did they confirm the client's identity appropriately?
- Did they establish a positive tone?

**2. LISTENING & UNDERSTANDING**
- Did they let the client fully explain their issue?
- Did they ask clarifying questions?
- Did they summarize the concern to confirm understanding?

**3. PROBLEM RESOLUTION**
- Did they provide clear, accurate information?
- Did they take ownership of the issue?
- Did they follow through on commitments?

**4. PROACTIVE SERVICE**
- Did they offer a policy review?
- Did they identify any coverage gaps or cross-sell opportunities?
- Did they ask for referrals?

**5. CLOSING & FOLLOW-UP**
- Did they confirm the resolution?
- Did they set clear expectations for next steps?
- Did they thank the client?

## REQUIRED JSON RESPONSE FORMAT

{
  "csr_name": "<first name only>",
  "client_first_name": "<first name only>",
  "section_scores": [
    {
      "section_name": "Opening & Rapport",
      "score": 8,
      "max_score": 10,
      "feedback": "<2-3 sentences of specific feedback>",
      "tip": "<1 sentence improvement tip>"
    },
    {
      "section_name": "Listening & Understanding",
      "score": 7,
      "max_score": 10,
      "feedback": "<2-3 sentences of specific feedback>",
      "tip": "<1 sentence improvement tip>"
    },
    {
      "section_name": "Problem Resolution",
      "score": 9,
      "max_score": 10,
      "feedback": "<2-3 sentences of specific feedback>",
      "tip": "<1 sentence improvement tip>"
    },
    {
      "section_name": "Proactive Service",
      "score": 5,
      "max_score": 10,
      "feedback": "<2-3 sentences of specific feedback>",
      "tip": "<1 sentence improvement tip>"
    },
    {
      "section_name": "Closing & Follow-Up",
      "score": 8,
      "max_score": 10,
      "feedback": "<2-3 sentences of specific feedback>",
      "tip": "<1 sentence improvement tip>"
    }
  ],
  "overall_score": 7.4,
  "summary": "<2-3 sentences: why call occurred, how it was handled, outcome>",
  "crm_notes": "**Personal Details**\\n- [any personal info mentioned]\\n\\n**Vehicles & Policies**\\n- [policy/vehicle details if discussed]\\n\\n**Coverage Details**\\n- [coverage info discussed]\\n\\n**Resolution / Next Step**\\n- [what was resolved or scheduled]",
  "suggestions": [
    "<specific improvement suggestion 1>",
    "<specific improvement suggestion 2>",
    "<specific improvement suggestion 3>"
  ],
  "checklist": [
    { "label": "Greeted warmly", "checked": true, "evidence": "<quote from call>" },
    { "label": "Confirmed identity", "checked": true, "evidence": "<quote>" },
    { "label": "Summarized concern", "checked": false, "evidence": null },
    { "label": "Took ownership", "checked": true, "evidence": "<quote>" },
    { "label": "Offered policy review", "checked": false, "evidence": null },
    { "label": "Asked for referral", "checked": false, "evidence": null },
    { "label": "Set clear next steps", "checked": true, "evidence": "<quote>" },
    { "label": "Thanked client", "checked": true, "evidence": "<quote>" }
  ]
}

IMPORTANT RULES:
- Score each section 0-10
- Overall score is the average of all section scores (one decimal place)
- Be specific with feedback - cite quotes when possible
- CRM notes should be formatted with markdown headers
- Checklist evidence should quote the transcript when checked=true
- First names only - no last names or PII

## TRANSCRIPT
${call.transcript}`;

    // Sales call user prompt (existing)
    const salesUserPrompt = `Analyze this insurance sales call transcript and provide a structured evaluation.

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
  "salesperson_name": "<first name of the agent from transcript, or 'Agent' if unclear>",
  "potential_rank": "<VERY LOW | LOW | MEDIUM | HIGH | VERY HIGH>",
  "potential_rank_rationale": "<3-4 sentences explaining the ranking with specific quotes and observations>",
  
  "critical_assessment": "<3-4 detailed sentences about the main issues or successes, citing specific moments from the call>",
  
  "rapport_score": <0-100>,
  "rapport_wins": ["<specific thing done well - be specific with quotes if possible>"],
  "rapport_failures": ["<specific failure 1>", "<specific failure 2 if applicable>"],
  "rapport_coaching": "<2-3 sentences of specific, actionable coaching with examples of what to say>",
  
  "coverage_score": <0-100>,
  "coverage_wins": ["<specific thing done well>"],
  "coverage_failures": ["<specific failure 1>", "<specific failure 2 if applicable>"],
  "coverage_coaching": "<2-3 sentences of specific, actionable coaching with examples>",
  
  "closing_score": <0-100>,
  "closing_wins": ["<specific thing done well - quote any close attempts>"],
  "closing_failures": ["<specific failure 1>", "<specific failure 2 if applicable>"],
  "closing_coaching": "<2-3 sentences of specific, actionable coaching with example phrases to use>",
  
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
  
  "corrective_action_plan": {
    "rapport": "<2-3 sentences with specific phrases and techniques to implement>",
    "value_building": "<2-3 sentences on how to better educate and position as advisor>",
    "closing": "<2-3 sentences on specific closing techniques and language to use>"
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
    "your_quote": "<premium quoted - format as $X/month or $X/year>",
    "competitor_quote": "<their current premium - format as $X/month or $X/year>",
    "assets": ["<vehicle 1>", "<vehicle 2>", "<home if applicable>"],
    "timeline": "<decision timeline if mentioned>"
  },
  
  "call_outcome": "<sold | not_sold | follow_up_scheduled | undecided>",
  "summary": "<2-3 sentences: why call occurred, outcome, next step>"
}

IMPORTANT RULES:
- Each section (rapport, coverage, closing) MUST have at least 1 win (something done well) and 1-2 failures
- If they did something well, acknowledge it as a win even if the overall score is low
- Coaching must be 2-3 full sentences with specific examples and phrases to use
- Critical assessment must be 3-4 sentences minimum
- Be specific - cite quotes from the transcript when possible
- Format prices consistently as $X/month or $X/year

## TRANSCRIPT
${call.transcript}`;

    const userPrompt = callType === 'service' ? serviceUserPrompt : salesUserPrompt;

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
          { role: "system", content: enforcedSystemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
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

    // Extract token usage and calculate costs
    const usage = openaiResult.usage;
    const inputTokens = usage?.prompt_tokens || 0;
    const outputTokens = usage?.completion_tokens || 0;
    
    // GPT-4o pricing: $2.50/1M input, $10/1M output
    const inputCost = (inputTokens / 1000000) * 2.50;
    const outputCost = (outputTokens / 1000000) * 10.00;
    const gptCost = inputCost + outputCost;
    
    console.log(`GPT-4o usage - Input: ${inputTokens} tokens, Output: ${outputTokens} tokens`);
    console.log(`GPT-4o cost: $${gptCost.toFixed(4)} (input: $${inputCost.toFixed(4)}, output: $${outputCost.toFixed(4)})`);

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

    // Calculate overall score based on call type
    let overallScore: number;
    if (callType === 'service') {
      // Service calls: average of section_scores array (keep 0-10 scale with 1 decimal)
      const sectionScores = analysis.section_scores || [];
      const totalScore = sectionScores.reduce((sum: number, s: any) => sum + (s.score || 0), 0);
      overallScore = sectionScores.length > 0 
        ? parseFloat((totalScore / sectionScores.length).toFixed(1))
        : 0;
    } else {
      // Sales calls: average of the three main sections
      overallScore = Math.round(
        (analysis.rapport_score + analysis.coverage_score + analysis.closing_score) / 3
      );
    }

    // Get existing whisper cost to calculate total
    const { data: existingCall } = await supabase
      .from("agency_calls")
      .select("whisper_cost")
      .eq("id", call_id)
      .single();

    const whisperCost = existingCall?.whisper_cost || 0;
    const totalCost = whisperCost + gptCost;
    console.log(`Total call cost: $${totalCost.toFixed(4)} (whisper: $${whisperCost.toFixed(4)}, gpt: $${gptCost.toFixed(4)})`);

    // Build update payload based on call type
    let updatePayload: Record<string, any> = {
      overall_score: overallScore,
      call_type: callType, // Save call_type on the call record
      summary: analysis.summary,
      gpt_input_tokens: inputTokens,
      gpt_output_tokens: outputTokens,
      gpt_cost: gptCost,
      total_cost: totalCost,
      status: "analyzed",
      analyzed_at: new Date().toISOString(),
    };

    if (callType === 'service') {
      // Service call specific fields
      updatePayload = {
        ...updatePayload,
        section_scores: analysis.section_scores,
        closing_attempts: analysis.crm_notes, // Using closing_attempts to store CRM notes
        coaching_recommendations: analysis.suggestions,
        discovery_wins: analysis.checklist,
        client_profile: {
          csr_name: analysis.csr_name,
          client_first_name: analysis.client_first_name,
        },
      };
    } else {
      // Sales call specific fields
      updatePayload = {
        ...updatePayload,
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
            wins: analysis.rapport_wins,
            failures: analysis.rapport_failures,
            coaching: analysis.rapport_coaching
          },
          coverage: {
            score: analysis.coverage_score,
            wins: analysis.coverage_wins,
            failures: analysis.coverage_failures,
            coaching: analysis.coverage_coaching
          },
          closing: {
            score: analysis.closing_score,
            wins: analysis.closing_wins,
            failures: analysis.closing_failures,
            coaching: analysis.closing_coaching
          }
        },
        client_profile: analysis.extracted_data,
        discovery_wins: analysis.execution_checklist,
        critical_gaps: {
          assessment: analysis.critical_assessment,
          rationale: analysis.potential_rank_rationale,
          corrective_plan: analysis.corrective_action_plan
        },
        closing_attempts: analysis.crm_notes,
      };
    }

    // Update the call record with analysis results
    const { error: updateError } = await supabase
      .from("agency_calls")
      .update(updatePayload)
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
