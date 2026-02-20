import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { verifyRequest, isVerifyError } from "../_shared/verifyRequest.ts";

Deno.serve(async (req: Request) => {
  const optRes = handleOptions(req);
  if (optRes) return optRes;

  try {
    // Auth: dual-mode (JWT + staff session)
    const authResult = await verifyRequest(req);
    if (isVerifyError(authResult)) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { mode, agencyId, userId, staffUserId, isManager, isKeyEmployee } = authResult;

    // Enforce manager/owner/admin/key-employee — reject regular staff
    if (mode === "staff" && !isManager) {
      return new Response(
        JSON.stringify({ error: "Only managers can use Compare & Coach" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const action = body.action || "generate";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ─── LIST: Return saved reports for the agency ───
    if (action === "list") {
      const { data, error } = await adminClient
        .from("call_coaching_reports")
        .select("id, title, comparison_mode, call_ids, created_at, model_used")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return new Response(JSON.stringify({ reports: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── GET: Fetch a single report by ID ───
    if (action === "get") {
      const { report_id } = body;
      if (!report_id) {
        return new Response(JSON.stringify({ error: "report_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await adminClient
        .from("call_coaching_reports")
        .select("*")
        .eq("id", report_id)
        .eq("agency_id", agencyId)
        .single();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Report not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ report: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── DELETE: Remove a report by ID ───
    if (action === "delete") {
      const { report_id } = body;
      if (!report_id) {
        return new Response(JSON.stringify({ error: "report_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await adminClient
        .from("call_coaching_reports")
        .delete()
        .eq("id", report_id)
        .eq("agency_id", agencyId);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── GENERATE: Run AI comparison, save report, return results ───
    if (action !== "generate") {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { call_ids: rawCallIds, custom_prompt } = body;

    // Validate & dedupe call IDs
    if (!Array.isArray(rawCallIds) || rawCallIds.length < 2) {
      return new Response(
        JSON.stringify({ error: "Select at least 2 calls to compare" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const callIds = [...new Set(rawCallIds as string[])];
    if (callIds.length < 2) {
      return new Response(
        JSON.stringify({ error: "Select at least 2 distinct calls to compare" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (callIds.length > 5) {
      return new Response(
        JSON.stringify({ error: "Maximum 5 calls can be compared" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch call data (token-efficient — structured data, NOT transcripts)
    const { data: calls, error: callsError } = await adminClient
      .from("agency_calls")
      .select(
        "id, team_member_id, overall_score, skill_scores, section_scores, " +
        "discovery_wins, critical_gaps, coaching_recommendations, " +
        "notable_quotes, call_type, call_duration_seconds, summary, " +
        "created_at, client_profile"
      )
      .eq("agency_id", agencyId)
      .eq("status", "analyzed")
      .in("id", callIds);

    if (callsError) throw callsError;
    if (!calls || calls.length < 2) {
      return new Response(
        JSON.stringify({ error: "Could not find enough analyzed calls. Ensure all selected calls have been scored." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch team member names
    const memberIds = [...new Set(calls.map((c) => c.team_member_id))];
    const { data: members } = await adminClient
      .from("team_members")
      .select("id, name")
      .in("id", memberIds);
    const memberMap = new Map((members || []).map((m) => [m.id, m.name]));

    // Detect comparison mode
    const uniqueMembers = new Set(calls.map((c) => c.team_member_id));
    const comparisonMode = uniqueMembers.size === 1 ? "trajectory" : "peer";

    // Build structured call data for the AI prompt
    const callSummaries = calls.map((c) => ({
      call_id: c.id,
      team_member: memberMap.get(c.team_member_id) || "Unknown",
      team_member_id: c.team_member_id,
      overall_score: c.overall_score,
      call_type: c.call_type,
      duration_seconds: c.call_duration_seconds,
      date: c.created_at,
      summary: c.summary,
      skill_scores: c.skill_scores,
      section_scores: c.section_scores,
      discovery_wins: c.discovery_wins,
      critical_gaps: c.critical_gaps,
      coaching_recommendations: c.coaching_recommendations,
      notable_quotes: c.notable_quotes,
      client_profile: c.client_profile,
    }));

    // Build system prompt
    const systemPrompt = buildSystemPrompt(comparisonMode, custom_prompt);
    const userPrompt = buildUserPrompt(callSummaries, comparisonMode);

    // Call OpenAI
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[compare-calls] Comparing ${calls.length} calls, mode=${comparisonMode}`);

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("[compare-calls] OpenAI API error:", errorText);
      return new Response(
        JSON.stringify({ error: "AI comparison failed", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiResult = await openaiResponse.json();
    const analysisText = openaiResult.choices?.[0]?.message?.content;

    // Token usage & cost
    const usage = openaiResult.usage;
    const inputTokens = usage?.prompt_tokens || 0;
    const outputTokens = usage?.completion_tokens || 0;
    // GPT-4o pricing: $2.50/1M input, $10/1M output
    const inputCost = (inputTokens / 1000000) * 2.5;
    const outputCost = (outputTokens / 1000000) * 10.0;
    const gptCost = inputCost + outputCost;

    console.log(`[compare-calls] GPT-4o tokens: ${inputTokens} in / ${outputTokens} out, cost: $${gptCost.toFixed(4)}`);

    if (!analysisText) {
      return new Response(
        JSON.stringify({ error: "No analysis returned from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse JSON response (clean up markdown formatting)
    let reportData;
    try {
      let cleanJson = analysisText.trim();
      if (cleanJson.startsWith("```json")) cleanJson = cleanJson.slice(7);
      if (cleanJson.startsWith("```")) cleanJson = cleanJson.slice(3);
      if (cleanJson.endsWith("```")) cleanJson = cleanJson.slice(0, -3);
      reportData = JSON.parse(cleanJson.trim());
    } catch (parseError) {
      console.error("[compare-calls] Failed to parse AI response:", parseError);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI analysis", raw: analysisText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build title
    const memberNames = [...new Set(calls.map((c) => memberMap.get(c.team_member_id) || "Unknown"))];
    const title =
      comparisonMode === "trajectory"
        ? `${memberNames[0]} — ${calls.length} Call Progress Review`
        : `Team Comparison — ${memberNames.join(", ")}`;

    // Save to database
    const insertPayload: Record<string, unknown> = {
      agency_id: agencyId,
      call_ids: callIds,
      comparison_mode: comparisonMode,
      custom_prompt: custom_prompt || null,
      title,
      report_data: reportData,
      model_used: "gpt-4o",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      gpt_cost: gptCost,
    };

    if (mode === "staff") {
      insertPayload.created_by_staff_id = staffUserId;
    } else {
      insertPayload.created_by_user_id = userId;
    }

    const { data: savedReport, error: saveError } = await adminClient
      .from("call_coaching_reports")
      .insert(insertPayload)
      .select("id, created_at")
      .single();

    if (saveError) {
      console.error("[compare-calls] Save error:", saveError);
      // Still return the report even if save fails
    }

    return new Response(
      JSON.stringify({
        report: reportData,
        meta: {
          id: savedReport?.id,
          title,
          comparison_mode: comparisonMode,
          call_count: calls.length,
          model_used: "gpt-4o",
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          gpt_cost: gptCost,
          created_at: savedReport?.created_at,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[compare-calls] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Prompt builders ───

function buildSystemPrompt(mode: string, customPrompt?: string): string {
  const base = `You are an expert insurance sales coach. You analyze scored call data to create actionable coaching reports.

IMPORTANT RULES:
- Every recommendation MUST reference specific call data (scores, quotes, patterns you observed)
- Role-play scenarios MUST be grounded in actual patterns from the calls, not generic scripts
- Be specific and actionable — avoid vague advice like "improve communication"
- Use the agent's actual scores and gaps to drive recommendations
${mode === "trajectory" ? "- This is a TRAJECTORY analysis (same agent, multiple calls over time). Emphasize progress, trends, and growth trajectory. Celebrate improvements and flag regressions." : "- This is a PEER COMPARISON (different agents). Identify peer learning opportunities — who excels where, and how they can learn from each other. Be respectful and constructive."}
${customPrompt ? `\nMANAGER'S FOCUS AREA: "${customPrompt}" — Weight your analysis toward this area.` : ""}

Return a JSON object with this exact structure:
{
  "executive_summary": "2-3 sentences: key finding + recommended action",
  "pattern_analysis": {
    "strengths": [{ "pattern": "...", "evidence": "...", "impact": "..." }],
    "weaknesses": [{ "pattern": "...", "evidence": "...", "impact": "..." }],
    "trends": [{ "observation": "...", "direction": "improving|declining|inconsistent", "detail": "..." }]
  },
  "coaching_plan": {
    "focus_areas": [{ "area": "...", "priority": "high|medium|low", "current_level": "...", "target": "...", "drill": "..." }],
    "role_play_scenarios": [{ "title": "...", "setup": "...", "agent_goal": "...", "customer_persona": "...", "success_criteria": "...", "sample_objection": "..." }],
    "weekly_goals": [{ "week": 1, "focus": "...", "measurable_target": "...", "check_in_question": "..." }]
  },
  "call_comparisons": [{ "call_id": "...", "team_member": "...", "score": 0, "date": "...", "key_strength": "...", "key_gap": "..." }]
}

Provide 2-4 items for each array. Weekly goals should cover 4 weeks.`;

  return base;
}

function buildUserPrompt(
  callSummaries: Array<Record<string, unknown>>,
  mode: string
): string {
  const callDataStr = callSummaries
    .map((c, i) => {
      const parts = [
        `--- Call ${i + 1} ---`,
        `Call ID: ${c.call_id}`,
        `Agent: ${c.team_member}`,
        `Date: ${c.date}`,
        `Type: ${c.call_type || "sales"}`,
        `Duration: ${c.duration_seconds ? Math.round(Number(c.duration_seconds) / 60) + " min" : "unknown"}`,
        `Overall Score: ${c.overall_score ?? "N/A"}`,
        `Summary: ${c.summary || "No summary"}`,
      ];

      if (c.skill_scores) {
        parts.push(`Skill Scores: ${JSON.stringify(c.skill_scores)}`);
      }
      if (c.section_scores) {
        parts.push(`Section Scores: ${JSON.stringify(c.section_scores)}`);
      }
      if (c.discovery_wins) {
        parts.push(`Discovery/Checklist: ${JSON.stringify(c.discovery_wins)}`);
      }
      if (c.critical_gaps) {
        parts.push(`Critical Gaps: ${JSON.stringify(c.critical_gaps)}`);
      }
      if (c.coaching_recommendations) {
        parts.push(`Existing Coaching Recommendations: ${JSON.stringify(c.coaching_recommendations)}`);
      }
      if (c.notable_quotes) {
        parts.push(`Notable Quotes: ${JSON.stringify(c.notable_quotes)}`);
      }

      return parts.join("\n");
    })
    .join("\n\n");

  return `Analyze these ${callSummaries.length} scored calls (${mode} mode) and generate a coaching report:\n\n${callDataStr}`;
}
