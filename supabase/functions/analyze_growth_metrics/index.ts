import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { verifyRequest, isVerifyError } from "../_shared/verifyRequest.ts";

interface FollowUpPayload {
  analysis_id: string;
  message: string;
}

interface AnalyzeRequestBody {
  report_ids: string[];
  analysis_type?: "monthly" | "quarterly" | "custom";
  include_lqs_data?: boolean;
  include_scorecard_data?: boolean;
  custom_question?: string | null;
  follow_up?: FollowUpPayload | null;
}

const SYSTEM_PROMPT = `You are an expert insurance agency performance analyst specializing in property & casualty agency growth metrics and bonus structures.

YOUR KNOWLEDGE:

1. GROWTH BONUS MECHANICS:
- Growth points = capped items variance to prior year end (PYE)
- Growth bonus percentage is tiered based on total growth points
- Retention directly impacts growth points (lost policies reduce item count)
- New business items add to growth points
- The bonus projection model annualizes the current month's trajectory — a single weak month disproportionately impacts the full-year projection
- Growth points climb as you add items throughout the year; the key question is PACE vs prior year

2. RETENTION ANALYSIS:
- Current month retention % alone is misleading — you MUST compare to the prior year same-month (PY) to understand if performance improved or declined
- The PY comparison base CHANGES every month as the trailing 12-month window shifts, so even stable actual retention can show variance swings when the PY comp period gets harder or easier
- When PY retention jumps (e.g., 86.59% → 87.27%), the current month must perform better just to maintain the same variance — this is a comp headwind
- Tenure bands reveal WHERE attrition happens:
  - 0-2 years: highest churn risk, price-sensitive new customers
  - 2-5 years: critical loyalty-building window, most improvable cohort
  - 5+ years: most stable, highest lifetime value, hardest to win back if lost
- Line-of-business breakdown reveals WHICH book is bleeding
- Small books (like Condo with ~50 policies) can show extreme variance swings from just a few lost policies — contextualize by book size

3. PREMIUM ANALYSIS:
- New business premium = future growth engine, measures production capacity
- Renewal premium growth = existing book health and rate adequacy
- YTD variance to PY shows sustained trajectory (most important for projections)
- Monthly spikes/dips need context: seasonal patterns, large commercial accounts, rate changes
- Written premium 12MM is the annualized view that smooths monthly noise
- When new business premium craters (e.g., $148K → $71K in one month), distinguish between:
  - Lead flow problem (fewer quotes)
  - Close rate problem (same quotes, fewer binds)
  - Seasonal pattern (predictable annual dip)
  - Staffing issue (lost a producer)

4. LOSS RATIO:
- Below 40% = excellent, agency is profitable for carrier
- 40-50% = watch zone, monitor monthly
- Above 50% = problem, may affect bonus qualification and carrier relationship
- Small books can have wild loss ratios from a single large claim — one $50K homeowners claim on a $37K premium book = 135% loss ratio, but it's noise not signal
- 24MM ratio smooths single-year anomalies — compare 12MM vs 24MM to spot trends vs spikes
- Improving loss ratio is a POSITIVE signal even when other metrics are struggling

5. CROSS-REFERENCE ANALYSIS (when quoting/scorecard data is provided):
- If quoting activity drops AND new business drops: EFFORT PROBLEM — team isn't generating enough opportunities
- If quoting is stable but new business drops: CLOSE RATE PROBLEM — leads aren't converting, investigate pricing, competition, or skill gaps
- If call volume drops: staffing, morale, or process breakdown
- If talk time drops but calls stay flat: shorter conversations, possible loss of discovery and cross-sell effort
- If items sold drops but quoting stays high: conversion funnel is leaking, may need sales training or competitive analysis
- Compare team-level daily averages to agency-level monthly results to find individual performance gaps

OUTPUT FORMAT:
You must structure your response with these exact section headers in this order:

### HEADLINE
One sentence — the single most important finding.

### KEY DRIVERS
2-3 specific metrics that explain the headline.

### ROOT CAUSE
What is ACTUALLY causing this — not just the symptom.

### LINE-OF-BUSINESS SPOTLIGHT
Name the specific line(s) driving the issue.

### ACTIONABLE STRATEGIES
3-5 specific actions ranked by expected impact.

### WATCH LIST
2-3 metrics to monitor next month with specific threshold numbers.

### POSITIVE SIGNALS
At least one thing that's going well.

RULES:
- Never give generic advice. Every recommendation must reference a specific number from their data.
- Distinguish between TREND (3+ months same direction) and ANOMALY (single month blip).
- If data is insufficient for a conclusion (e.g., only 1 month uploaded), say so rather than speculate.
- When cross-reference data is NOT provided, do not mention it.
- Format all dollar amounts with $ and commas. Format percentages to 2 decimal places. Format point variances with +/- sign.`;

function formatPct(val: number | null | undefined): string {
  if (val == null || !Number.isFinite(val)) return "N/A";
  return `${(val * 100).toFixed(2)}%`;
}

function formatPts(val: number | null | undefined): string {
  if (val == null || !Number.isFinite(val)) return "N/A";
  const pct = val * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)} pts`;
}

function centsToStr(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "N/A";
  return (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function aggregateQuotingByMonth(rows: Array<Record<string, unknown>>) {
  const byMonth: Record<string, {
    month: string;
    total_households_quoted: number;
    total_items_quoted: number;
    total_policies_quoted: number;
    total_premium_potential_cents: number;
    team_member_ids: Set<string>;
  }> = {};

  for (const row of rows) {
    const workDate = typeof row.work_date === "string" ? row.work_date : null;
    const month = workDate?.substring(0, 7);
    if (!month) continue;

    if (!byMonth[month]) {
      byMonth[month] = {
        month,
        total_households_quoted: 0,
        total_items_quoted: 0,
        total_policies_quoted: 0,
        total_premium_potential_cents: 0,
        team_member_ids: new Set<string>(),
      };
    }

    byMonth[month].total_households_quoted += 1;
    byMonth[month].total_items_quoted += Number(row.items_quoted ?? 0);
    byMonth[month].total_policies_quoted += Number(row.policies_quoted ?? 0);
    byMonth[month].total_premium_potential_cents += Number(row.premium_potential_cents ?? 0);

    if (typeof row.team_member_id === "string" && row.team_member_id.length > 0) {
      byMonth[month].team_member_ids.add(row.team_member_id);
    }
  }

  return Object.values(byMonth)
    .map((m) => ({
      ...m,
      unique_team_members_quoting: m.team_member_ids.size,
      team_member_ids: undefined,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function aggregateScorecardByMonth(rows: Array<Record<string, unknown>>) {
  const byMonth: Record<string, {
    month: string;
    total_calls: number;
    total_talk_minutes: number;
    total_items_sold: number;
    days_with_submissions: Set<string>;
    call_count: number;
    talk_count: number;
  }> = {};

  for (const row of rows) {
    const date = typeof row.date === "string" ? row.date : null;
    const month = date?.substring(0, 7);
    if (!month) continue;

    if (!byMonth[month]) {
      byMonth[month] = {
        month,
        total_calls: 0,
        total_talk_minutes: 0,
        total_items_sold: 0,
        days_with_submissions: new Set<string>(),
        call_count: 0,
        talk_count: 0,
      };
    }

    const labelValue =
      (typeof row.label_at_submit === "string" ? row.label_at_submit : "") ||
      (typeof row.kpi_label === "string" ? row.kpi_label : "");
    const label = labelValue.toLowerCase();
    const value = Number(row.value ?? 0);

    if (label.includes("call") || label.includes("outbound")) {
      byMonth[month].total_calls += value;
      byMonth[month].call_count += 1;
    } else if (label.includes("talk") || label.includes("minute")) {
      byMonth[month].total_talk_minutes += value;
      byMonth[month].talk_count += 1;
    } else if (label.includes("sold") || label.includes("item")) {
      byMonth[month].total_items_sold += value;
    }

    byMonth[month].days_with_submissions.add(date as string);
  }

  return Object.values(byMonth)
    .map((m) => {
      const uniqueDays = Math.max(1, m.days_with_submissions.size);
      const workingDays = 22;
      return {
        month: m.month,
        avg_daily_calls: m.call_count > 0 ? m.total_calls / uniqueDays : null,
        avg_daily_talk_minutes: m.talk_count > 0 ? m.total_talk_minutes / uniqueDays : null,
        total_items_sold: m.total_items_sold,
        submission_compliance_rate: m.days_with_submissions.size / workingDays,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));
}

function buildUserPrompt(
  reports: Array<Record<string, unknown>>,
  quotingData: Array<Record<string, unknown>> | null,
  scorecardData: Array<Record<string, unknown>> | null,
  customQuestion: string | null
): string {
  const parts: string[] = [];

  const months = reports
    .map((r) => (typeof r.report_month === "string" ? r.report_month : ""))
    .filter(Boolean)
    .join(", ");

  const firstParsed = reports[0]?.parsed_data as Record<string, unknown> | undefined;
  const meta = firstParsed?.meta as Record<string, unknown> | undefined;
  const agentName = typeof meta?.agent_name === "string" ? meta.agent_name : "this agency";

  parts.push(`Analyze the following business metrics data for ${agentName}.`);
  parts.push(`Months being compared: ${months}`);
  parts.push("");

  for (const report of reports) {
    const pd = report.parsed_data as Record<string, unknown> | undefined;
    if (!pd) continue;

    parts.push("═══════════════════════════════════════");
    parts.push(`MONTH: ${String(report.report_month ?? "")}`);
    if (typeof report.bonus_projection_cents === "number") {
      parts.push(
        `BONUS PROJECTION: $${(report.bonus_projection_cents / 100).toLocaleString("en-US", {
          minimumFractionDigits: 2,
        })}`
      );
    }
    parts.push("═══════════════════════════════════════");
    parts.push("");

    const totals = pd.totals as Record<string, unknown> | undefined;
    const totalPC = totals?.total_pc as Record<string, unknown> | undefined;

    if (totalPC) {
      parts.push("── TOTAL P&C SUMMARY ──");

      const capped = totalPC.capped_items as Record<string, unknown> | undefined;
      if (capped) {
        parts.push(
          `Capped Items: New=${String(capped.new ?? "N/A")}, Renewal=${String(capped.renewal ?? "N/A")}, Total=${String(capped.total ?? "N/A")}, PYE=${String(capped.pye ?? "N/A")}, Variance to PYE=${String(capped.variance_pye ?? "N/A")}`
        );
      }

      const pif = totalPC.policies_in_force as Record<string, unknown> | undefined;
      if (pif) {
        parts.push(
          `Policies in Force: Current=${String(pif.current ?? "N/A")}, PYE=${String(pif.pye ?? "N/A")}, Variance=${String(pif.variance_pye ?? "N/A")}`
        );
      }

      const retention = totalPC.retention as Record<string, unknown> | undefined;
      if (retention) {
        parts.push(
          `Retention: Current=${formatPct(retention.current_month as number | null | undefined)}, PY=${formatPct(retention.prior_year as number | null | undefined)}, PY Variance=${formatPts(retention.point_variance_py as number | null | undefined)}, Net=${formatPct(retention.net_retention as number | null | undefined)}`
        );
      }

      const tenure = totalPC.tenure_retention as Record<string, unknown> | undefined;
      if (tenure) {
        parts.push(
          `Tenure Retention: 0-2yr=${formatPct(tenure.years_0_2 as number | null | undefined)}, 2-5yr=${formatPct(tenure.years_2_5 as number | null | undefined)}, 5+yr=${formatPct(tenure.years_5_plus as number | null | undefined)}`
        );
      }

      const premium = totalPC.premium as Record<string, unknown> | undefined;
      if (premium) {
        parts.push(
          `Premium Current Month: New=$${centsToStr(premium.current_month_new_cents as number | null | undefined)}, Renewal=$${centsToStr(premium.current_month_renewal_cents as number | null | undefined)}, Total=$${centsToStr(premium.current_month_total_cents as number | null | undefined)}`
        );
        parts.push(
          `Premium vs PY Same Month: $${centsToStr(premium.py_same_month_cents as number | null | undefined)}, Variance=${formatPct(premium.pct_variance_py as number | null | undefined)}`
        );
        parts.push(
          `Premium YTD: $${centsToStr(premium.ytd_total_cents as number | null | undefined)}, PY YTD=$${centsToStr(premium.prior_year_ytd_cents as number | null | undefined)}, Variance=${formatPct(premium.pct_variance_py_ytd as number | null | undefined)}`
        );
        parts.push(
          `Written Premium 12MM: $${centsToStr(premium.written_12mm_cents as number | null | undefined)}, Earned 12MM: $${centsToStr(premium.earned_12mm_cents as number | null | undefined)}`
        );
      }

      const loss = totalPC.loss_ratio as Record<string, unknown> | undefined;
      if (loss) {
        parts.push(
          `Loss Ratio 12MM: ${formatPct(loss.adj_loss_ratio_12mm as number | null | undefined)} (Earned=$${centsToStr(loss.adj_earned_premium_12mm_cents as number | null | undefined)}, Losses=$${centsToStr(loss.adj_paid_losses_12mm_cents as number | null | undefined)})`
        );
        parts.push(
          `Loss Ratio 24MM: ${formatPct(loss.adj_loss_ratio_24mm as number | null | undefined)}`
        );
      }

      parts.push("");
    }

    const lines = pd.lines as Record<string, Record<string, unknown>> | undefined;
    if (lines && Object.keys(lines).length > 0) {
      parts.push("── LINE-OF-BUSINESS DETAIL ──");
      for (const [lineKey, line] of Object.entries(lines)) {
        const lineLabel = typeof line.label === "string" ? line.label : lineKey;
        parts.push(`\n  ${lineLabel}:`);

        const lineCapped = line.capped_items as Record<string, unknown> | undefined;
        if (lineCapped) {
          parts.push(
            `    Items: New=${String(lineCapped.new ?? "N/A")}, Renewal=${String(lineCapped.renewal ?? "N/A")}, Total=${String(lineCapped.total ?? "N/A")}, PYE=${String(lineCapped.pye ?? "N/A")}, Var PYE=${String(lineCapped.variance_pye ?? "N/A")}`
          );
        }

        const lineRetention = line.retention as Record<string, unknown> | undefined;
        if (lineRetention) {
          parts.push(
            `    Retention: Current=${formatPct(lineRetention.current_month as number | null | undefined)}, PY=${formatPct(lineRetention.prior_year as number | null | undefined)}, PY Var=${formatPts(lineRetention.point_variance_py as number | null | undefined)}`
          );
        }

        const linePremium = line.premium as Record<string, unknown> | undefined;
        if (linePremium) {
          parts.push(
            `    Premium: Month Total=$${centsToStr(linePremium.current_month_total_cents as number | null | undefined)}, New=$${centsToStr(linePremium.current_month_new_cents as number | null | undefined)}, YTD=$${centsToStr(linePremium.ytd_total_cents as number | null | undefined)}, YTD Var PY=${formatPct(linePremium.pct_variance_py_ytd as number | null | undefined)}`
          );
        }

        const lineLoss = line.loss_ratio as Record<string, unknown> | undefined;
        if (lineLoss) {
          parts.push(
            `    Loss Ratio: 12MM=${formatPct(lineLoss.adj_loss_ratio_12mm as number | null | undefined)}, 24MM=${formatPct(lineLoss.adj_loss_ratio_24mm as number | null | undefined)}`
          );
        }

        const lineTenure = line.tenure_retention as Record<string, unknown> | undefined;
        if (lineTenure) {
          parts.push(
            `    Tenure: 0-2yr=${formatPct(lineTenure.years_0_2 as number | null | undefined)}, 2-5yr=${formatPct(lineTenure.years_2_5 as number | null | undefined)}, 5+yr=${formatPct(lineTenure.years_5_plus as number | null | undefined)}`
          );
        }
      }
      parts.push("");
    }

    const ancillary = pd.ancillary as Record<string, Record<string, unknown>> | undefined;
    if (ancillary && Object.keys(ancillary).length > 0) {
      parts.push("── ANCILLARY PRODUCTS ──");
      for (const [key, anc] of Object.entries(ancillary)) {
        const ancLabel = typeof anc.label === "string" ? anc.label : key;
        parts.push(
          `  ${ancLabel}: Items=${String(anc.capped_items_current ?? "N/A")} (PYE=${String(anc.capped_items_pye ?? "N/A")}, Var=${String(anc.capped_items_variance ?? "N/A")}), Retention=${formatPct(anc.retention_current as number | null | undefined)}, Premium YTD=$${centsToStr(anc.written_premium_ytd_cents as number | null | undefined)}, LR 12MM=${formatPct(anc.loss_ratio_12mm as number | null | undefined)}`
        );
      }
      parts.push("");
    }
  }

  if (quotingData && quotingData.length > 0) {
    parts.push("═══════════════════════════════════════");
    parts.push("CROSS-REFERENCE: QUOTING ACTIVITY (from AgencyBrain LQS)");
    parts.push("═══════════════════════════════════════");
    for (const month of quotingData) {
      parts.push(
        `${String(month.month ?? "")}: Households Quoted=${String(month.total_households_quoted ?? 0)}, Items Quoted=${String(month.total_items_quoted ?? 0)}, Policies Quoted=${String(month.total_policies_quoted ?? 0)}, Premium Potential=$${centsToStr(month.total_premium_potential_cents as number | null | undefined)}, Team Members Active=${String(month.unique_team_members_quoting ?? 0)}`
      );
    }
    parts.push("");
  }

  if (scorecardData && scorecardData.length > 0) {
    parts.push("═══════════════════════════════════════");
    parts.push("CROSS-REFERENCE: DAILY SCORECARD ACTIVITY (from AgencyBrain)");
    parts.push("═══════════════════════════════════════");
    for (const month of scorecardData) {
      const avgCalls = typeof month.avg_daily_calls === "number" ? month.avg_daily_calls.toFixed(1) : "N/A";
      const avgTalk = typeof month.avg_daily_talk_minutes === "number" ? month.avg_daily_talk_minutes.toFixed(1) : "N/A";
      parts.push(
        `${String(month.month ?? "")}: Avg Daily Calls=${avgCalls}, Avg Daily Talk Min=${avgTalk}, Items Sold=${String(month.total_items_sold ?? 0)}, Scorecard Compliance=${formatPct(month.submission_compliance_rate as number | null | undefined)}`
      );
    }
    parts.push("");
  }

  if (customQuestion && customQuestion.trim().length > 0) {
    parts.push("═══════════════════════════════════════");
    parts.push("SPECIFIC QUESTION FROM AGENCY OWNER:");
    parts.push(customQuestion.trim());
    parts.push("═══════════════════════════════════════");
  }

  return parts.join("\n");
}

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) {
    return optionsResponse;
  }

  try {
    const authResult = await verifyRequest(req);
    if (isVerifyError(authResult)) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (authResult.mode !== "supabase" || !authResult.userId) {
      return new Response(
        JSON.stringify({ error: "This endpoint requires an owner/manager JWT session." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as AnalyzeRequestBody;
    const reportIds = Array.isArray(body.report_ids)
      ? [...new Set(body.report_ids.filter((id): id is string => typeof id === "string" && id.length > 0))]
      : [];

    if (reportIds.length === 0) {
      return new Response(JSON.stringify({ error: "report_ids required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysisType = body.analysis_type ?? "monthly";
    const includeLqs = Boolean(body.include_lqs_data);
    const includeScorecard = Boolean(body.include_scorecard_data);
    const customQuestion = body.custom_question ?? null;
    const followUp = body.follow_up ?? null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: reports, error: reportsError } = await supabase
      .from("business_metrics_reports")
      .select("id, report_month, parse_status, parsed_data, bonus_projection_cents, agent_code, agent_name")
      .eq("agency_id", authResult.agencyId)
      .in("id", reportIds)
      .eq("parse_status", "parsed")
      .order("report_month", { ascending: true });

    if (reportsError || !reports || reports.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No parsed reports found for the given IDs",
          detail: reportsError?.message,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validReports = reports.filter((r) => {
      const parsed = r.parsed_data as Record<string, unknown> | null;
      return parsed && Object.keys(parsed).length > 0;
    });

    if (validReports.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Reports exist but parsed_data is empty. Re-upload and re-parse the reports.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sortedMonths = validReports
      .map((r) => (typeof r.report_month === "string" ? r.report_month : ""))
      .filter(Boolean)
      .sort();

    const startDate = sortedMonths[0];
    const endMonth = sortedMonths[sortedMonths.length - 1];
    const endDate = new Date(endMonth);
    endDate.setUTCMonth(endDate.getUTCMonth() + 1);
    endDate.setUTCDate(0);
    const endDateStr = endDate.toISOString().split("T")[0];

    let quotingByMonth: Array<Record<string, unknown>> | null = null;
    if (includeLqs && startDate) {
      const { data: lqsRows } = await supabase
        .from("quoted_household_details")
        .select("work_date, team_member_id, items_quoted, policies_quoted, premium_potential_cents")
        .eq("agency_id", authResult.agencyId)
        .gte("work_date", startDate)
        .lte("work_date", endDateStr);

      if (lqsRows && lqsRows.length > 0) {
        quotingByMonth = aggregateQuotingByMonth(lqsRows as Array<Record<string, unknown>>);
      }
    }

    let scorecardByMonth: Array<Record<string, unknown>> | null = null;
    if (includeScorecard && startDate) {
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("id")
        .eq("agency_id", authResult.agencyId);

      const teamMemberIds = new Set((teamMembers ?? []).map((tm) => tm.id));

      let scorecardRows: Array<Record<string, unknown>> = [];
      const tryLabelAtSubmit = await supabase
        .from("metrics_daily")
        .select("date, value, label_at_submit, team_member_id")
        .gte("date", startDate)
        .lte("date", endDateStr);

      if (tryLabelAtSubmit.error) {
        const tryKpiLabel = await supabase
          .from("metrics_daily")
          .select("date, value, kpi_label, team_member_id")
          .gte("date", startDate)
          .lte("date", endDateStr);

        if (!tryKpiLabel.error && tryKpiLabel.data) {
          scorecardRows = tryKpiLabel.data as Array<Record<string, unknown>>;
        }
      } else if (tryLabelAtSubmit.data) {
        scorecardRows = tryLabelAtSubmit.data as Array<Record<string, unknown>>;
      }

      if (scorecardRows.length > 0) {
        const agencyScorecard = scorecardRows.filter((r) => {
          const tmId = typeof r.team_member_id === "string" ? r.team_member_id : "";
          return teamMemberIds.has(tmId);
        });
        if (agencyScorecard.length > 0) {
          scorecardByMonth = aggregateScorecardByMonth(agencyScorecard);
        }
      }
    }

    const userPrompt = buildUserPrompt(validReports as Array<Record<string, unknown>>, quotingByMonth, scorecardByMonth, customQuestion);

    let messages: Array<{ role: "user" | "assistant"; content: string }> = [];

    if (followUp?.analysis_id && followUp?.message) {
      const { data: existing } = await supabase
        .from("gic_analyses")
        .select("conversation, analysis_result")
        .eq("id", followUp.analysis_id)
        .eq("agency_id", authResult.agencyId)
        .maybeSingle();

      if (existing) {
        messages = [
          { role: "user", content: userPrompt },
          { role: "assistant", content: existing.analysis_result ?? "" },
          ...((existing.conversation ?? []) as Array<{ role: "user" | "assistant"; content: string }>),
          { role: "user", content: followUp.message },
        ];
      } else {
        messages = [{ role: "user", content: followUp.message }];
      }
    } else {
      messages = [{ role: "user", content: userPrompt }];
    }

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!anthropicResponse.ok) {
      const errorBody = await anthropicResponse.text();
      console.error("Anthropic API error", anthropicResponse.status, errorBody);
      return new Response(
        JSON.stringify({
          error: "AI analysis failed",
          detail: `Anthropic API returned ${anthropicResponse.status}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await anthropicResponse.json();
    const analysisText = Array.isArray(aiResult?.content)
      ? aiResult.content
          .filter((block: { type?: string }) => block.type === "text")
          .map((block: { text?: string }) => block.text ?? "")
          .join("\n")
      : "";

    const finalText = analysisText || "No analysis generated.";

    if (followUp?.analysis_id && followUp?.message) {
      const conversationHistory = messages.slice(2);
      await supabase
        .from("gic_analyses")
        .update({
          conversation: conversationHistory,
          analysis_result: finalText,
          model_used: "claude-sonnet-4-20250514",
        })
        .eq("id", followUp.analysis_id)
        .eq("agency_id", authResult.agencyId);

      return new Response(
        JSON.stringify({
          success: true,
          analysis_id: followUp.analysis_id,
          analysis_result: finalText,
          model_used: "claude-sonnet-4-20250514",
          is_follow_up: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: inserted } = await supabase
      .from("gic_analyses")
      .insert({
        agency_id: authResult.agencyId,
        user_id: authResult.userId,
        report_ids: reportIds,
        analysis_type: analysisType,
        analysis_result: finalText,
        model_used: "claude-sonnet-4-20250514",
        included_lqs_data: includeLqs && quotingByMonth != null,
        included_scorecard_data: includeScorecard && scorecardByMonth != null,
        conversation: [],
      })
      .select("id")
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        analysis_id: inserted?.id ?? null,
        analysis_result: finalText,
        model_used: "claude-sonnet-4-20250514",
        reports_analyzed: validReports.length,
        included_lqs_data: quotingByMonth != null,
        included_scorecard_data: scorecardByMonth != null,
        is_follow_up: false,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze_growth_metrics error", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        detail: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
