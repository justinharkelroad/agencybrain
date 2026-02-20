import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyRequest, isVerifyError } from "../_shared/verifyRequest.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

function buildSystemPrompt(teamMembers: { id: string; name: string }[], productNames: string[]): string {
  const teamMemberList = teamMembers.length > 0
    ? teamMembers.map(m => `  - "${m.name}" (id: ${m.id})`).join("\n")
    : "  (none available)";

  const productList = productNames.length > 0
    ? productNames.map(p => `  - "${p}"`).join("\n")
    : "  (none available)";

  return `You are a renewal list filter assistant. You translate natural language queries into structured JSON filters for an insurance agency's renewal records table.

## Available Filter Fields

### Server-side filters (applied to database query)
- currentStatus: WorkflowStatus[] — one or more of: "uncontacted", "pending", "success", "unsuccessful"
- renewalStatus: string[] — e.g. ["Renewal Taken"], ["Renewal Not Taken"], ["Pending"]
- productName: string[] — must match agency's actual product names (see list below)
- bundledStatus: "all" | "bundled" | "monoline" | "unknown"
- accountType: string[] — e.g. ["PL"], ["CL"]
- assignedTeamMemberId: string | "unassigned" — UUID of a team member or "unassigned"
- dateRangeStart: string — ISO date (YYYY-MM-DD)
- dateRangeEnd: string — ISO date (YYYY-MM-DD)
- search: string — free text search across name, policy number, email, phone
- zipCode: string[] — zip codes to filter by
- city: string[] — city names
- state: string[] — state abbreviations (2 letter)

### Client-side range filters
- premiumChangePercentMin: number — minimum premium change percentage
- premiumChangePercentMax: number — maximum premium change percentage
- premiumNewMin: number — minimum new premium amount
- premiumNewMax: number — maximum new premium amount
- amountDueMin: number — minimum amount due
- amountDueMax: number — maximum amount due

### Other filters
- carrierStatus: string[] — carrier statuses
- agentNumber: string[] — agent numbers

### Toggle overrides (booleans)
- showPriorityOnly: true — show only priority/starred records
- hideRenewalTaken: true — hide records with "Renewal Taken" status
- hideInCancelAudit: true — hide records in active cancel audit
- showFirstTermOnly: true — show only first-term renewals
- showDroppedOnly: true — show dropped records

## Top-Level Response Fields (NOT inside filters)

### sort (optional)
- { column: string, direction: "asc" | "desc" }
- Valid columns: renewal_effective_date, first_name, premium_new, premium_change_percent, product_name, current_status, renewal_status, amount_due, multi_line_indicator

### activeTab (optional)
- "all" | "uncontacted" | "pending" | "success" | "unsuccessful"

## This Agency's Team Members
${teamMemberList}

## This Agency's Product Names
${productList}

## Terminology Map
| User says | Maps to |
|-----------|---------|
| monolines / monoline / single-line / single line | bundledStatus: "monoline" |
| bundled / multi-line / multi line / multiline | bundledStatus: "bundled" |
| increase > X% / big increase / rate hike / rate increase | premiumChangePercentMin: X |
| decrease / went down / rate decrease | premiumChangePercentMax: 0 |
| small increase / minor increase | premiumChangePercentMin: 0, premiumChangePercentMax: 5 |
| big increase / large increase | premiumChangePercentMin: 15 |
| uncontacted / not touched / untouched / new | currentStatus: ["uncontacted"] |
| taken / renewed / retained | renewalStatus: ["Renewal Taken"] |
| not taken / lost / left | renewalStatus: ["Renewal Not Taken"] |
| priority / starred / flagged | showPriorityOnly: true |
| first term / first-term / 1st term / new business | showFirstTermOnly: true |
| dropped / missing / removed from report | showDroppedOnly: true |
| auto / car / automobile | productName matching the agency's auto product |
| home / homeowners / homeowner / HO | productName matching the agency's home product |
| renters / renter | productName matching the agency's renters product |
| assigned to [name] | assignedTeamMemberId: matching UUID from team list |
| unassigned / no one | assignedTeamMemberId: "unassigned" |
| in [zip] / zip [zip] / zipcode [zip] | zipCode: ["zip"] |
| in [city] | city: ["city"] |
| premium over/above $X | premiumNewMin: X |
| premium under/below $X | premiumNewMax: X |
| owes more than $X / amount due over $X | amountDueMin: X |
| this week / next week / this month | dateRangeStart and dateRangeEnd accordingly |
| sort by [column] / order by [column] | sort with appropriate column |
| clear / reset / show all / start over | empty filters {} |

## Rules
1. When the user REFINES a previous query (e.g. "now only in zip 43210"), MERGE the new filters with the previous filters from conversation context. Preserve previous filters unless the new query explicitly contradicts them.
2. When the user says "clear", "reset", "show all", or "start over", return empty filters {}.
3. The "summary" field must be natural language describing what's being shown (e.g. "Showing monoline policies with premium increases over 15%").
4. The optional "tip" field can contain a brief helpful insight or suggestion related to the filtered data.
5. When matching product names, fuzzy-match to the agency's actual product names. For example, "auto" should match "Auto", "Automobile", etc.
6. When matching team member names, fuzzy-match to the closest name. First names are sufficient.
7. Only include filter fields that are relevant to the query. Do not include fields with empty/null/default values.
8. Always return valid JSON matching this schema: { filters: {...}, sort?: {...}, activeTab?: string, summary: string, tip?: string }
9. If the query is unclear or doesn't map to any filters, return empty filters with a helpful summary explaining what you can filter by.
10. Today's date is ${new Date().toISOString().split('T')[0]}.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate: try staff session first (supabase.functions.invoke always sends
    // Authorization: Bearer <anon_key> which verifyRequest treats as a JWT, blocking
    // the staff session path). If no staff session, fall back to verifyRequest for JWT.
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
      console.error("[parse_renewal_query] Missing OPENAI_API_KEY");
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
      productNames = [],
    } = body as {
      query: string;
      conversation: { role: string; content: string }[];
      teamMembers: { id: string; name: string }[];
      productNames: string[];
    };

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build messages: system prompt + last 6 conversation messages (3 turns) + new user query
    const systemPrompt = buildSystemPrompt(teamMembers, productNames);
    const recentConversation = conversation.slice(-6);

    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
      ...recentConversation.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: query },
    ];

    console.log(`[parse_renewal_query] Processing query: "${query}" for agency ${agencyId}, ${recentConversation.length} prior messages`);

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
      console.error("[parse_renewal_query] OpenAI API error:", openaiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiData = await openaiResponse.json();
    const choice = openaiData.choices?.[0];

    if (!choice?.message?.content) {
      console.error("[parse_renewal_query] No content in OpenAI response");
      return new Response(JSON.stringify({ error: "AI returned empty response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(choice.message.content);
    } catch (parseErr) {
      console.error("[parse_renewal_query] Failed to parse AI JSON:", choice.message.content);
      return new Response(JSON.stringify({ error: "AI returned invalid JSON" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize: AI may nest sort/activeTab inside filters, or omit the filters wrapper.
    // Check both top-level and inside filters for sort/activeTab.
    const rawFilters = parsed.filters || {};
    const sort = parsed.sort || rawFilters.sort || undefined;
    const activeTab = parsed.activeTab || rawFilters.activeTab || undefined;

    // Remove non-filter keys from filters if the AI placed them there
    const { sort: _s, activeTab: _t, summary: _sm, tip: _tp, ...cleanFilters } = rawFilters;

    const result = {
      filters: cleanFilters,
      sort: sort || undefined,
      activeTab: activeTab || undefined,
      summary: parsed.summary || rawFilters.summary || "Filters applied",
      tip: parsed.tip || rawFilters.tip || undefined,
    };

    const usage = openaiData.usage
      ? { input_tokens: openaiData.usage.prompt_tokens, output_tokens: openaiData.usage.completion_tokens }
      : undefined;

    console.log(`[parse_renewal_query] Result: ${JSON.stringify(result.filters)}, summary: "${result.summary}"`);

    return new Response(JSON.stringify({ result, usage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[parse_renewal_query] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
