import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to build dynamic service call prompt from template
function buildServiceUserPrompt(transcript: string, skillCategories: any): string {
  // Extract template sections or use defaults
  const scoredSections = skillCategories?.scoredSections || [
    { name: "Opening & Rapport", criteria: "Did the CSR greet warmly and identify themselves? Did they confirm the client's identity appropriately? Did they establish a positive tone?" },
    { name: "Listening & Understanding", criteria: "Did they let the client fully explain their issue? Did they ask clarifying questions? Did they summarize the concern to confirm understanding?" },
    { name: "Problem Resolution", criteria: "Did they provide clear, accurate information? Did they take ownership of the issue? Did they follow through on commitments?" },
    { name: "Proactive Service", criteria: "Did they offer a policy review? Did they identify any coverage gaps or cross-sell opportunities? Did they ask for referrals?" },
    { name: "Closing & Follow-Up", criteria: "Did they confirm the resolution? Did they set clear expectations for next steps? Did they thank the client?" }
  ];

  const checklistItems = skillCategories?.checklistItems || [
    { label: "Greeted warmly", criteria: "Did the CSR greet the caller warmly and professionally?" },
    { label: "Confirmed identity", criteria: "Did they verify the caller's identity?" },
    { label: "Summarized concern", criteria: "Did they summarize the caller's concern to confirm understanding?" },
    { label: "Took ownership", criteria: "Did they take ownership of the issue?" },
    { label: "Offered policy review", criteria: "Did they offer a policy review?" },
    { label: "Asked for referral", criteria: "Did they ask for referrals?" },
    { label: "Set clear next steps", criteria: "Did they set clear expectations for next steps?" },
    { label: "Thanked client", criteria: "Did they thank the client?" }
  ];

  const rawCrmSections = skillCategories?.crmSections;
  const crmSections = Array.isArray(rawCrmSections) && rawCrmSections.length > 0
    ? rawCrmSections.map((section: any) => {
        if (typeof section === 'string') {
          return { name: section, placeholder: 'Details mentioned in the call (if any)' };
        }
        return {
          name: section?.name ?? String(section),
          placeholder: section?.placeholder ?? 'Details mentioned in the call (if any)',
        };
      })
    : [
        { name: "Personal Details", placeholder: "Any personal info mentioned" },
        { name: "Vehicles & Policies", placeholder: "Policy/vehicle details if discussed" },
        { name: "Coverage Details", placeholder: "Coverage info discussed" },
        { name: "Resolution / Next Step", placeholder: "What was resolved or scheduled" },
      ];

  const summaryInstructions = skillCategories?.summaryInstructions || "2-3 sentences: why call occurred, how it was handled, outcome";
  const suggestionsCount = Number(skillCategories?.numSuggestions ?? skillCategories?.suggestionsCount ?? 3);

  // Build scoring framework dynamically
  const scoringFramework = scoredSections.map((section: any, idx: number) => 
    `**${idx + 1}. ${section.name.toUpperCase()}**\n${section.criteria}`
  ).join('\n\n');

  // Build section_scores JSON example dynamically
  const sectionScoresExample = scoredSections.map((section: any) => ({
    section_name: section.name,
    score: 8,
    max_score: 10,
    feedback: "<2-3 sentences of specific feedback>",
    tip: "<1 sentence improvement tip>"
  }));

  // Build checklist JSON example dynamically
  const checklistExample = checklistItems.map((item: any) => ({
    label: item.label,
    checked: true,
    evidence: "<quote from call or null if not observed>"
  }));

  // Build CRM notes template dynamically
  const crmNotesTemplate = crmSections.map((section: any) => 
    `**${section.name}**\\n- [${section.placeholder}]`
  ).join('\\n\\n');

  // Build suggestions array example
  const suggestionsExample = Array.from({ length: suggestionsCount }, (_, i) => 
    `<specific improvement suggestion ${i + 1}>`
  );

  return `Analyze this insurance service/customer support call transcript and provide a structured evaluation.

## SCORING FRAMEWORK

${scoringFramework}

## CHECKLIST CRITERIA

${checklistItems.map((item: any) => `- **${item.label}**: ${item.criteria || 'Did this occur during the call?'}`).join('\n')}

## REQUIRED JSON RESPONSE FORMAT

{
  "csr_name": "<first name only>",
  "client_first_name": "<first name only>",
  "section_scores": ${JSON.stringify(sectionScoresExample, null, 4)},
  "overall_score": 7.4,
  "summary": "<${summaryInstructions}>",
  "crm_notes": "${crmNotesTemplate}",
  "suggestions": ${JSON.stringify(suggestionsExample)},
  "checklist": ${JSON.stringify(checklistExample, null, 4)}
}

IMPORTANT RULES:
- Score each section 0-10
- Overall score is the average of all section scores (one decimal place)
- Be specific with feedback - cite quotes when possible
- CRM notes should be formatted with markdown headers
- Checklist evidence should quote the transcript when checked=true
- First names only - no last names or PII

## TRANSCRIPT
${transcript}`;
}

// Helper function to build dynamic sales call prompt from template
function buildSalesUserPrompt(transcript: string, skillCategories: any): string {
  // Extract template sections or use defaults
  const scoredSections = skillCategories?.scoredSections || [
    { 
      name: "Rapport", 
      criteria: "HWF Framework (Home, Work, Family) - Build trust through genuine connection BEFORE discussing insurance. Look for: 'How long have you been here?', 'Are you working or retired?', 'Do you have any kids?' Note: Asking about roof year is NOT rapport." 
    },
    { 
      name: "Coverage", 
      criteria: "Differentiate through education, not order-taking. Did they educate on coverage and liability? Did they position as advisor vs price-quoting agent? Look for phrases like 'coverage assessment'." 
    },
    { 
      name: "Closing", 
      criteria: "Use Assumptive Close Language. Minimum two close attempts. Final ask for the sale. If follow-up set: must include exact date/time. Bonus: Ask for referrals." 
    },
    { 
      name: "Objection Handling", 
      criteria: "Use the Objection Loop: Acknowledge the concern, Address/Reframe with value, Check if resolved ('does that solve it?'), Ask again after handling." 
    },
    { 
      name: "Discovery", 
      criteria: "Did they uncover needs, budget, timeline, decision-makers? Did they ask about other policies or assets?" 
    }
  ];

  const checklistItems = skillCategories?.checklistItems || [
    { label: "HWF Framework", criteria: "Did they use Home/Work/Family rapport building?" },
    { label: "Ask About Work", criteria: "Did they ask about the caller's occupation?" },
    { label: "Explain Coverage", criteria: "Did they explain coverage options?" },
    { label: "Deductible Value", criteria: "Did they explain deductible value?" },
    { label: "Advisor Frame", criteria: "Did they position as an advisor?" },
    { label: "Assumptive Close", criteria: "Did they use assumptive close language?" },
    { label: "Ask for Sale", criteria: "Did they directly ask for the sale?" },
    { label: "Set Follow Up", criteria: "Did they set a specific follow-up date/time?" }
  ];

  // Build scoring framework dynamically
  const scoringFramework = scoredSections.map((section: any, idx: number) => 
    `**${idx + 1}. ${section.name.toUpperCase()}**\n${section.criteria}`
  ).join('\n\n');

  // Generate section score fields dynamically
  const sectionScoreFields = scoredSections.map((section: any) => {
    const key = section.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    return `  "${key}_score": <0-100>,
  "${key}_wins": ["<specific thing done well>"],
  "${key}_failures": ["<specific failure 1>", "<specific failure 2 if applicable>"],
  "${key}_coaching": "<2-3 sentences of specific, actionable coaching>"`;
  }).join(',\n');

  // Generate section_scores object structure
  const sectionScoresStructure = scoredSections.map((section: any) => {
    const key = section.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    return `    "${key}": {
      "score": <0-100>,
      "wins": ["<specific thing done well>"],
      "failures": ["<specific failure>"],
      "coaching": "<coaching advice>"
    }`;
  }).join(',\n');

  // Build checklist criteria explanation
  const checklistCriteriaExplanation = checklistItems.map((item: any) => 
    `- **${item.label}**: ${item.criteria || 'Did this occur during the call?'}`
  ).join('\n');

  // Generate execution_checklist JSON structure
  const checklistJsonStructure = checklistItems.map((item: any) => {
    const key = item.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    return `    "${key}": <true/false>`;
  }).join(',\n');

  // Generate skill_scores keys
  const skillScoresKeys = scoredSections.map((section: any) => {
    const key = section.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    return `    "${key}": <0-100>`;
  }).join(',\n');

  return `Analyze this insurance sales call transcript and provide a structured evaluation.

## SCORING FRAMEWORK

${scoringFramework}

## EXECUTION CHECKLIST CRITERIA

${checklistCriteriaExplanation}

## REQUIRED JSON RESPONSE FORMAT

{
  "salesperson_name": "<first name of the agent from transcript, or 'Agent' if unclear>",
  "potential_rank": "<VERY LOW | LOW | MEDIUM | HIGH | VERY HIGH>",
  "potential_rank_rationale": "<3-4 sentences explaining the ranking with specific quotes and observations>",
  
  "critical_assessment": "<3-4 detailed sentences about the main issues or successes, citing specific moments from the call>",
  
  "skill_scores": {
${skillScoresKeys}
  },
  
  "section_scores": {
${sectionScoresStructure}
  },
  
  "execution_checklist": {
${checklistJsonStructure}
  },
  
  "corrective_action_plan": {
    "primary_focus": "<2-3 sentences with specific phrases and techniques to implement>",
    "secondary_focus": "<2-3 sentences on additional improvements>",
    "closing_focus": "<2-3 sentences on specific closing techniques and language to use>"
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
- Each section MUST have at least 1 win (something done well) and 1-2 failures
- If they did something well, acknowledge it as a win even if the overall score is low
- Coaching must be 2-3 full sentences with specific examples and phrases to use
- Critical assessment must be 3-4 sentences minimum
- Be specific - cite quotes from the transcript when possible
- Format prices consistently as $X/month or $X/year

## TRANSCRIPT
${transcript}`;
}

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

    // Extract skill categories from template
    const skillCategories = call.call_scoring_templates?.skill_categories as any;
    console.log('Using skill_categories from template:', JSON.stringify(skillCategories).substring(0, 500));

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

Voice profile:
- Tone: blunt, clean, directive, zero hype.
- Sentences: short, active, present tense. 6–14 words.
- POV: second person ("you"). Address the salesperson directly.
- Use imperatives for fixes.

You must respond with ONLY valid JSON - no markdown, no explanation.`;

    const systemPrompt = templatePrompt && templatePrompt.trim().length > 0
      ? templatePrompt
      : (callType === 'service' ? defaultServicePrompt : defaultSalesPrompt);

    // Enforce JSON-only output
    const enforcedSystemPrompt = `${systemPrompt}\n\nCRITICAL OUTPUT FORMAT: Respond with ONLY valid JSON. Do NOT use markdown. Do NOT use HTML. Do NOT add commentary.`;

    console.log('Using prompt source:', templatePrompt && templatePrompt.trim().length > 0 ? 'TEMPLATE' : 'HARDCODED DEFAULT');
    console.log('Has custom scored sections:', skillCategories?.scoredSections?.length > 0 ? 'YES' : 'NO');
    console.log('Has custom checklist items:', skillCategories?.checklistItems?.length > 0 ? 'YES' : 'NO');

    // Build dynamic user prompt based on call type and template skill_categories
    const userPrompt = callType === 'service' 
      ? buildServiceUserPrompt(call.transcript, skillCategories)
      : buildSalesUserPrompt(call.transcript, skillCategories);

    console.log("Generated user prompt length:", userPrompt.length);
    console.log("User prompt preview:", userPrompt.substring(0, 1000));

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
      // Sales calls: average of skill_scores (dynamic)
      const skillScores = analysis.skill_scores || {};
      const scores = Object.values(skillScores).filter((v): v is number => typeof v === 'number');
      overallScore = scores.length > 0 
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
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
      call_type: callType,
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
        closing_attempts: analysis.crm_notes,
        coaching_recommendations: analysis.suggestions,
        discovery_wins: analysis.checklist,
        client_profile: {
          csr_name: analysis.csr_name,
          client_first_name: analysis.client_first_name,
        },
      };
    } else {
      // Sales call specific fields - use dynamic skill_scores from analysis
      updatePayload = {
        ...updatePayload,
        potential_rank: analysis.potential_rank,
        skill_scores: analysis.skill_scores,
        section_scores: analysis.section_scores,
        // Accept both key names - prompt spec OR what AI actually returns
        client_profile: analysis.extracted_data || analysis.client_profile,
        discovery_wins: analysis.execution_checklist || analysis.checklist,
        critical_gaps: {
          assessment: analysis.critical_assessment || analysis.summary,
          rationale: analysis.potential_rank_rationale || `Ranked as ${analysis.potential_rank} based on overall performance.`,
          corrective_plan: analysis.corrective_action_plan || (
            Array.isArray(analysis.coaching_recommendations) && analysis.coaching_recommendations.length >= 3
              ? {
                  primary_focus: analysis.coaching_recommendations[0],
                  secondary_focus: analysis.coaching_recommendations[1],
                  closing_focus: analysis.coaching_recommendations[2]
                }
              : {
                  primary_focus: analysis.coaching_recommendations?.[0] || "Focus on building rapport.",
                  secondary_focus: analysis.coaching_recommendations?.[1] || "Improve coverage education.",
                  closing_focus: analysis.coaching_recommendations?.[2] || "Use assumptive close language."
                }
          )
        },
        closing_attempts: analysis.crm_notes || analysis.closing_attempts,
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
