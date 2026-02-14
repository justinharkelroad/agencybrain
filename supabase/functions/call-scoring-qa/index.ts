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

const STOP_WORDS = new Set([
  'the','is','are','and','a','an','to','of','it','they','this','that','there','here','did','do','you','your','yourself','we','he','she','was','were','been','with','for','on','at','in','by','from','how','when','where','what','which','who','their','then','than','can','could','would','should','about','just','only','or','if','as','at','so','if','up','out'
]);

function tokenizeForMatch(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function formatSeconds(value: number) {
  const mins = Math.floor(value / 60);
  const secs = Math.floor(value % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function extractQuestionTokens(question: string): string[] {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function pickSegmentWindow(segments: TranscriptSegment[], indices: Set<number>, extraWindow = 1): TranscriptSegment[] {
  const result: TranscriptSegment[] = [];
  const added = new Set<number>();

  indices.forEach((idx) => {
    for (let offset = -extraWindow; offset <= extraWindow; offset++) {
      const segmentIdx = idx + offset;
      if (segmentIdx < 0 || segmentIdx >= segments.length) continue;
      if (!added.has(segmentIdx)) {
        result.push(segments[segmentIdx]);
        added.add(segmentIdx);
      }
    }
  });

  return result.sort((a, b) => a.start - b.start);
}

function selectSegments(segments: TranscriptSegment[], question: string): TranscriptSegment[] {
  if (!Array.isArray(segments) || segments.length === 0) {
    return [];
  }

  const tokens = extractQuestionTokens(question);
  if (tokens.length === 0) {
    return segments.slice(0, 12);
  }

  const scored = segments.map((segment, index) => {
    const text = (segment.text || '').toLowerCase();
    const phraseFragments = [
      tokens.slice(0, 2).join(" "),
      tokens.slice(1, 3).join(" "),
      tokens.slice(0, Math.min(4, tokens.length)).join(" "),
    ].filter(Boolean);

    const score = tokens.reduce((total, token) => {
      const regex = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      return total + (regex.test(text) ? 1 : 0);
    }, 0) + phraseFragments.reduce((total, phrase) => total + (text.includes(phrase) ? 2 : 0), 0);
    return { segment, index, score };
  });

  const best = scored
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.segment.start - b.segment.start)
    .slice(0, 12)
    .map((row) => row.index);
  if (best.length === 0) {
    return [];
  }

  const finalIndexes = new Set<number>(best);
  const windowed = pickSegmentWindow(segments, finalIndexes);

  if (windowed.length === 0) {
    return [];
  }
  return windowed.slice(0, 20);
}

function normalizeSegmentText(text: string): string {
  return tokenizeForMatch(text).join(" ");
}

function quoteMatchesQuestionSignals(quote: string, questionTokens: string[]): boolean {
  if (questionTokens.length === 0) {
    return quote.trim().length >= 8;
  }

  const quoteTokens = new Set(tokenizeForMatch(quote));
  if (quoteTokens.size === 0) {
    return false;
  }

  const requiredOverlap = Math.min(2, questionTokens.length);
  let matches = 0;
  for (const token of questionTokens) {
    if (quoteTokens.has(token)) {
      matches += 1;
      if (matches >= requiredOverlap) return true;
    }
  }
  return false;
}

function findMatchingSegment(
  segments: TranscriptSegment[],
  timestamp: number,
  quote: string,
): TranscriptSegment | null {
  const quoteNorm = normalizeSegmentText(quote);
  let bestMatch: TranscriptSegment | null = null;
  let bestGap = Number.POSITIVE_INFINITY;

  for (const segment of segments) {
    const segmentNorm = normalizeSegmentText(segment.text);
    const startsNearTimestamp = timestamp >= segment.start - 2 && timestamp <= segment.end + 2;
    const quoteInSegment = !!(quoteNorm && segmentNorm.includes(quoteNorm));
    if (startsNearTimestamp && (quoteInSegment || quoteNorm === "")) {
      return segment;
    }

    if (timestamp < segment.start) {
      const gap = segment.start - timestamp;
      if (gap < bestGap) {
        bestGap = gap;
        bestMatch = segment;
      }
      continue;
    }

    if (timestamp > segment.end) {
      const gap = timestamp - segment.end;
      if (gap < bestGap) {
        bestGap = gap;
        bestMatch = segment;
      }
      continue;
    }
  }

  return bestGap <= 8 ? bestMatch : null;
}

function sanitizeResult(
  parsed: unknown,
  selectedSegments: TranscriptSegment[],
  questionTokens: string[],
): QaResult {
  const fallback: QaResult = {
    question: "",
    verdict: "not_found",
    confidence: 0,
    summary: "No matching moments found.",
    matches: [],
  };

  if (!parsed || typeof parsed !== 'object') return fallback;
  const data = parsed as Record<string, unknown>;

  const rawConfidence = Number(
    typeof data.confidence === "number" || typeof data.confidence === "string"
      ? data.confidence
      : 0,
  );
  let confidence = 0;
  if (Number.isFinite(rawConfidence)) {
    if (rawConfidence > 1 && rawConfidence <= 100) {
      confidence = rawConfidence / 100;
    } else {
      confidence = rawConfidence;
    }
    confidence = Math.max(0, Math.min(1, confidence));
  }

  const summary = typeof data.summary === "string" && data.summary.trim().length > 0 ? data.summary.trim() : fallback.summary;
  const rawMatches = Array.isArray(data.matches)
    ? data.matches as Array<Record<string, unknown>>
    : [];

  const validatedMatches = rawMatches
    .map((match) => {
      const rawSpeaker =
        typeof match.speaker === "string"
          ? match.speaker.toLowerCase()
          : null;

      const normalizedSpeaker =
        rawSpeaker === "customer" || rawSpeaker === "caller" || rawSpeaker === "customer side"
          ? "customer"
          : rawSpeaker === "agent" || rawSpeaker === "rep" || rawSpeaker === "sales"
          ? "agent"
          : null;

      const quote = typeof match.quote === "string" ? match.quote : "";
      if (!quote.trim()) return null;

      const rawTimestamp = Number(match.timestamp_seconds);

      const segment = findMatchingSegment(selectedSegments, rawTimestamp, quote);
      if (!segment) return null;

      const validatedTimestamp = Number.isFinite(rawTimestamp)
        ? Math.min(Math.max(rawTimestamp, segment.start), segment.end)
        : segment.start;

      if (!quoteMatchesQuestionSignals(quote, questionTokens)) {
        return null;
      }

      return {
        timestamp_seconds: Number.isFinite(validatedTimestamp)
          ? validatedTimestamp
          : segment.start,
        speaker: normalizedSpeaker,
        quote,
        context: typeof match.context === "string" ? match.context : null,
      };
    })
    .filter(Boolean) as QaMatch[];

  const matches = validatedMatches.slice(0, 8).filter(
    (match, index, arr) => arr.findIndex((m) =>
      m.timestamp_seconds === match.timestamp_seconds && m.quote === match.quote
    ) === index,
  );

  const reliableEvidence = matches.filter((match) => {
    if (!match.timestamp_seconds && match.timestamp_seconds !== 0) return false;
    const segment = selectedSegments.find(
      (candidate) =>
        match.timestamp_seconds >= candidate.start - 2 &&
        match.timestamp_seconds <= candidate.end + 2 &&
        normalizeSegmentText(candidate.text).includes(normalizeSegmentText(match.quote)),
    );
    return !!segment;
  });

  if (reliableEvidence.length === 0) {
    return {
      question: String(data.question || ""),
      verdict: "not_found",
      confidence: 0,
      summary: "No reliable timeline match was found for this question.",
      matches: [],
    };
  }

  let verdict: "found" | "partial" | "not_found" = reliableEvidence.length > 1 ? "found" : "partial";
  if (reliableEvidence.length === 0) verdict = "not_found";

  return {
    question: String(data.question || ""),
    verdict: verdict === "not_found" ? "not_found" : verdict,
    confidence: reliableEvidence.length > 0 ? confidence : 0,
    summary,
    matches: reliableEvidence,
  };
}

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return getErrorResponse("Method not allowed", 405);
  }

  try {
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
    const isLocalRuntime = (
      (Deno.env.get("SUPABASE_URL") || "").includes("kong:8000")
      || (Deno.env.get("SUPABASE_URL") || "").includes("127.0.0.1")
    );
    const openAiKey = envOpenAiKey || (isLocalRuntime ? fallbackOpenAiKey : null);

    if (!openAiKey) {
      return getErrorResponse("OpenAI API key not configured", 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: featureAccess } = await supabase
      .from("agency_feature_access")
      .select("id")
      .eq("agency_id", authResult.agencyId)
      .eq("feature_key", "call_scoring_qa")
      .maybeSingle();

    if (!featureAccess?.id) {
      return getErrorResponse("Call scoring Q&A feature is not enabled for this agency", 403);
    }

    const { data: rawCallRecord, error: callError } = await supabase
      .from("agency_calls")
      .select("*")
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

    if (callRecord.transcript_segments == null) {
      return getErrorResponse("No transcript segments available for this call", 409);
    }

    const fullSegments = Array.isArray(callRecord.transcript_segments)
      ? callRecord.transcript_segments
          .map((segment: Partial<TranscriptSegment>) => ({
            start: Number(segment?.start),
            end: Number(segment?.end),
            text: String(segment?.text || ""),
            speaker: typeof segment?.speaker === "string" ? segment.speaker : null,
          }))
          .filter(
            (segment) =>
              Number.isFinite(segment.start) &&
              Number.isFinite(segment.end) &&
              segment.text.trim().length > 0
          )
      : [];

    if (fullSegments.length === 0) {
      return getErrorResponse("Timestamped transcript segments are required for timeline Q&A", 409);
    }

    const selectedSegments = fullSegments.length > 0
      ? selectSegments(fullSegments, question)
      : [];

    const segmentPrompt = selectedSegments.length > 0
      ? selectedSegments
          .map((segment) => {
            const speaker = segment.speaker ? ` ${segment.speaker}` : "";
            return `[${formatSeconds(segment.start)} - ${formatSeconds(segment.end)}${speaker}] ${segment.text}`;
          })
          .join("\n")
      : "No per-segment timestamps available.";

    const systemPrompt = "You are a concise assistant helping a call coach identify where topics were discussed. Only answer from provided transcript snippets and timestamps. Do not invent, guess, or infer any timestamps or quotes. If no strong evidence exists, return empty matches and verdict \"not_found\".";
    const userPrompt = `
Question from coach:
"${question}"

Task:
1) Find moments in the call where this was discussed.
2) For each moment, return the timestamp in seconds (when the quote starts), a short quote, and short context.
3) Only return a match if the quote text appears in the provided snippets and the timestamp is inside or very near that segment.
4) If there are no strong matches, return an empty matches array with verdict "not_found".

Transcript snippets:
${segmentPrompt}

Return ONLY valid JSON with this exact shape:
{
  "question": string,
  "verdict": "found" | "partial" | "not_found",
  "confidence": number,
  "summary": string,
  "matches": [
    {
      "timestamp_seconds": number,
      "speaker": string | null,
      "quote": string,
      "context": string | null
    }
  ]
}
`;

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.15,
        response_format: { type: "json_object" },
        max_tokens: 700,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!openAiRes.ok) {
      const errorText = await openAiRes.text();
      console.error("[call-scoring-qa] OpenAI error", errorText);
      return getErrorResponse("Failed to run assistant analysis", 500);
    }

    const openAiJson = await openAiRes.json();
    const content = openAiJson?.choices?.[0]?.message?.content;

    if (!content) {
      return getErrorResponse("No response content from analysis model", 500);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      console.error("[call-scoring-qa] Failed to parse JSON", error);
      return getErrorResponse("Invalid response format from model", 500);
    }

    const questionTokens = extractQuestionTokens(question);
    const result = sanitizeResult(parsed, selectedSegments, questionTokens);

    const response: QaResult = {
      ...result,
      question,
      matches: result.matches.slice(0, 8).map((match) => ({
        ...match,
        context: match.context || null,
        speaker: match.speaker || null,
      })),
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
