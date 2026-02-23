import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyRequest, isVerifyError } from "../_shared/verifyRequest.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

interface DistinctValues {
  productNames?: string[];
  agentNumbers?: string[];
  terminationReasons?: string[];
}

function buildSystemPrompt(teamMembers: { id: string; name: string; agentNumber?: string }[], distinctValues?: DistinctValues): string {
  const teamMemberList = teamMembers.length > 0
    ? teamMembers.map(m => `  - "${m.name}" (id: ${m.id}${m.agentNumber ? `, agent#: ${m.agentNumber}` : ''})`).join("\n")
    : "  (none available)";

  const formatList = (items?: string[]) =>
    items?.length ? items.map(i => `"${i}"`).join(", ") : "(none available)";

  return `You are a termination analysis filter assistant. You translate natural language queries into structured JSON filters for an insurance agency's termination policy analysis. This table shows individual terminated policies with details like product type, premium, items lost, termination reason, and producer.

## Available Filter Fields

### Page-level filters
- search: string — free text search across customer name, policy number
- hideCancelRewrites: boolean — true to hide cancel/rewrite policies, false to show them
- activeTab: "leaderboard" | "all" | "by-type" | "by-reason" | "by-origin" | "by-source" — which analysis view to show
- dateRangeStart: string — ISO date for date range start
- dateRangeEnd: string — ISO date for date range end

### Client-side range filters
- premiumMin: number — minimum premium in dollars
- premiumMax: number — maximum premium in dollars
- itemsCountMin: number — minimum items count per policy
- itemsCountMax: number — maximum items count per policy
- originalYearMin: number — earliest original policy year (e.g. 2020)
- originalYearMax: number — latest original policy year (e.g. 2023)

### Array filters (client-side, use EXACT values from the lists below)
- productName: string[] — product type names
- agentNumber: string[] — agent/producer numbers
- terminationReason: string[] — termination reason strings

## Top-Level Response Fields (NOT inside filters)

### sort (optional)
- { column: string, direction: "asc" | "desc" }
- Valid columns: date, policy, customer, originalYear, type, items, points, premium, reason

## This Agency's Team Members
${teamMemberList}

## Available Data Values (use EXACT values from these lists in filters)
- **Product Names**: ${formatList(distinctValues?.productNames)}
- **Agent Numbers**: ${formatList(distinctValues?.agentNumbers)}
- **Termination Reasons**: ${formatList(distinctValues?.terminationReasons)}

IMPORTANT: For productName, agentNumber, and terminationReason filters, you MUST use the exact values from the lists above. Fuzzy-match the user's query to the closest value(s) from the list.

## Terminology Map
| User says | Maps to |
|-----------|---------|
| cancel rewrites / show rewrites / include rewrites | hideCancelRewrites: false |
| hide rewrites / exclude rewrites / no rewrites | hideCancelRewrites: true |
| auto / car / automobile / vehicle | productName: match auto-related products from list |
| homeowners / homes / HO / home | productName: match home-related products from list |
| renters / renter / tenant | productName: match renter products from list |
| umbrella / excess liability | productName: match umbrella products from list |
| non-pay / nonpay / nonpayment / didn't pay | terminationReason: match non-payment reasons from list |
| dissatisfied / rate increase / unhappy / price | terminationReason: match dissatisfaction reasons from list |
| property sold / moved / relocated | terminationReason: match property-sold reasons from list |
| leaderboard / by producer / producer ranking | activeTab: "leaderboard" |
| by type / by policy type / product breakdown | activeTab: "by-type" |
| by reason / reason breakdown | activeTab: "by-reason" |
| all terminations / show all / full list | activeTab: "all" |
| this month | dateRangeStart/End for current month |
| last month | dateRangeStart/End for previous month |
| last 90 days / last quarter | dateRangeStart: 90 days ago, dateRangeEnd: today |
| producer [name] / agent [name] | agentNumber: match from team members list |
| old customers / long tenure / loyal | originalYearMax: year implying long tenure (e.g. 2018) |
| new customers / recent customers | originalYearMin: recent year (e.g. 2024) |
| high premium / expensive / big policies | sort by premium desc or premiumMin: 2000 |
| low premium / small / cheap | premiumMax: 500 |
| sort by [column] / order by [column] | sort with appropriate column |
| clear / reset / show all / start over | empty filters {} |

## Rules
1. When the user REFINES a previous query (e.g. "now sort by premium"), MERGE the new filters with the previous filters from conversation context. Preserve previous filters unless the new query explicitly contradicts them.
2. When the user says "clear", "reset", "show all", or "start over", return empty filters {}.
3. The "summary" field must be natural language describing what's being shown (e.g. "Showing auto policy terminations sorted by premium").
4. The optional "tip" field can contain a brief helpful insight or suggestion.
5. When matching team member names, fuzzy-match to the closest name and use their agent number. First names are sufficient.
6. Only include filter fields that are relevant to the query. Do not include fields with empty/null/default values.
7. Always return valid JSON matching this schema: { filters: {...}, sort?: {...}, summary: string, tip?: string }
8. If the query is unclear or doesn't map to any filters, return empty filters with a helpful summary.
9. Premium values in filters are in dollars (the frontend converts to cents for comparison).
10. Today's date is ${new Date().toISOString().split('T')[0]}.
11. For date ranges, compute the actual ISO dates. E.g. "this month" → dateRangeStart: first day of current month, dateRangeEnd: last day of current month.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate: try staff session first, then JWT via verifyRequest
    const staffSession = req.headers.get("x-staff-session");
    let agencyId: string;

    if (staffSession) {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: session, error: sessionError } = await supabaseAdmin
        .from("staff_sessions")
        .select("staff_user_id, expires_at, staff_users(agency_id, is_active)")
        .eq("session_token", staffSession)
        .single() as { data: any; error: any };

      if (sessionError || !session || new Date(session.expires_at) < new Date() || !session.staff_users?.is_active) {
        return new Response(JSON.stringify({ error: "Invalid or expired staff session" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      agencyId = session.staff_users.agency_id;
    } else {
      const authResult = await verifyRequest(req);
      if (isVerifyError(authResult)) {
        return new Response(JSON.stringify({ error: authResult.error }), {
          status: authResult.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      agencyId = authResult.agencyId;
    }

    if (!OPENAI_API_KEY) {
      console.error("[parse_termination_query] Missing OPENAI_API_KEY");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      query,
      conversation = [],
      teamMembers = [],
      distinctValues,
    } = body as {
      query: string;
      conversation: { role: string; content: string }[];
      teamMembers: { id: string; name: string; agentNumber?: string }[];
      distinctValues?: DistinctValues;
    };

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build messages: system prompt + last 6 conversation messages (3 turns) + new user query
    const systemPrompt = buildSystemPrompt(teamMembers, distinctValues);
    const recentConversation = conversation.slice(-6);

    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
      ...recentConversation.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: query },
    ];

    console.log(`[parse_termination_query] Processing query: "${query}" for agency ${agencyId}, ${recentConversation.length} prior messages`);

    // Call OpenAI GPT-4o-mini with JSON mode
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.error("[parse_termination_query] OpenAI API error:", openaiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiData = await openaiResponse.json();
    const choice = openaiData.choices?.[0];

    if (!choice?.message?.content) {
      console.error("[parse_termination_query] No content in OpenAI response");
      return new Response(JSON.stringify({ error: "AI returned empty response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(choice.message.content);
    } catch (parseErr) {
      console.error("[parse_termination_query] Failed to parse AI JSON:", choice.message.content);
      return new Response(JSON.stringify({ error: "AI returned invalid JSON" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize: AI may nest sort inside filters
    const rawFilters = parsed.filters || {};
    const sort = parsed.sort || rawFilters.sort || undefined;

    // Remove non-filter keys from filters if the AI placed them there
    const { sort: _s, summary: _sm, tip: _tp, ...cleanFilters } = rawFilters;

    const result = {
      filters: cleanFilters,
      sort: sort || undefined,
      summary: parsed.summary || rawFilters.summary || "Filters applied",
      tip: parsed.tip || rawFilters.tip || undefined,
    };

    const usage = openaiData.usage
      ? { input_tokens: openaiData.usage.prompt_tokens, output_tokens: openaiData.usage.completion_tokens }
      : undefined;

    console.log(`[parse_termination_query] Result: ${JSON.stringify(result.filters)}, summary: "${result.summary}"`);

    return new Response(JSON.stringify({ result, usage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[parse_termination_query] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
