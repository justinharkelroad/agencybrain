import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

interface DraftRequest {
  transcript: string;
  session_date?: string | null;
}

interface DraftResponse {
  suggested_title: string;
  summary: string;
  key_points: string[];
  wins: string[];
  issues: string[];
  top_commitments: string[];
}

const jsonExample = `{
  "suggested_title": "March accountability session",
  "summary": "One short paragraph summarizing the real business conversation without speaker labels.",
  "key_points": ["Point one", "Point two", "Point three"],
  "wins": ["Win one", "Win two"],
  "issues": ["Issue one", "Issue two"],
  "top_commitments": ["Commitment one", "Commitment two", "Commitment three"]
}`;

function cleanArray(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0)
    .slice(0, limit);
}

function cleanString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const body = (await req.json()) as DraftRequest;
    const transcript = body.transcript?.trim();

    if (!transcript || transcript.length < 80) {
      return new Response(
        JSON.stringify({ error: "Transcript is too short to draft." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const systemPrompt = `You create clean executive coaching session drafts from raw transcripts.

Rules:
- Ignore filler words and rough transcript noise.
- Never include speaker labels like "Emily:", "DAY, EMILY:", or "Justin Harkelroad:" in the output.
- Write like a coach documenting the session for an owner.
- Keep the summary to 3-5 sentences max.
- Extract only real wins, real issues, and real commitments.
- Top commitments must be specific next actions, not vague themes.
- If the transcript does not clearly support an item, omit it.
- Return valid JSON only.`;

    const userPrompt = `Session date: ${body.session_date ?? "unknown"}

Transcript:
${transcript}

Return JSON in exactly this shape:
${jsonExample}`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 1200,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("[generate-mission-control-draft] OpenAI error:", openaiResponse.status, errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content returned from OpenAI");
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content) as Partial<DraftResponse>;

    const response: DraftResponse = {
      suggested_title: cleanString(parsed.suggested_title, "Coaching session"),
      summary: cleanString(parsed.summary),
      key_points: cleanArray(parsed.key_points, 5),
      wins: cleanArray(parsed.wins, 4),
      issues: cleanArray(parsed.issues, 4),
      top_commitments: cleanArray(parsed.top_commitments, 3),
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[generate-mission-control-draft] Failed:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to generate mission control draft",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
