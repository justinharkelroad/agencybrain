import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  verifyRequest,
  isVerifyError,
  type VerifyError,
} from "../_shared/verifyRequest.ts";

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string | null;
}

interface QaRequestBody {
  call_id: string;
  question: string;
}

interface QaMatch {
  timestamp_seconds?: number | null;
  speaker?: string | null;
  quote: string;
  context?: string | null;
}

interface QaResult {
  question: string;
  verdict: "found" | "partial" | "not_found";
  confidence: number;
  summary: string;
  matches: QaMatch[];
}

interface StoredCallRecord {
  id: string;
  agency_id: string;
  team_member_id: string | null;
  transcript: string | null;
  transcript_segments?: unknown | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatSeconds(value: number): string {
  const mins = Math.floor(value / 60);
  const secs = Math.floor(value % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return null;
    const hms = raw.match(/^(\d+):(\d{2}):(\d{2})$/);
    if (hms) return Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]);
    const ms = raw.match(/^(\d+):(\d{1,2})$/);
    if (ms) return Number(ms[1]) * 60 + Number(ms[2]);
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Find the segment whose time range is closest to `ts`. */
function snapToSegment(
  segments: TranscriptSegment[],
  ts: number,
): TranscriptSegment | null {
  let best: TranscriptSegment | null = null;
  let bestDist = Infinity;
  for (const seg of segments) {
    // If ts falls inside the segment, perfect match
    if (ts >= seg.start && ts <= seg.end) return seg;
    const dist = ts < seg.start ? seg.start - ts : ts - seg.end;
    if (dist < bestDist) {
      bestDist = dist;
      best = seg;
    }
  }
  // Allow up to 15s tolerance for GPT timestamp drift
  return bestDist <= 15 ? best : null;
}

function normalizeSpeaker(raw: unknown): string | null {
  if (!raw || typeof raw !== "string") return null;
  const lower = raw.toLowerCase().trim();
  if (["customer", "caller", "customer side", "client"].includes(lower)) return "customer";
  if (["agent", "rep", "sales", "representative"].includes(lower)) return "agent";
  return lower;
}

function buildTranscriptPrompt(segments: TranscriptSegment[]): string {
  return segments
    .map((seg) => {
      const speaker = seg.speaker ? ` ${seg.speaker}` : "";
      return `[${formatSeconds(seg.start)} - ${formatSeconds(seg.end)}${speaker}] ${seg.text}`;
    })
    .join("\n");
}

/* ------------------------------------------------------------------ */
/*  Response helpers                                                  */
/* ------------------------------------------------------------------ */

function getErrorResponse(error: string, status = 400) {
  return new Response(
    JSON.stringify({ error }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function getAuthAccessError(auth: VerifyError) {
  return new Response(
    JSON.stringify({ error: auth.error }),
    { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/* ------------------------------------------------------------------ */
/*  Main handler                                                      */
/* ------------------------------------------------------------------ */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return getErrorResponse("Method not allowed", 405);
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────
    const authResult = await verifyRequest(req);
    if (isVerifyError(authResult)) return getAuthAccessError(authResult);

    const body = (await req.json()) as QaRequestBody;
    const callId = body?.call_id?.trim();
    const question = body?.question?.trim();

    if (!callId || !question) {
      return getErrorResponse("Missing call_id or question");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const envOpenAiKey = Deno.env.get("OPENAI_API_KEY");
    const fallbackOpenAiKey = req.headers.get("x-openai-api-key");
    const isLocalRuntime =
      (supabaseUrl || "").includes("kong:8000") ||
      (supabaseUrl || "").includes("127.0.0.1");
    const openAiKey = envOpenAiKey || (isLocalRuntime ? fallbackOpenAiKey : null);

    if (!openAiKey) {
      return getErrorResponse("OpenAI API key not configured", 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Feature flag ─────────────────────────────────────────────
    const { data: featureAccess } = await supabase
      .from("agency_feature_access")
      .select("id")
      .eq("agency_id", authResult.agencyId)
      .eq("feature_key", "call_scoring_qa")
      .maybeSingle();

    if (!featureAccess?.id) {
      return getErrorResponse("Call scoring Q&A feature is not enabled for this agency", 403);
    }

    // ── Load call ────────────────────────────────────────────────
    const { data: rawCallRecord, error: callError } = await supabase
      .from("agency_calls")
      .select("id, agency_id, team_member_id, transcript_segments")
      .eq("id", callId)
      .single();

    const callRecord = rawCallRecord as StoredCallRecord | null;

    if (callError || !callRecord) {
      console.error("[call-scoring-qa] call lookup error", callError);
      return getErrorResponse("Call not found", 404);
    }

    if (callRecord.agency_id !== authResult.agencyId) {
      return getErrorResponse("You do not have access to this call", 403);
    }

    if (authResult.mode === "staff") {
      if (!authResult.staffMemberId) {
        return getErrorResponse("Staff account is not linked to a team member", 403);
      }
      if (!authResult.isManager && callRecord.team_member_id !== authResult.staffMemberId) {
        return getErrorResponse("You do not have access to this call", 403);
      }
    }

    // ── Parse segments ───────────────────────────────────────────
    if (callRecord.transcript_segments == null) {
      return getErrorResponse("No transcript segments available for this call", 409);
    }

    const segments: TranscriptSegment[] = Array.isArray(callRecord.transcript_segments)
      ? (callRecord.transcript_segments as Partial<TranscriptSegment>[])
          .map((s) => ({
            start: Number(s?.start),
            end: Number(s?.end),
            text: String(s?.text || ""),
            speaker: typeof s?.speaker === "string" ? s.speaker : null,
          }))
          .filter(
            (s) =>
              Number.isFinite(s.start) &&
              Number.isFinite(s.end) &&
              s.text.trim().length > 0,
          )
      : [];

    if (segments.length === 0) {
      return getErrorResponse("Timestamped transcript segments are required for timeline Q&A", 409);
    }

    // ── Send FULL transcript to GPT ──────────────────────────────
    // gpt-4o-mini handles 128K context. A 30-min call ≈ 6K tokens.
    // Sending everything avoids the keyword pre-filter that was
    // causing the system to miss relevant segments.
    const transcriptText = buildTranscriptPrompt(segments);

    const systemPrompt = `You are a call transcript analyst. A coach will ask a question about a recorded insurance call. Your job is to find the exact moments in the transcript where the topic was discussed.

Rules:
- ONLY use quotes and timestamps from the provided transcript. Never invent or guess.
- Return timestamps as the number of seconds from the start of the call (use the start time shown in brackets).
- Include the actual words spoken as the quote, copied from the transcript.
- If the topic was discussed multiple times, return ALL relevant moments.
- If you genuinely cannot find any discussion of the topic, return verdict "not_found" with empty matches.`;

    const userPrompt = `Question from coach:
"${question}"

Full call transcript:
${transcriptText}

Return ONLY valid JSON:
{
  "question": string,
  "verdict": "found" | "partial" | "not_found",
  "confidence": number between 0 and 1,
  "summary": string (1-2 sentence answer to the coach's question),
  "matches": [
    {
      "timestamp_seconds": number (seconds from call start),
      "speaker": "agent" | "customer" | null,
      "quote": string (exact words from transcript),
      "context": string (brief context of what was being discussed)
    }
  ]
}`;

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        max_tokens: 3000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!openAiRes.ok) {
      const errorText = await openAiRes.text();
      console.error("[call-scoring-qa] OpenAI error", openAiRes.status, errorText);
      return getErrorResponse("Failed to run assistant analysis", 500);
    }

    const openAiJson = await openAiRes.json();
    const content = openAiJson?.choices?.[0]?.message?.content;

    if (!content) {
      return getErrorResponse("No response content from analysis model", 500);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("[call-scoring-qa] Failed to parse JSON:", content);
      return getErrorResponse("Invalid response format from model", 500);
    }

    // ── Light validation — snap timestamps to real segments ──────
    const rawMatches = Array.isArray(parsed.matches)
      ? (parsed.matches as Array<Record<string, unknown>>)
      : [];

    const validatedMatches: QaMatch[] = [];
    for (const match of rawMatches) {
      const quote = typeof match.quote === "string" ? match.quote.trim() : "";
      if (!quote) continue;

      const rawTs = parseTimestamp(match.timestamp_seconds);
      const segment = rawTs !== null ? snapToSegment(segments, rawTs) : null;

      validatedMatches.push({
        timestamp_seconds: segment ? segment.start : (rawTs ?? null),
        speaker: normalizeSpeaker(match.speaker),
        quote: quote.substring(0, 300),
        context: typeof match.context === "string" ? match.context : null,
      });
    }

    // Dedupe by timestamp
    const seen = new Set<string>();
    const dedupedMatches = validatedMatches.filter((m) => {
      const key = `${m.timestamp_seconds ?? "x"}-${m.quote.slice(0, 40)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Confidence
    let confidence = Number(parsed.confidence);
    if (!Number.isFinite(confidence)) confidence = 0;
    if (confidence > 1 && confidence <= 100) confidence /= 100;
    confidence = Math.max(0, Math.min(1, confidence));

    const verdict: QaResult["verdict"] =
      dedupedMatches.length >= 2
        ? "found"
        : dedupedMatches.length === 1
          ? "partial"
          : "not_found";

    const summary =
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : dedupedMatches.length > 0
          ? "Found matching moments in the call."
          : "No matching moments found for this question.";

    const response: QaResult = {
      question,
      verdict,
      confidence: dedupedMatches.length > 0 ? confidence : 0,
      summary,
      matches: dedupedMatches.slice(0, 8),
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[call-scoring-qa] unexpected error", error);
    return getErrorResponse("Internal server error", 500);
  }
});
