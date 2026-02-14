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

function toMmSs(value: number) {
  return formatSeconds(value);
}

function extractQuestionTokens(question: string): string[] {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function scoreSegmentForQuestion(segmentText: string, questionTokens: string[]): number {
  if (questionTokens.length === 0) {
    return 0;
  }

  const normalizedText = normalizeSegmentText(segmentText);
  const segmentTokens = normalizedText.split(' ').filter(Boolean);
  if (segmentTokens.length === 0) {
    return 0;
  }
  const effectiveTokens = extractSignalTokens(questionTokens);
  const matchTokens = effectiveTokens.length > 0 ? effectiveTokens : questionTokens;

  const tokenSet = new Set(segmentTokens);
  const overlap = matchTokens.reduce((total, token) => total + (tokenSet.has(token) ? 1 : 0), 0);
  const phraseBonuses = [
    matchTokens.slice(0, Math.min(3, matchTokens.length)).join(' '),
    matchTokens.slice(-Math.min(3, matchTokens.length)).join(' '),
  ].filter(Boolean)
    .reduce((total, phrase) => total + (normalizedText.includes(phrase) ? 2 : 0), 0);

  const density = (overlap / Math.max(matchTokens.length, 1));
  return overlap * 2 + phraseBonuses + density * 2;
}

function findLocalMatches(
  segments: TranscriptSegment[],
  questionTokens: string[],
  maxMatches = 3,
): Array<{
  timestamp_seconds: number;
  speaker: string | null;
  quote: string;
  context: string | null;
  score: number;
}> {
  if (!Array.isArray(segments) || segments.length === 0 || questionTokens.length === 0) {
    return [];
  }

  const ranked = segments
    .map((segment) => ({
      segment,
      score: scoreSegmentForQuestion(segment.text, questionTokens),
    }))
    .filter((row) => row.score >= 3)
    .sort((a, b) => b.score - a.score || a.segment.start - b.segment.start)
    .slice(0, maxMatches)
    .map((row) => {
      const quote = row.segment.text.trim().slice(0, 240);
      return {
        timestamp_seconds: row.segment.start,
        speaker: row.segment.speaker ? row.segment.speaker.toLowerCase() : null,
        quote: quote || row.segment.text,
        context: row.segment.text,
        score: row.score,
      };
    });

  return ranked;
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

function parseTimestampInput(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return null;

    const colonMatch = raw.match(/^(\d+):(\d{2}):(\d{2})$/);
    if (colonMatch) {
      const hours = Number(colonMatch[1]);
      const mins = Number(colonMatch[2]);
      const secs = Number(colonMatch[3]);
      const total = (hours * 60 * 60) + (mins * 60) + secs;
      return Number.isFinite(total) ? total : null;
    }

    const mmssMatch = raw.match(/^(\d+):(\d{1,2})$/);
    if (mmssMatch) {
      const mins = Number(mmssMatch[1]);
      const secs = Number(mmssMatch[2]);
      if (!Number.isFinite(mins) || !Number.isFinite(secs)) return null;
      const total = mins * 60 + secs;
      return Number.isFinite(total) ? total : null;
    }

    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
}

function extractSignalTokens(questionTokens: string[]): string[] {
  if (!Array.isArray(questionTokens) || questionTokens.length === 0) {
    return [];
  }

  const deduped = [...new Set(questionTokens.map((token) => token.toLowerCase()))];
  const comparisonSignals = new Set(["compare", "vs", "versus", "difference", "option", "options", "instead"]);
  const policySignals = new Set([
    "coverage",
    "coverages",
    "liability",
    "deductible",
    "umbrella",
    "uninsured",
    "collision",
    "comp",
    "comprehensive",
    "pup",
    "bundling",
    "quote",
    "vehicle",
    "auto",
    "home",
    "policy",
    "insured",
    "carrier",
    "premium",
    "payment",
  ]);

  const preferred = deduped.filter(
    (token) => comparisonSignals.has(token) || policySignals.has(token) || token.length > 7,
  );
  if (preferred.length > 0) return preferred.slice(0, 8);

  return deduped.slice(0, 5);
}

function quoteMatchesQuestionSignals(quote: string, questionTokens: string[]): boolean {
  if (questionTokens.length === 0) {
    return quote.trim().length >= 8;
  }

  const quoteTokens = new Set(tokenizeForMatch(quote));
  if (quoteTokens.size === 0) {
    return false;
  }

  const normalizedQuestionTokens = questionTokens.map((token) => token.toLowerCase());
  const signalTokens = extractSignalTokens(normalizedQuestionTokens).map((token) => token.toLowerCase());

  const overlapTargets = signalTokens.length > 0 ? signalTokens : normalizedQuestionTokens;
  const requiredOverlap = overlapTargets.length <= 2
    ? 1
    : Math.min(4, Math.max(2, Math.ceil(overlapTargets.length * 0.45)));
  let matches = 0;
  for (const token of overlapTargets) {
    if (quoteTokens.has(token)) {
      matches += 1;
      if (matches >= requiredOverlap) return true;
    }
  }

  // Fallback for semantic phrase overlap for questions with unique wording.
  const quoteNorm = normalizeSegmentText(quote);
  const questionPhrases = [
    overlapTargets.slice(0, Math.min(4, overlapTargets.length)).join(" "),
    overlapTargets.slice(Math.max(0, overlapTargets.length - 3)).join(" "),
  ];
  return questionPhrases.some((phrase) => phrase.length > 0 && quoteNorm.includes(phrase));
}

function isEarliestMentionRequest(question: string): boolean {
  const normalized = question.toLowerCase();
  return (
    normalized.includes("first") ||
    normalized.includes("earliest") ||
    normalized.includes("earliest mention") ||
    normalized.includes("when did they first")
  );
}

function getMatchStrength(
  segmentText: string,
  questionTokens: string[],
  quote: string,
): number {
  if (!segmentText || !quote) {
    return 0;
  }

  const normalizedQuestionTokens = questionTokens.map((token) => token.toLowerCase());
  const signalTokens = extractSignalTokens(normalizedQuestionTokens);
  const anchorTokens = signalTokens.length > 0 ? signalTokens : normalizedQuestionTokens;
  const quoteTokens = tokenizeForMatch(quote);
  if (quoteTokens.length === 0) {
    return 0;
  }

  const quoteSet = new Set(quoteTokens);
  const segmentTokens = tokenizeForMatch(segmentText);
  const segmentSet = new Set(segmentTokens);

  const overlapWithQuestion = normalizedQuestionTokens.reduce(
    (total, token) => total + (anchorTokens.includes(token) && quoteSet.has(token) ? 1 : 0),
    0,
  );
  const questionCoverage = overlapWithQuestion / Math.max(anchorTokens.length, 1);

  const quoteCoverage = quoteSet.size > 0
    ? Math.min(quoteSet.size / Math.max(anchorTokens.length, 1), 1)
    : 0;

  const segmentCoverage = quoteSet.size / Math.max(segmentSet.size, 1);
  const quoteNorm = normalizeSegmentText(quote);
  const segmentNorm = normalizeSegmentText(segmentText);
  const exactMatchBoost = quoteNorm && segmentNorm.includes(quoteNorm) ? 0.8 : 0;

  return (questionCoverage * 0.55) + (quoteCoverage * 0.2) + (segmentCoverage * 0.15) + exactMatchBoost;
}

function findBestSegmentForQuote(
  segments: TranscriptSegment[],
  quote: string,
  questionTokens: string[],
): TranscriptSegment | null {
  const quoteNorm = normalizeSegmentText(quote);
  const quoteTokens = tokenizeForMatch(quote);
  if (!quoteNorm || quoteTokens.length === 0) return null;

  const searchSet = new Set(extractSignalTokens(questionTokens).map((token) => token.toLowerCase()));
  const best = segments
    .map((segment) => {
      const segmentNorm = normalizeSegmentText(segment.text);
      const segmentTokens = segmentNorm ? segmentNorm.split(" ") : [];
      const overlap = quoteTokens.reduce(
        (total, token) => total + (segmentTokens.includes(token) ? 1 : 0),
        0,
      );
      const questionAnchor = searchSet.size === 0
        ? 0
        : quoteTokens.reduce((total, token) => total + (searchSet.has(token) ? 1 : 0), 0) / searchSet.size;
      const exactMatch = segmentNorm.includes(quoteNorm) ? 1.8 : 0;
      const score = exactMatch + (overlap / Math.max(quoteTokens.length, 1)) + (questionAnchor * 0.8);
      return { segment, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.segment.start - b.segment.start)
    .at(0);

  return best ? best.segment : null;
}

function findMatchingSegment(
  segments: TranscriptSegment[],
  timestamp: number,
  quote: string,
): TranscriptSegment | null {
  const quoteNorm = normalizeSegmentText(quote);
  let bestMatch: TranscriptSegment | null = null;
  let bestGap = Number.POSITIVE_INFINITY;
  const quoteTokens = tokenizeForMatch(quote);
  if (quoteTokens.length === 0) {
    return null;
  }

  for (const segment of segments) {
    const segmentNorm = normalizeSegmentText(segment.text);
    const segmentTokens = segmentNorm.split(" ");
    const tokenMatch = quoteTokens.reduce(
      (total, token) => total + (segmentTokens.includes(token) ? 1 : 0),
      0,
    );
    const tokenCoverage = tokenMatch / Math.max(quoteTokens.length, 1);
    const startsNearTimestamp = timestamp >= segment.start - 2 && timestamp <= segment.end + 2;
    const quoteInSegment = !!(quoteNorm && segmentNorm.includes(quoteNorm));
    const tokenInSegment = tokenCoverage >= 0.45 || (tokenMatch >= 2 && quoteTokens.length <= 3);

    if (startsNearTimestamp && (quoteInSegment || tokenInSegment)) {
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

  return bestGap <= 12 ? bestMatch : null;
}

function sanitizeResult(
  parsed: unknown,
  selectedSegments: TranscriptSegment[],
  questionTokens: string[],
  fallbackSegments: TranscriptSegment[],
  questionText: string,
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
  const questionSignalTokens = extractSignalTokens(questionTokens);

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

      const rawTimestamp = parseTimestampInput(match.timestamp_seconds);

      const segment = rawTimestamp !== null
        ? findMatchingSegment(selectedSegments, rawTimestamp, quote) || findBestSegmentForQuote(fallbackSegments, quote, questionSignalTokens)
        : findBestSegmentForQuote(fallbackSegments, quote, questionSignalTokens);
      if (!segment) return null;

      const validatedTimestamp = rawTimestamp !== null
        ? Math.min(Math.max(rawTimestamp, segment.start), segment.end)
        : segment.start;

      if (!quoteMatchesQuestionSignals(quote, questionSignalTokens)) {
        return null;
      }

      const matchStrength = getMatchStrength(segment.text, questionSignalTokens, quote);
      if (matchStrength < 0.42) {
        return null;
      }

        return {
        timestamp_seconds: Number.isFinite(validatedTimestamp)
          ? validatedTimestamp
          : segment.start,
        speaker: normalizedSpeaker,
        quote: quote.substring(0, 240),
        context: typeof match.context === "string" ? match.context : null,
        score: matchStrength,
      };
    })
    .filter(Boolean) as (QaMatch & { score: number })[];

  const matches = validatedMatches
    .sort((a, b) => b.score - a.score || (a.timestamp_seconds ?? 0) - (b.timestamp_seconds ?? 0))
    .slice(0, 8)
    .filter(
    (match, index, arr) => arr.findIndex((m) =>
      m.timestamp_seconds === match.timestamp_seconds && m.quote === match.quote
    ) === index,
  );

  const reliableEvidence = matches.filter((match) => {
    if (!match.timestamp_seconds && match.timestamp_seconds !== 0) return false;
    const segment = fallbackSegments.find(
      (candidate) =>
        (match.timestamp_seconds ?? 0) >= candidate.start - 2 &&
        (match.timestamp_seconds ?? 0) <= candidate.end + 2 &&
        normalizeSegmentText(candidate.text).includes(normalizeSegmentText(match.quote)),
    );
    return !!segment;
  });

  if (reliableEvidence.length === 0) {
    const fallbackMatches = findLocalMatches(fallbackSegments, questionTokens, 3).map((item) => ({
      timestamp_seconds: item.timestamp_seconds,
      speaker: item.speaker,
      quote: item.quote,
      context: item.context,
      score: item.score,
    }));

    const orderedMatches = isEarliestMentionRequest(questionText)
      ? fallbackMatches.sort((a, b) => a.timestamp_seconds - b.timestamp_seconds)
      : fallbackMatches;

    if (orderedMatches.length > 0 && orderedMatches[0].score >= 4) {
      return {
        question: String(data.question || ""),
        verdict: "partial",
        confidence: 0.4,
        summary: "No model-confirmed match passed quality checks. Returning the strongest local matches from transcript scoring.",
        matches: isEarliestMentionRequest(questionText)
          ? orderedMatches.slice(0, 1)
          : orderedMatches,
      };
    }

    return {
      question: String(data.question || ""),
      verdict: "not_found",
      confidence: 0,
      summary: "No reliable timeline match was found for this question.",
      matches: [],
    };
  }

  let normalizedMatches = reliableEvidence;
  if (isEarliestMentionRequest(questionText)) {
    normalizedMatches = reliableEvidence
      .slice()
      .sort((a, b) => (a.timestamp_seconds ?? Infinity) - (b.timestamp_seconds ?? Infinity))
      .slice(0, 1);
  }

  let verdict: "found" | "partial" | "not_found" = normalizedMatches.length > 1 ? "found" : "partial";
  if (reliableEvidence.length === 0) verdict = "not_found";

  return {
    question: String(data.question || ""),
    verdict: verdict === "not_found" ? "not_found" : verdict,
    confidence: reliableEvidence.length > 0 ? confidence : 0,
    summary,
    matches: normalizedMatches,
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
    const result = sanitizeResult(parsed, selectedSegments, questionTokens, fullSegments, question);

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
