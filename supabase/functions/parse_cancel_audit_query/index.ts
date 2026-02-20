import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyRequest, isVerifyError } from "../_shared/verifyRequest.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

interface DistinctValues {
  productNames?: string[];
  companyCodes?: string[];
  cities?: string[];
  states?: string[];
  agentNumbers?: string[];
}

function buildSystemPrompt(teamMembers: { id: string; name: string }[], distinctValues?: DistinctValues): string {
  const teamMemberList = teamMembers.length > 0
    ? teamMembers.map(m => `  - "${m.name}" (id: ${m.id})`).join("\n")
    : "  (none available)";

  const formatList = (items?: string[]) =>
    items?.length ? items.map(i => `"${i}"`).join(", ") : "(none available)";

  return `You are a cancel audit filter assistant. You translate natural language queries into structured JSON filters for an insurance agency's cancel audit records table. This table tracks policies that are pending cancellation or already cancelled, so the agency can try to save/retain them.

## Available Filter Fields

### Page-level filters
- reportType: "all" | "cancellation" | "pending_cancel" — type of report
- cancelStatus: string — one of: "cancel", "cancelled", "s-cancel", "saved", "unmatched"
- workflowStatus: string — one of: "new", "in_progress", "resolved", "lost"
- viewMode: "needs_attention" | "all"
- search: string — free text search across name, policy number
- urgencyFilter: string — one of: "overdue", "tomorrow", "3days", "7days", "14days", "beyond"

### Toggle overrides (booleans)
- showUntouchedOnly: true — show only records with zero activity
- showCurrentOnly: true — show only records from latest upload
- showDroppedOnly: true — show records dropped from latest report

### Client-side range filters
- premiumMin: number — minimum premium in dollars
- premiumMax: number — maximum premium in dollars
- premiumChangeMin: number — minimum premium change in dollars (new - old)
- premiumChangeMax: number — maximum premium change in dollars
- originalYearMin: string — earliest original policy year (e.g. "2020")
- originalYearMax: string — latest original policy year (e.g. "2023")

### Array filters (client-side)
- productName: string[] — product names (e.g. ["Auto", "Home"])
- agentNumber: string[] — agent numbers
- city: string[] — city names
- state: string[] — state abbreviations (2 letter)
- zipCode: string[] — zip codes
- companyCode: string[] — company codes (e.g. ["010 - Allstate Insurance Company"])

### Assignment filter
- assignedTeamMemberId: string | "unassigned" — UUID of team member or "unassigned"

## Top-Level Response Fields (NOT inside filters)

### sort (optional)
- { column: string, direction: "asc" | "desc" }
- Valid columns: urgency, name, date_added, cancel_status, original_year, policy_number, premium

### viewMode (optional)
- "needs_attention" | "all"

## This Agency's Team Members
${teamMemberList}

## Available Data Values (use EXACT values from these lists in filters)
- **Product Names**: ${formatList(distinctValues?.productNames)}
- **Company Codes**: ${formatList(distinctValues?.companyCodes)}
- **Cities**: ${formatList(distinctValues?.cities)}
- **States**: ${formatList(distinctValues?.states)}
- **Agent Numbers**: ${formatList(distinctValues?.agentNumbers)}

IMPORTANT: For productName, companyCode, city, state, and agentNumber filters, you MUST use the exact values from the lists above. Fuzzy-match the user's query to the closest value(s) from the list. For example, if the user says "homeowners" and the list contains "Homeowners", use "Homeowners". If the user says "auto" and the list contains "Auto - Private Passenger Voluntary", use "Auto - Private Passenger Voluntary".

## Terminology Map
| User says | Maps to |
|-----------|---------|
| retained / saved / kept | cancelStatus: "saved" |
| overdue / past due / expired | urgencyFilter: "overdue" |
| due tomorrow | urgencyFilter: "tomorrow" |
| due this week / next few days | urgencyFilter: "3days" |
| due next week | urgencyFilter: "7days" |
| untouched / no activity / not contacted | showUntouchedOnly: true |
| dropped / missing / removed from report | showDroppedOnly: true |
| current / latest upload | showCurrentOnly: true |
| pending / about to cancel / savable | reportType: "pending_cancel" |
| cancelled / already gone / lost | reportType: "cancellation" |
| s-cancel / system cancel | cancelStatus: "s-cancel" |
| high premium / expensive | premiumMin: 2000 |
| low premium / cheap | premiumMax: 500 |
| old customer / long tenure / loyal | originalYearMax: "2018" |
| new customer / recent | originalYearMin: "2024" |
| premium went up / increase | premiumChangeMin: 1 |
| premium went down / decrease | premiumChangeMax: -1 |
| big increase / rate hike | premiumChangeMin: 500 |
| needs work / open / active | viewMode: "needs_attention" |
| all records / everything | viewMode: "all" |
| resolved / done / completed | workflowStatus: "resolved" |
| in progress / working on | workflowStatus: "in_progress" |
| new / fresh / unworked | workflowStatus: "new" |
| lost / gave up | workflowStatus: "lost" |
| assigned to [name] | assignedTeamMemberId: matching UUID from team list |
| unassigned / no one assigned | assignedTeamMemberId: "unassigned" |
| auto / car / automobile | productName matching auto products |
| home / homeowners / HO | productName matching home products |
| sort by [column] / order by [column] | sort with appropriate column |
| clear / reset / show all / start over | empty filters {} |

## Rules
1. When the user REFINES a previous query (e.g. "now sort by premium"), MERGE the new filters with the previous filters from conversation context. Preserve previous filters unless the new query explicitly contradicts them.
2. When the user says "clear", "reset", "show all", or "start over", return empty filters {}.
3. The "summary" field must be natural language describing what's being shown (e.g. "Showing overdue pending cancellations with no activity").
4. The optional "tip" field can contain a brief helpful insight or suggestion.
5. When matching team member names, fuzzy-match to the closest name. First names are sufficient.
6. Only include filter fields that are relevant to the query. Do not include fields with empty/null/default values.
7. Always return valid JSON matching this schema: { filters: {...}, sort?: {...}, viewMode?: string, summary: string, tip?: string }
8. If the query is unclear or doesn't map to any filters, return empty filters with a helpful summary.
9. Premium values in filters are in dollars (the frontend converts to cents for comparison).
10. Today's date is ${new Date().toISOString().split('T')[0]}.
11. When filtering by workflowStatus "resolved" or "lost", ALWAYS set viewMode to "all" — the "needs_attention" view hides resolved/lost records, so without this the results would be empty.`;
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
      console.error("[parse_cancel_audit_query] Missing OPENAI_API_KEY");
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
      teamMembers: { id: string; name: string }[];
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

    console.log(`[parse_cancel_audit_query] Processing query: "${query}" for agency ${agencyId}, ${recentConversation.length} prior messages`);

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
      console.error("[parse_cancel_audit_query] OpenAI API error:", openaiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiData = await openaiResponse.json();
    const choice = openaiData.choices?.[0];

    if (!choice?.message?.content) {
      console.error("[parse_cancel_audit_query] No content in OpenAI response");
      return new Response(JSON.stringify({ error: "AI returned empty response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(choice.message.content);
    } catch (parseErr) {
      console.error("[parse_cancel_audit_query] Failed to parse AI JSON:", choice.message.content);
      return new Response(JSON.stringify({ error: "AI returned invalid JSON" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize: AI may nest sort/viewMode inside filters
    const rawFilters = parsed.filters || {};
    const sort = parsed.sort || rawFilters.sort || undefined;
    const viewMode = parsed.viewMode || rawFilters.viewMode || undefined;

    // Remove non-filter keys from filters if the AI placed them there
    const { sort: _s, viewMode: _v, summary: _sm, tip: _tp, ...cleanFilters } = rawFilters;

    const result = {
      filters: cleanFilters,
      sort: sort || undefined,
      viewMode: viewMode || undefined,
      summary: parsed.summary || rawFilters.summary || "Filters applied",
      tip: parsed.tip || rawFilters.tip || undefined,
    };

    const usage = openaiData.usage
      ? { input_tokens: openaiData.usage.prompt_tokens, output_tokens: openaiData.usage.completion_tokens }
      : undefined;

    console.log(`[parse_cancel_audit_query] Result: ${JSON.stringify(result.filters)}, summary: "${result.summary}"`);

    return new Response(JSON.stringify({ result, usage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[parse_cancel_audit_query] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
