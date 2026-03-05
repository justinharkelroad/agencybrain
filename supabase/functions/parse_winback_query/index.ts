import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyRequest, isVerifyError } from "../_shared/verifyRequest.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

function buildSystemPrompt(teamMembers: { id: string; name: string }[], todayStr?: string): string {
  if (!todayStr) todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const teamMemberList = teamMembers.length > 0
    ? teamMembers.map(m => `  - "${m.name}" (id: ${m.id})`).join("\n")
    : "  (none available)";

  return `You are a win-back opportunities filter assistant. You translate natural language queries into structured JSON filters for an insurance agency's win-back household table. This table tracks terminated policy households that the agency wants to try to win back.

## Available Filter Fields

### Page-level filters
- statusFilter: "all" | "untouched" | "in_progress" | "won_back" | "dismissed" | "declined" | "no_contact"
- activeTab: "active" | "dismissed" — which tab to show (RULE: if statusFilter is "dismissed", MUST also set activeTab to "dismissed")
- quickDateFilter: "all" | "overdue" | "this_week" | "next_2_weeks" | "next_month" — quick date range for winback dates
- dateRangeStart: string — ISO date for custom range start
- dateRangeEnd: string — ISO date for custom range end
- search: string — free text search across name, phone, email

### Client-side range filters
- premiumMin: number — minimum total premium potential in dollars
- premiumMax: number — maximum total premium potential in dollars
- policyCountMin: number — minimum number of terminated policies
- policyCountMax: number — maximum number of terminated policies

### Array filters (client-side)
- city: string[] — city names
- state: string[] — state abbreviations (2 letter)
- zipCode: string[] — zip codes

### Assignment filter
- assignedTeamMemberId: string | "unassigned" — UUID of team member or "unassigned"

## Top-Level Response Fields (NOT inside filters)

### sort (optional)
- { column: string, direction: "asc" | "desc" }
- Valid columns: name, policy_count, total_premium_potential_cents, earliest_winback_date, status, assigned_name

## This Agency's Team Members
${teamMemberList}

## Terminology Map
| User says | Maps to |
|-----------|---------|
| untouched / not started / no activity | statusFilter: "untouched" |
| in progress / working / being worked | statusFilter: "in_progress" |
| won back / retained / saved | statusFilter: "won_back" |
| dismissed / closed / archived | statusFilter: "dismissed" + activeTab: "dismissed" |
| declined / turned down | statusFilter: "declined" |
| no contact / unreachable / can't reach | statusFilter: "no_contact" |
| teed up / ready / this week | quickDateFilter: "this_week" |
| overdue / past due | quickDateFilter: "overdue" |
| next 2 weeks / upcoming | quickDateFilter: "next_2_weeks" |
| next month | quickDateFilter: "next_month" |
| high premium / big accounts / valuable | premiumMin: 2000 |
| low premium / small accounts | premiumMax: 500 |
| multiple policies / bundled / multi-line | policyCountMin: 2 |
| single policy / one policy | policyCountMax: 1 |
| assigned to [name] | assignedTeamMemberId: matching UUID from team list |
| unassigned / nobody / no one assigned | assignedTeamMemberId: "unassigned" |
| sort by premium / highest premium | sort: { column: "total_premium_potential_cents", direction: "desc" } |
| sort by date / earliest first | sort: { column: "earliest_winback_date", direction: "asc" } |
| sort by name | sort: { column: "name", direction: "asc" } |
| clear / reset / show all / start over | empty filters {} |

## Rules
1. When the user REFINES a previous query (e.g. "now sort by premium"), MERGE the new filters with the previous filters from conversation context. Preserve previous filters unless the new query explicitly contradicts them.
2. When the user says "clear", "reset", "show all", or "start over", return empty filters {}.
3. CRITICAL: If statusFilter is "dismissed", you MUST also set activeTab to "dismissed". Otherwise, the dismissed tab won't be shown and results will be empty.
4. The "summary" field must be natural language describing what's being shown (e.g. "Showing untouched households with high premium potential").
5. The optional "tip" field can contain a brief helpful insight or suggestion.
6. When matching team member names, fuzzy-match to the closest name. First names are sufficient.
7. Only include filter fields that are relevant to the query. Do not include fields with empty/null/default values.
8. Always return valid JSON matching this schema: { filters: {...}, sort?: {...}, summary: string, tip?: string }
9. If the query is unclear or doesn't map to any filters, return empty filters with a helpful summary.
10. Premium values in filters are in dollars (the frontend converts to cents for comparison).
11. Today's date is ${todayStr}.`;
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
      console.error("[parse_winback_query] Missing OPENAI_API_KEY");
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
    } = body as {
      query: string;
      conversation: { role: string; content: string }[];
      teamMembers: { id: string; name: string }[];
    };

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve agency timezone for AI date context
    const supabaseSvc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: agencyTzRow } = await supabaseSvc.from("agencies").select("timezone").eq("id", agencyId).single();
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: agencyTzRow?.timezone || "America/New_York" }).format(new Date());

    // Build messages: system prompt + last 6 conversation messages (3 turns) + new user query
    const systemPrompt = buildSystemPrompt(teamMembers, todayStr);
    const recentConversation = conversation.slice(-6);

    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
      ...recentConversation.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: query },
    ];

    console.log(`[parse_winback_query] Processing query: "${query}" for agency ${agencyId}, ${recentConversation.length} prior messages`);

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
      console.error("[parse_winback_query] OpenAI API error:", openaiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiData = await openaiResponse.json();
    const choice = openaiData.choices?.[0];

    if (!choice?.message?.content) {
      console.error("[parse_winback_query] No content in OpenAI response");
      return new Response(JSON.stringify({ error: "AI returned empty response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(choice.message.content);
    } catch (parseErr) {
      console.error("[parse_winback_query] Failed to parse AI JSON:", choice.message.content);
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

    console.log(`[parse_winback_query] Result: ${JSON.stringify(result.filters)}, summary: "${result.summary}"`);

    return new Response(JSON.stringify({ result, usage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[parse_winback_query] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
