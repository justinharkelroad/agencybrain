import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as XLSX from "https://esm.sh/xlsx@0.18.5/xlsx.mjs";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { verifyRequest, isVerifyError } from "../_shared/verifyRequest.ts";
import {
  asString,
  parseAgent,
  parseInteger,
  parseMoneyCents,
  parsePercentDecimal,
  safeAddress,
} from "./parsers.ts";

interface ParseRequestBody {
  report_id: string;
  carrier_schema_key: string;
}

type RowMap = Record<string, number>;
type ColumnMap = Record<string, string>;

type FieldMap = {
  sheet_name?: string;
  agent_cell?: string;
  sections?: {
    capped_items?: { fields?: RowMap };
    policies_in_force?: { fields?: RowMap };
    retention?: { fields?: RowMap };
    tenure_retention?: { fields?: RowMap };
    written_premium?: { fields?: RowMap };
    loss_ratio?: { fields?: RowMap };
  };
  columns?: ColumnMap;
  sheet2?: {
    sheet_name?: string;
    columns?: ColumnMap;
    fields?: RowMap;
  };
};

function getCellValue(sheet: XLSX.WorkSheet, address: string): unknown {
  return sheet[address]?.v;
}

function extractLineMetrics(sheet: XLSX.WorkSheet, fieldMap: FieldMap) {
  const sections = fieldMap.sections ?? {};
  const columns = fieldMap.columns ?? {};
  const lines: Record<string, Record<string, unknown>> = {};

  for (const [lineKey, columnLetter] of Object.entries(columns)) {
    const cappedRows = sections.capped_items?.fields ?? {};
    const pifRows = sections.policies_in_force?.fields ?? {};
    const retentionRows = sections.retention?.fields ?? {};
    const tenureRows = sections.tenure_retention?.fields ?? {};
    const premiumRows = sections.written_premium?.fields ?? {};
    const lossRows = sections.loss_ratio?.fields ?? {};

    const get = (rows: RowMap, key: string) => {
      const address = safeAddress(columnLetter, rows[key]);
      return address ? getCellValue(sheet, address) : null;
    };

    lines[lineKey] = {
      label: lineKey,
      capped_items: {
        new: parseInteger(get(cappedRows, "new")),
        renewal: parseInteger(get(cappedRows, "renewal")),
        total: parseInteger(get(cappedRows, "total")),
        pye: parseInteger(get(cappedRows, "pye")),
        variance_pye: parseInteger(get(cappedRows, "variance_to_pye")),
      },
      policies_in_force: {
        current: parseInteger(get(pifRows, "current")),
        pye: parseInteger(get(pifRows, "pye")),
        variance_pye: parseInteger(get(pifRows, "variance_to_pye")),
      },
      retention: {
        current_month: parsePercentDecimal(get(retentionRows, "current_month")),
        prior_year: parsePercentDecimal(get(retentionRows, "prior_year")),
        point_variance_py: parsePercentDecimal(get(retentionRows, "point_variance_py")),
        net_retention: parsePercentDecimal(get(retentionRows, "net_retention")),
      },
      tenure_retention: {
        years_0_2: parsePercentDecimal(get(tenureRows, "0_2_years")),
        years_2_plus: parsePercentDecimal(get(tenureRows, "2_plus_years")),
        years_2_5: parsePercentDecimal(get(tenureRows, "2_5_years")),
        years_5_plus: parsePercentDecimal(get(tenureRows, "5_plus_years")),
      },
      premium: {
        current_month_new_cents: parseMoneyCents(get(premiumRows, "current_month_new")),
        current_month_renewal_cents: parseMoneyCents(get(premiumRows, "current_month_renewal")),
        current_month_total_cents: parseMoneyCents(get(premiumRows, "current_month_total")),
        py_same_month_cents: parseMoneyCents(get(premiumRows, "py_same_month")),
        pct_variance_py: parsePercentDecimal(get(premiumRows, "pct_variance_py")),
        ytd_new_cents: parseMoneyCents(get(premiumRows, "ytd_new")),
        ytd_renewal_cents: parseMoneyCents(get(premiumRows, "ytd_renewal")),
        ytd_total_cents: parseMoneyCents(get(premiumRows, "ytd_total")),
        prior_year_ytd_cents: parseMoneyCents(get(premiumRows, "prior_year_ytd")),
        pct_variance_py_ytd: parsePercentDecimal(get(premiumRows, "pct_variance_py_ytd")),
        written_12mm_cents: parseMoneyCents(get(premiumRows, "written_premium_12mm")),
        earned_12mm_cents: parseMoneyCents(get(premiumRows, "earned_premium_12mm")),
      },
      loss_ratio: {
        adj_earned_premium_12mm_cents: parseMoneyCents(get(lossRows, "adj_earned_premium_12mm")),
        adj_paid_losses_12mm_cents: parseMoneyCents(get(lossRows, "adj_paid_losses_12mm")),
        adj_loss_ratio_12mm: parsePercentDecimal(get(lossRows, "adj_paid_loss_ratio_12mm")),
        adj_earned_premium_24mm_cents: parseMoneyCents(get(lossRows, "adj_earned_premium_24mm")),
        adj_paid_losses_24mm_cents: parseMoneyCents(get(lossRows, "adj_paid_losses_24mm")),
        adj_loss_ratio_24mm: parsePercentDecimal(get(lossRows, "adj_paid_loss_ratio_24mm")),
      },
    };
  }

  return lines;
}

function extractAncillaryMetrics(workbook: XLSX.WorkBook, fieldMap: FieldMap) {
  const sheet2 = fieldMap.sheet2;
  if (!sheet2?.sheet_name || !sheet2.columns || !sheet2.fields) return {};

  const sheet = workbook.Sheets[sheet2.sheet_name];
  if (!sheet) return {};

  const ancillary: Record<string, Record<string, unknown>> = {};

  for (const [lineKey, columnLetter] of Object.entries(sheet2.columns)) {
    const get = (key: string) => {
      const address = safeAddress(columnLetter, sheet2.fields?.[key]);
      return address ? getCellValue(sheet, address) : null;
    };

    ancillary[lineKey] = {
      label: lineKey,
      capped_items_current: parseInteger(get("capped_items_current")),
      capped_items_pye: parseInteger(get("capped_items_pye")),
      capped_items_variance: parseInteger(get("capped_items_variance")),
      pif_current: parseInteger(get("pif_current")),
      pif_pye: parseInteger(get("pif_pye")),
      pif_variance: parseInteger(get("pif_variance")),
      retention_current: parsePercentDecimal(get("retention_current")),
      written_premium_current_cents: parseMoneyCents(get("written_premium_current")),
      written_premium_ytd_cents: parseMoneyCents(get("written_premium_ytd")),
      loss_ratio_12mm: parsePercentDecimal(get("loss_ratio_12mm")),
      loss_ratio_24mm: parsePercentDecimal(get("loss_ratio_24mm")),
    };
  }

  return ancillary;
}

function parseErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) {
    return optionsResponse;
  }

  let requestBody: ParseRequestBody | null = null;

  try {
    const authResult = await verifyRequest(req);
    if (isVerifyError(authResult)) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json()) as ParseRequestBody;
    requestBody = body;
    if (!body?.report_id || !body?.carrier_schema_key) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: report_id and carrier_schema_key." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: report, error: reportError } = await supabase
      .from("business_metrics_reports")
      .select("id, agency_id, report_month, carrier_schema_id, file_path, bonus_projection_cents")
      .eq("id", body.report_id)
      .maybeSingle();

    if (reportError || !report) {
      return new Response(
        JSON.stringify({ error: "Report not found." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (report.agency_id !== authResult.agencyId) {
      return new Response(
        JSON.stringify({ error: "Access denied to this report." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: schema, error: schemaError } = await supabase
      .from("carrier_schemas")
      .select("id, schema_key, carrier_name, field_map")
      .eq("schema_key", body.carrier_schema_key)
      .maybeSingle();

    if (schemaError || !schema) {
      return new Response(
        JSON.stringify({ error: "Carrier schema not found." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (report.carrier_schema_id !== schema.id) {
      return new Response(
        JSON.stringify({ error: "Report carrier schema mismatch." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: fileBytes, error: downloadError } = await supabase.storage
      .from("business-metrics")
      .download(report.file_path);

    if (downloadError || !fileBytes) {
      throw new Error(downloadError?.message ?? "Could not download uploaded report file.");
    }

    const buffer = new Uint8Array(await fileBytes.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "array", raw: true });

    const fieldMap = (schema.field_map ?? {}) as FieldMap;
    const mainSheetName = fieldMap.sheet_name ?? workbook.SheetNames[0];
    const mainSheet = workbook.Sheets[mainSheetName];

    if (!mainSheet) {
      throw new Error(`Main sheet '${mainSheetName}' not found in workbook.`);
    }

    const agentRaw = asString(getCellValue(mainSheet, fieldMap.agent_cell ?? "B4"));
    const { agentCode, agentName } = parseAgent(agentRaw);

    const lines = extractLineMetrics(mainSheet, fieldMap);
    const ancillary = extractAncillaryMetrics(workbook, fieldMap);

    const totalPc = (lines.total_pc ?? {}) as Record<string, unknown>;
    const standardAuto = (lines.standard_auto ?? {}) as Record<string, unknown>;
    const homeowners = (lines.homeowners ?? {}) as Record<string, unknown>;
    const renters = (lines.renters ?? {}) as Record<string, unknown>;
    const condo = (lines.condo ?? {}) as Record<string, unknown>;
    const otherSpecial = (lines.other_special_property ?? {}) as Record<string, unknown>;
    const motorClub = (ancillary.motor_club ?? {}) as Record<string, unknown>;

    const reportMonth = new Date(report.report_month);
    const isBaseline = Number.isFinite(reportMonth.getTime())
      ? reportMonth.getUTCMonth() === 0
      : false;

    const parsedData = {
      meta: {
        carrier: schema.carrier_name ?? body.carrier_schema_key,
        agent_code: agentCode,
        agent_name: agentName,
        report_month: report.report_month,
        parsed_at: new Date().toISOString(),
      },
      lines,
      totals: {
        total_pc: totalPc,
        personal_lines: (lines.total_personal_lines ?? {}) as Record<string, unknown>,
      },
      ancillary,
    };

    const { error: reportUpdateError } = await supabase
      .from("business_metrics_reports")
      .update({
        parse_status: "parsed",
        parse_error: null,
        parsed_data: parsedData,
        agent_code: agentCode,
        agent_name: agentName,
        is_baseline: isBaseline,
      })
      .eq("id", report.id);

    if (reportUpdateError) {
      throw new Error(reportUpdateError.message);
    }

    const { error: deleteSnapshotError } = await supabase
      .from("business_metrics_snapshots")
      .delete()
      .eq("report_id", report.id);

    if (deleteSnapshotError) {
      throw new Error(deleteSnapshotError.message);
    }

    const { error: insertSnapshotError } = await supabase
      .from("business_metrics_snapshots")
      .insert({
        report_id: report.id,
        agency_id: report.agency_id,
        report_month: report.report_month,
        capped_items_total: ((totalPc.capped_items as Record<string, unknown> | undefined)?.total as number | null) ?? null,
        capped_items_new: ((totalPc.capped_items as Record<string, unknown> | undefined)?.new as number | null) ?? null,
        capped_items_renewal: ((totalPc.capped_items as Record<string, unknown> | undefined)?.renewal as number | null) ?? null,
        capped_items_pye: ((totalPc.capped_items as Record<string, unknown> | undefined)?.pye as number | null) ?? null,
        capped_items_variance_pye: ((totalPc.capped_items as Record<string, unknown> | undefined)?.variance_pye as number | null) ?? null,
        pif_current: ((totalPc.policies_in_force as Record<string, unknown> | undefined)?.current as number | null) ?? null,
        pif_pye: ((totalPc.policies_in_force as Record<string, unknown> | undefined)?.pye as number | null) ?? null,
        pif_variance_pye: ((totalPc.policies_in_force as Record<string, unknown> | undefined)?.variance_pye as number | null) ?? null,
        retention_current: ((totalPc.retention as Record<string, unknown> | undefined)?.current_month as number | null) ?? null,
        retention_prior_year: ((totalPc.retention as Record<string, unknown> | undefined)?.prior_year as number | null) ?? null,
        retention_point_variance_py: ((totalPc.retention as Record<string, unknown> | undefined)?.point_variance_py as number | null) ?? null,
        net_retention: ((totalPc.retention as Record<string, unknown> | undefined)?.net_retention as number | null) ?? null,
        retention_0_2_years: ((totalPc.tenure_retention as Record<string, unknown> | undefined)?.years_0_2 as number | null) ?? null,
        retention_2_plus_years: ((totalPc.tenure_retention as Record<string, unknown> | undefined)?.years_2_plus as number | null) ?? null,
        retention_2_5_years: ((totalPc.tenure_retention as Record<string, unknown> | undefined)?.years_2_5 as number | null) ?? null,
        retention_5_plus_years: ((totalPc.tenure_retention as Record<string, unknown> | undefined)?.years_5_plus as number | null) ?? null,
        retention_std_auto: ((standardAuto.retention as Record<string, unknown> | undefined)?.current_month as number | null) ?? null,
        retention_homeowners: ((homeowners.retention as Record<string, unknown> | undefined)?.current_month as number | null) ?? null,
        retention_renters: ((renters.retention as Record<string, unknown> | undefined)?.current_month as number | null) ?? null,
        retention_condo: ((condo.retention as Record<string, unknown> | undefined)?.current_month as number | null) ?? null,
        retention_other_special: ((otherSpecial.retention as Record<string, unknown> | undefined)?.current_month as number | null) ?? null,
        premium_current_month_new: ((totalPc.premium as Record<string, unknown> | undefined)?.current_month_new_cents as number | null) ?? null,
        premium_current_month_renewal: ((totalPc.premium as Record<string, unknown> | undefined)?.current_month_renewal_cents as number | null) ?? null,
        premium_current_month_total: ((totalPc.premium as Record<string, unknown> | undefined)?.current_month_total_cents as number | null) ?? null,
        premium_py_same_month: ((totalPc.premium as Record<string, unknown> | undefined)?.py_same_month_cents as number | null) ?? null,
        premium_pct_variance_py: ((totalPc.premium as Record<string, unknown> | undefined)?.pct_variance_py as number | null) ?? null,
        premium_ytd_total: ((totalPc.premium as Record<string, unknown> | undefined)?.ytd_total_cents as number | null) ?? null,
        premium_prior_year_ytd: ((totalPc.premium as Record<string, unknown> | undefined)?.prior_year_ytd_cents as number | null) ?? null,
        premium_pct_variance_py_ytd: ((totalPc.premium as Record<string, unknown> | undefined)?.pct_variance_py_ytd as number | null) ?? null,
        premium_12mm_written: ((totalPc.premium as Record<string, unknown> | undefined)?.written_12mm_cents as number | null) ?? null,
        premium_12mm_earned: ((totalPc.premium as Record<string, unknown> | undefined)?.earned_12mm_cents as number | null) ?? null,
        loss_ratio_12mm: ((totalPc.loss_ratio as Record<string, unknown> | undefined)?.adj_loss_ratio_12mm as number | null) ?? null,
        loss_ratio_24mm: ((totalPc.loss_ratio as Record<string, unknown> | undefined)?.adj_loss_ratio_24mm as number | null) ?? null,
        adj_paid_losses_12mm: ((totalPc.loss_ratio as Record<string, unknown> | undefined)?.adj_paid_losses_12mm_cents as number | null) ?? null,
        adj_earned_premium_12mm: ((totalPc.loss_ratio as Record<string, unknown> | undefined)?.adj_earned_premium_12mm_cents as number | null) ?? null,
        std_auto_new_items: ((standardAuto.capped_items as Record<string, unknown> | undefined)?.new as number | null) ?? null,
        std_auto_retention: ((standardAuto.retention as Record<string, unknown> | undefined)?.current_month as number | null) ?? null,
        std_auto_retention_py_var: ((standardAuto.retention as Record<string, unknown> | undefined)?.point_variance_py as number | null) ?? null,
        ho_retention: ((homeowners.retention as Record<string, unknown> | undefined)?.current_month as number | null) ?? null,
        ho_retention_py_var: ((homeowners.retention as Record<string, unknown> | undefined)?.point_variance_py as number | null) ?? null,
        ho_premium_current: ((homeowners.premium as Record<string, unknown> | undefined)?.current_month_total_cents as number | null) ?? null,
        motor_club_items_current: (motorClub.capped_items_current as number | null) ?? null,
        motor_club_items_pye: (motorClub.capped_items_pye as number | null) ?? null,
        motor_club_items_variance: (motorClub.capped_items_variance as number | null) ?? null,
        motor_club_retention: (motorClub.retention_current as number | null) ?? null,
        bonus_projection_cents: report.bonus_projection_cents ?? null,
      });

    if (insertSnapshotError) {
      throw new Error(insertSnapshotError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        report_id: report.id,
        parse_status: "parsed",
        parser_status: "ok",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const reportId = requestBody?.report_id ?? null;
    const message = parseErrorMessage(error);
    if (reportId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      await supabase
        .from("business_metrics_reports")
        .update({
          parse_status: "error",
          parse_error: message.slice(0, 1000),
        })
        .eq("id", reportId);
    }
    console.error("parse_business_metrics unexpected error", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
