import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { verifyRequest, isVerifyError } from "../_shared/verifyRequest.ts";
import {
  type AnalyzeRequestBody,
  normalizeAndValidateAnalyzeInput,
  validateSelectedReportsAreParsed,
} from "./validation.ts";

interface SnapshotRow {
  report_id: string;
  report_month: string;
  capped_items_total: number | null;
  capped_items_variance_pye: number | null;
  retention_current: number | null;
  retention_prior_year: number | null;
  retention_point_variance_py: number | null;
  premium_ytd_total: number | null;
  premium_pct_variance_py_ytd: number | null;
  loss_ratio_12mm: number | null;
}

function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return "--";
  return `${(value * 100).toFixed(2)}%`;
}

function fmtMoneyFromCents(value: number | null | undefined): string {
  if (value === null || value === undefined) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function fmtInt(value: number | null | undefined): string {
  if (value === null || value === undefined) return "--";
  return new Intl.NumberFormat("en-US").format(value);
}

function diff(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return null;
  }
  return current - previous;
}

function toMonthLabel(value: string): string {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function buildAnalysisMarkdown(
  latest: SnapshotRow,
  previous: SnapshotRow | null,
  body: AnalyzeRequestBody
): string {
  const growthDelta = diff(latest.capped_items_total, previous?.capped_items_total);
  const retentionDelta = diff(latest.retention_current, previous?.retention_current);
  const premiumDelta = diff(latest.premium_ytd_total, previous?.premium_ytd_total);
  const lossRatioDelta = diff(latest.loss_ratio_12mm, previous?.loss_ratio_12mm);

  const headline = [
    `Performance for **${toMonthLabel(latest.report_month)}** shows `,
    growthDelta !== null && growthDelta >= 0 ? "continued growth momentum" : "a growth slowdown",
    ` with retention at **${fmtPct(latest.retention_current)}** and loss ratio at **${fmtPct(latest.loss_ratio_12mm)}**.`,
  ].join("");

  const drivers: string[] = [
    `- Capped items: **${fmtInt(latest.capped_items_total)}** (${growthDelta === null ? "no prior comparison" : `${growthDelta >= 0 ? "+" : ""}${fmtInt(growthDelta)} vs prior month`}).`,
    `- Retention current month: **${fmtPct(latest.retention_current)}** (PY comparison: **${fmtPct(latest.retention_prior_year)}**, variance: **${fmtPct(latest.retention_point_variance_py)}**).`,
    `- YTD premium: **${fmtMoneyFromCents(latest.premium_ytd_total)}** (${premiumDelta === null ? "no prior comparison" : `${premiumDelta >= 0 ? "+" : ""}${fmtMoneyFromCents(premiumDelta)} vs prior month`}).`,
    `- 12MM loss ratio: **${fmtPct(latest.loss_ratio_12mm)}** (${lossRatioDelta === null ? "no prior comparison" : `${lossRatioDelta >= 0 ? "+" : ""}${fmtPct(lossRatioDelta)} vs prior month`}).`,
  ];

  const rootCause =
    latest.retention_point_variance_py !== null && latest.retention_point_variance_py < 0
      ? "Primary pressure appears to be retention under prior-year levels, which directly drags item growth."
      : "Current data suggests growth is driven by stable retention and sustained premium volume.";

  const actions = [
    "- Prioritize lines with negative retention variance and run save-work outbound follow-up this week.",
    "- Review new vs renewal item split and set a weekly new-item target tied to current growth pace.",
    "- Track loss ratio weekly; if >50% on any line, isolate claim outliers before changing production strategy.",
  ];

  const watch = [
    "- Retention point variance threshold: alert if below **-0.50 pts**.",
    "- Growth variance threshold: alert if capped items variance to PYE drops below **0**.",
    "- Loss ratio threshold: alert if 12MM exceeds **50.00%**.",
  ];

  const positive =
    latest.premium_pct_variance_py_ytd !== null && latest.premium_pct_variance_py_ytd > 0
      ? `YTD premium remains above prior year at **${fmtPct(latest.premium_pct_variance_py_ytd)}**, indicating underlying book resilience.`
      : "No clear premium outperformance signal this month, but current snapshot is stable enough for targeted interventions.";

  const customQ = body.custom_question?.trim()
    ? `\n### Custom Question\n${body.custom_question.trim()}\n`
    : "";

  return [
    "### HEADLINE",
    headline,
    "",
    "### KEY DRIVERS",
    ...drivers,
    "",
    "### ROOT CAUSE",
    rootCause,
    "",
    "### LINE-OF-BUSINESS SPOTLIGHT",
    "Line-level spotlight requires expanded parsed line metrics UI wiring; this pass is based on current snapshot-level aggregates.",
    "",
    "### ACTIONABLE STRATEGIES",
    ...actions,
    "",
    "### WATCH LIST",
    ...watch,
    "",
    "### POSITIVE SIGNALS",
    positive,
    customQ,
  ].join("\n");
}

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) {
    return optionsResponse;
  }

  try {
    const authResult = await verifyRequest(req);
    if (isVerifyError(authResult)) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // gic_analyses.user_id references auth.users; staff sessions are not supported here.
    if (authResult.mode !== "supabase" || !authResult.userId) {
      return new Response(
        JSON.stringify({ error: "This analysis endpoint currently requires a logged-in owner/manager JWT session." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json()) as AnalyzeRequestBody;
    const normalized = normalizeAndValidateAnalyzeInput(body);
    if (!normalized.ok) {
      return new Response(
        JSON.stringify({ error: normalized.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const input = normalized.value;

    if (input.agencyId !== authResult.agencyId) {
      return new Response(
        JSON.stringify({ error: "Access denied to this agency." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: reportRows, error: reportsError } = await supabase
      .from("business_metrics_reports")
      .select("id, parse_status")
      .eq("agency_id", input.agencyId)
      .in("id", input.reportIds);

    if (reportsError) {
      return new Response(
        JSON.stringify({ error: reportsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reportValidationError = validateSelectedReportsAreParsed(
      input.reportIds,
      ((reportRows ?? []) as Array<{ id: string; parse_status: string | null }>)
    );
    if (reportValidationError) {
      return new Response(
        JSON.stringify({ error: reportValidationError }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: snapshots, error: snapshotsError } = await supabase
      .from("business_metrics_snapshots")
      .select(
        "report_id, report_month, capped_items_total, capped_items_variance_pye, retention_current, retention_prior_year, retention_point_variance_py, premium_ytd_total, premium_pct_variance_py_ytd, loss_ratio_12mm"
      )
      .in("report_id", input.reportIds)
      .eq("agency_id", input.agencyId)
      .order("report_month", { ascending: true });

    if (snapshotsError) {
      return new Response(
        JSON.stringify({ error: snapshotsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const snapshotRows = (snapshots ?? []) as SnapshotRow[];
    if (snapshotRows.length === 0) {
      return new Response(
        JSON.stringify({ error: "No snapshots found for selected reports." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const latest = snapshotRows[snapshotRows.length - 1];
    const previous = snapshotRows.length > 1 ? snapshotRows[snapshotRows.length - 2] : null;
    const analysisMarkdown = buildAnalysisMarkdown(latest, previous, body);

    const { data: insertedAnalysis, error: insertError } = await supabase
      .from("gic_analyses")
      .insert({
        agency_id: input.agencyId,
        user_id: authResult.userId,
        report_ids: input.reportIds,
        analysis_type: input.analysisType,
        analysis_result: analysisMarkdown,
        model_used: "rule-based-v1",
        included_lqs_data: body.include_lqs_data ?? false,
        included_scorecard_data: body.include_scorecard_data ?? false,
        conversation: [],
      })
      .select("*")
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis: insertedAnalysis,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze_growth_metrics unexpected error", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
