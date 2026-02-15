export interface AnalyzeRequestBody {
  agency_id: string;
  report_ids: string[];
  analysis_type: "monthly" | "quarterly" | "custom";
  include_lqs_data?: boolean;
  include_scorecard_data?: boolean;
  custom_question?: string;
  created_by?: string | null;
}

export interface NormalizedAnalyzeInput {
  agencyId: string;
  reportIds: string[];
  analysisType: "monthly" | "quarterly" | "custom";
  customQuestion: string | undefined;
}

export interface ReportStatusRow {
  id: string;
  parse_status: string | null;
}

export const VALID_ANALYSIS_TYPES = new Set(["monthly", "quarterly", "custom"] as const);
export const MAX_REPORT_IDS = 24;
export const MAX_CUSTOM_QUESTION_LENGTH = 2000;

export function normalizeAndValidateAnalyzeInput(body: AnalyzeRequestBody | null | undefined):
  | { ok: true; value: NormalizedAnalyzeInput }
  | { ok: false; error: string } {
  if (!body?.agency_id || !Array.isArray(body.report_ids) || body.report_ids.length === 0) {
    return { ok: false, error: "agency_id and report_ids are required." };
  }

  const analysisType = (body.analysis_type ?? "monthly") as AnalyzeRequestBody["analysis_type"];
  if (!VALID_ANALYSIS_TYPES.has(analysisType)) {
    return { ok: false, error: "analysis_type must be one of: monthly, quarterly, custom." };
  }

  const reportIds = [...new Set(body.report_ids.filter((id) => typeof id === "string" && id.length > 0))];
  if (reportIds.length === 0) {
    return { ok: false, error: "At least one valid report_id is required." };
  }
  if (reportIds.length > MAX_REPORT_IDS) {
    return { ok: false, error: `Too many report_ids. Max allowed is ${MAX_REPORT_IDS}.` };
  }

  const customQuestion = body.custom_question?.trim();
  if (customQuestion && customQuestion.length > MAX_CUSTOM_QUESTION_LENGTH) {
    return { ok: false, error: `custom_question exceeds ${MAX_CUSTOM_QUESTION_LENGTH} characters.` };
  }

  return {
    ok: true,
    value: {
      agencyId: body.agency_id,
      reportIds,
      analysisType,
      customQuestion: customQuestion || undefined,
    },
  };
}

export function validateSelectedReportsAreParsed(
  selectedReportIds: string[],
  reportRows: ReportStatusRow[]
): string | null {
  const reportMap = new Map(reportRows.map((row) => [row.id, row]));
  const missingReportIds = selectedReportIds.filter((id) => !reportMap.has(id));
  if (missingReportIds.length > 0) {
    return `Some report_ids were not found for this agency: ${missingReportIds.join(", ")}`;
  }

  const nonParsedReportIds = selectedReportIds.filter(
    (id) => reportMap.get(id)?.parse_status !== "parsed"
  );
  if (nonParsedReportIds.length > 0) {
    return `Some selected reports are not parsed yet: ${nonParsedReportIds.join(", ")}`;
  }

  return null;
}
