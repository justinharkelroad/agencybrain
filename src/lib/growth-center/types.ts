export type ParseStatus = 'pending' | 'parsed' | 'error';

export interface CarrierSchema {
  id: string;
  carrier_name: string;
  schema_key: string;
  display_name: string;
  version: string;
  field_map: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessMetricsReport {
  id: string;
  agency_id: string;
  user_id: string;
  carrier_schema_id: string;
  report_month: string;
  agent_code: string | null;
  agent_name: string | null;
  original_filename: string;
  file_path: string;
  parse_status: ParseStatus;
  parse_error: string | null;
  parsed_data: Record<string, unknown> | null;
  bonus_projection_cents: number | null;
  is_baseline: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessMetricsSnapshot {
  id: string;
  report_id: string;
  agency_id: string;
  report_month: string;
  capped_items_total: number | null;
  capped_items_new: number | null;
  capped_items_renewal: number | null;
  capped_items_pye: number | null;
  capped_items_variance_pye: number | null;
  pif_current: number | null;
  pif_pye: number | null;
  pif_variance_pye: number | null;
  retention_current: number | null;
  retention_prior_year: number | null;
  retention_point_variance_py: number | null;
  net_retention: number | null;
  retention_0_2_years: number | null;
  retention_2_plus_years: number | null;
  retention_2_5_years: number | null;
  retention_5_plus_years: number | null;
  premium_current_month_new: number | null;
  premium_current_month_renewal: number | null;
  premium_current_month_total: number | null;
  premium_py_same_month: number | null;
  premium_pct_variance_py: number | null;
  premium_ytd_total: number | null;
  premium_prior_year_ytd: number | null;
  premium_pct_variance_py_ytd: number | null;
  premium_12mm_written: number | null;
  premium_12mm_earned: number | null;
  loss_ratio_12mm: number | null;
  loss_ratio_24mm: number | null;
  adj_paid_losses_12mm: number | null;
  adj_earned_premium_12mm: number | null;
  bonus_projection_cents: number | null;
  created_at: string;
}

export interface GICAnalysis {
  id: string;
  agency_id: string;
  user_id: string;
  report_ids: string[];
  analysis_type: 'monthly' | 'quarterly' | 'custom';
  analysis_result: string;
  model_used: string;
  included_lqs_data: boolean;
  included_scorecard_data: boolean;
  conversation: Array<{ role: string; content: string }>;
  created_at: string;
}

export interface CreateBusinessMetricsReportInput {
  file: File;
  reportMonth: string; // YYYY-MM
  carrierSchemaId: string;
  carrierSchemaKey: string;
  bonusProjectionDollars?: number | null;
}

export interface RunGICAnalysisInput {
  reportIds: string[];
  analysisType: 'monthly' | 'quarterly' | 'custom';
  includeLqsData: boolean;
  includeScorecardData: boolean;
  customQuestion?: string;
}
