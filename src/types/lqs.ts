/**
 * LQS (Lead → Quote → Sale) Type Definitions
 * Phase 1: Core infrastructure types for marketing ROI tracking
 */

// ==================== Enums / Type Unions ====================

export type LeadStatus = 'lead' | 'quoted' | 'sold';

export type CostType = 'per_lead' | 'per_transfer' | 'monthly_fixed' | 'per_mailer';

export type QuoteSource = 'allstate_report' | 'scorecard' | 'manual' | 'bulk_upload';

export type SaleSource = 'sales_dashboard' | 'scorecard' | 'manual';

// ==================== Table Interfaces ====================

export interface MarketingBucket {
  id: string;
  agency_id: string;
  name: string;
  commission_rate_percent: number;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadSourceMonthlySpend {
  id: string;
  lead_source_id: string;
  agency_id: string;
  month: string; // ISO date string (first day of month)
  cost_per_unit_cents: number;
  units_count: number;
  total_spend_cents: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LqsHousehold {
  id: string;
  agency_id: string;
  household_key: string;
  first_name: string;
  last_name: string;
  zip_code: string;
  phone: string[] | null;
  email: string | null;
  lead_source_id: string | null;
  status: LeadStatus;
  lead_received_date: string | null;
  first_quote_date: string | null;
  sold_date: string | null;
  team_member_id: string | null;
  needs_attention: boolean;
  products_interested: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface LqsQuote {
  id: string;
  household_id: string;
  agency_id: string;
  team_member_id: string | null;
  quote_date: string;
  product_type: string;
  items_quoted: number;
  premium_cents: number;
  issued_policy_number: string | null;
  source: QuoteSource;
  source_reference_id: string | null;
  created_at: string;
}

export interface LqsSale {
  id: string;
  household_id: string;
  agency_id: string;
  team_member_id: string | null;
  sale_date: string;
  product_type: string;
  items_sold: number;
  policies_sold: number;
  premium_cents: number;
  policy_number: string | null;
  source: SaleSource;
  source_reference_id: string | null;
  linked_quote_id: string | null;
  created_at: string;
}

// ==================== Extended Lead Source (with new fields) ====================

export interface LeadSourceExtended {
  id: string;
  agency_id: string;
  name: string;
  is_active: boolean;
  order_index: number;
  cost_per_lead_cents: number | null;
  bucket_id: string | null;
  is_self_generated: boolean;
  cost_type: CostType;
  created_at: string;
  updated_at: string;
}

// ==================== Insert/Update Types ====================

export type MarketingBucketInsert = Omit<MarketingBucket, 'id' | 'created_at' | 'updated_at'>;
export type MarketingBucketUpdate = Partial<Omit<MarketingBucket, 'id' | 'agency_id' | 'created_at' | 'updated_at'>>;

export type LeadSourceMonthlySpendInsert = Omit<LeadSourceMonthlySpend, 'id' | 'created_at' | 'updated_at'>;
export type LeadSourceMonthlySpendUpdate = Partial<Omit<LeadSourceMonthlySpend, 'id' | 'lead_source_id' | 'agency_id' | 'month' | 'created_at' | 'updated_at'>>;

export type LqsHouseholdInsert = Omit<LqsHousehold, 'id' | 'created_at' | 'updated_at'>;
export type LqsHouseholdUpdate = Partial<Omit<LqsHousehold, 'id' | 'agency_id' | 'household_key' | 'created_at' | 'updated_at'>>;

export type LqsQuoteInsert = Omit<LqsQuote, 'id' | 'created_at'>;
export type LqsQuoteUpdate = Partial<Omit<LqsQuote, 'id' | 'household_id' | 'agency_id' | 'created_at'>>;

export type LqsSaleInsert = Omit<LqsSale, 'id' | 'created_at'>;
export type LqsSaleUpdate = Partial<Omit<LqsSale, 'id' | 'household_id' | 'agency_id' | 'created_at'>>;

// ==================== Quote Report Upload Types ====================

export interface ParsedQuoteRow {
  subProducerRaw: string;
  subProducerCode: string | null;
  subProducerName: string | null;
  firstName: string;
  lastName: string;
  zipCode: string;
  quoteDate: string; // YYYY-MM-DD
  productType: string;
  itemsQuoted: number;
  premiumCents: number;
  issuedPolicyNumber: string | null;
  householdKey: string;
  rowNumber: number;
}

export interface QuoteParseResult {
  success: boolean;
  records: ParsedQuoteRow[];
  errors: string[];
  duplicatesRemoved: number;
  dateRange: { start: string; end: string } | null;
}

export interface QuoteUploadContext {
  agencyId: string;
  userId: string | null;
  displayName: string;
}

export interface QuoteUploadResult {
  success: boolean;
  recordsProcessed: number;
  householdsCreated: number;
  householdsUpdated: number;
  quotesCreated: number;
  quotesUpdated: number;
  teamMembersMatched: number;
  unmatchedProducers: string[];
  householdsNeedingAttention: number;
  errors: string[];
  salesLinked: number;
  salesNoMatch: number;
}

// ==================== Lead Upload Types ====================

export interface ParsedLeadRow {
  firstName: string;
  lastName: string;
  zipCode: string;
  phones: string[] | null;
  email: string | null;
  productsInterested: string[] | null;
  leadDate: string | null;
  rowNumber: number;
  householdKey: string;
}

export interface LeadUploadContext {
  agencyId: string;
  leadSourceId: string;
}

export interface LeadUploadResult {
  success: boolean;
  recordsProcessed: number;
  leadsCreated: number;
  leadsUpdated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

export interface LeadColumnMapping {
  first_name: string | null;
  last_name: string | null;
  zip_code: string | null;
  phones: string[] | null;  // Array of column names to merge into phones array
  email: string | null;
  products_interested: string | null;
  lead_date: string | null;
}

export interface ParsedLeadFileResult {
  success: boolean;
  headers: string[];
  sampleRows: Record<string, string>[];
  allRows: any[][];
  totalRows: number;
  suggestedMapping: LeadColumnMapping;
  errors: string[];
}

// ==================== Sales Upload Types ====================

export interface ParsedSaleRow {
  subProducerRaw: string;
  subProducerCode: string | null;
  subProducerName: string | null;
  firstName: string;
  lastName: string;
  zipCode: string | null;
  saleDate: string; // YYYY-MM-DD
  productType: string;
  itemsSold: number;
  premiumCents: number;
  policyNumber: string | null;
  householdKey: string;
  rowNumber: number;
  dispositionCode: string | null;
}

export interface SalesParseResult {
  success: boolean;
  records: ParsedSaleRow[];
  errors: string[];
  duplicatesRemoved: number;
  endorsementsSkipped: number;
  dateRange: { start: string; end: string } | null;
}

export interface SalesUploadContext {
  agencyId: string;
  userId: string | null;
  displayName: string;
}

export interface SalesUploadResult {
  success: boolean;
  recordsProcessed: number;
  salesCreated: number;
  householdsMatched: number;
  householdsCreated: number;
  quotesLinked: number;
  teamMembersMatched: number;
  unmatchedProducers: string[];
  householdsNeedingAttention: number;
  endorsementsSkipped: number;
  errors: string[];
  // Smart matching fields
  autoMatched: number;
  needsReview: number;
  pendingReviews: PendingSaleReview[];
}

// ==================== Smart Match Types ====================

export interface MatchCandidate {
  householdId: string;
  householdName: string;
  zipCode: string | null;
  leadSourceName: string | null;
  quote: {
    id: string;
    productType: string;
    premium: number;
    quoteDate: string;
  } | null;
  score: number;
  matchFactors: {
    productMatch: boolean;
    subProducerMatch: boolean;
    premiumWithin10Percent: boolean;
    quoteDateBeforeSale: boolean;
  };
}

export interface PendingSaleReview {
  sale: ParsedSaleRow;
  candidates: MatchCandidate[];
}
