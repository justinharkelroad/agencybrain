import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-maintenance-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Mode = "preview" | "repair" | "inspect";

interface AuditRequest {
  mode?: Mode;
  agency_id?: string;
  producer_name?: string;
  sale_ids?: string[];
  sale_date_start?: string;
  sale_date_end?: string;
  limit?: number;
}

interface SaleRow {
  id: string;
  agency_id: string;
  team_member_id: string | null;
  lead_source_id: string | null;
  contact_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_zip: string | null;
  sale_date: string;
  total_policies: number | null;
  total_items: number | null;
  total_premium: number | null;
  source: string | null;
}

interface TeamMemberRow {
  id: string;
  agency_id: string;
  name: string;
}

interface LqsSaleRow {
  id: string;
  source_reference_id: string | null;
  household_id: string;
  team_member_id: string | null;
  sale_date: string;
  premium_cents: number | null;
  product_type: string | null;
  policy_number: string | null;
}

interface HouseholdRow {
  id: string;
  agency_id: string;
  household_key: string;
  first_name: string;
  last_name: string;
  zip_code: string | null;
  phone: string[] | null;
  email: string | null;
  status: string;
  sold_date: string | null;
  team_member_id: string | null;
  lead_source_id: string | null;
  contact_id: string | null;
}

interface SalePolicyRow {
  sale_id: string;
}

interface SalePolicyDetailRow {
  id: string;
  sale_id: string;
  policy_type_name: string;
  policy_number: string | null;
  total_items: number | null;
  total_premium: number | null;
}

interface CandidateLqsSaleMatch {
  id: string;
  source_reference_id: string | null;
  product_type: string | null;
  premium_cents: number | null;
  policy_number: string | null;
}

interface PostgrestLikeError {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message?: string;
}

interface HouseholdMatchRow {
  household_id: string | null;
}

interface PhoneCandidateRow {
  id: string;
  phone: string[] | null;
  team_member_id: string | null;
  zip_code: string | null;
}

interface HouseholdIdRow {
  id: string;
}

type AdminClient = any;

interface IssueSummary {
  sale_id: string;
  agency_id: string;
  producer_id: string | null;
  producer_name: string;
  sale_date: string;
  customer_name: string | null;
  total_premium: number | null;
  source: string | null;
  issue_types: string[];
  linked_household_ids: string[];
  linked_lqs_sale_ids: string[];
  linked_household_names: string[];
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeName(value: string | null | undefined): string | null {
  const normalized = (value || "").replace(/\s+/g, " ").trim().toLowerCase();
  return normalized || null;
}

function normalizeProductType(productType: string | null | undefined): string {
  if (!productType || !productType.trim()) return "Unknown";

  const upper = productType.toUpperCase().trim();
  const mapping: Record<string, string> = {
    AUTO: "Standard Auto",
    "STANDARD AUTO": "Standard Auto",
    "PERSONAL AUTO": "Standard Auto",
    SA: "Standard Auto",
    HOME: "Homeowners",
    HOMEOWNERS: "Homeowners",
    HOMEOWNER: "Homeowners",
    HO: "Homeowners",
    RENTER: "Renters",
    RENTERS: "Renters",
    LANDLORD: "Landlords",
    LANDLORDS: "Landlords",
    LL: "Landlords",
    UMBRELLA: "Personal Umbrella",
    "PERSONAL UMBRELLA": "Personal Umbrella",
    PUP: "Personal Umbrella",
    "MOTOR CLUB": "Motor Club",
    MOTORCLUB: "Motor Club",
    MC: "Motor Club",
    CONDO: "Condo",
    CONDOMINIUM: "Condo",
    MOBILEHOME: "Mobilehome",
    "MOBILE HOME": "Mobilehome",
    MH: "Mobilehome",
    "AUTO - SPECIAL": "Auto - Special",
    "AUTO-SPECIAL": "Auto - Special",
    "SPECIAL AUTO": "Auto - Special",
    "NON-STANDARD AUTO": "Auto - Special",
  };

  if (mapping[upper]) return mapping[upper];

  const lineCodeMatch = upper.match(/^(\d{3})\s*-\s*/);
  if (lineCodeMatch) {
    const lineCodeMap: Record<string, string> = {
      "010": "Standard Auto",
      "020": "Motorcycle",
      "021": "Motorcycle",
      "070": "Homeowners",
      "072": "Landlords",
      "073": "Renters",
      "074": "Condo",
      "078": "Condo",
      "080": "Boatowners",
      "090": "Personal Umbrella",
    };
    if (lineCodeMap[lineCodeMatch[1]]) return lineCodeMap[lineCodeMatch[1]];
  }

  return productType.trim();
}

function normalizePhone(value: string | null | undefined): string | null {
  const digits = (value || "").replace(/\D/g, "");
  const last10 = digits.slice(-10);
  return last10.length === 10 ? last10 : null;
}

function parseCustomerName(value: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const parts = (value || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "UNKNOWN", lastName: "UNKNOWN" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function generateHouseholdKey(customerName: string | null, customerZip: string | null): string {
  const { firstName, lastName } = parseCustomerName(customerName);
  const cleanLastName = lastName.toUpperCase().replace(/[^A-Z]/g, "") || "UNKNOWN";
  const cleanFirstName = firstName.toUpperCase().replace(/[^A-Z]/g, "") || "UNKNOWN";
  const cleanZip = (customerZip || "").substring(0, 5);
  return `${cleanLastName}_${cleanFirstName}_${cleanZip}`;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function chunk<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function matchesPolicyNumber(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  return (left || null) === (right || null);
}

function buildPolicySignature(
  productType: string | null | undefined,
  premiumCents: number | null | undefined,
  policyNumber: string | null | undefined,
): string {
  return [
    normalizeProductType(productType),
    premiumCents || 0,
    policyNumber || "",
  ].join("|");
}

function sameCustomer(left: string | null | undefined, right: string | null | undefined): boolean {
  return normalizeName(left) === normalizeName(right);
}

function isExactDuplicateSale(
  currentSale: SaleRow,
  currentPolicies: SalePolicyDetailRow[],
  existingSale: SaleRow,
  existingPolicies: SalePolicyDetailRow[],
): boolean {
  if (!sameCustomer(currentSale.customer_name, existingSale.customer_name)) return false;
  if (currentSale.sale_date !== existingSale.sale_date) return false;
  if ((currentSale.total_policies || 0) !== (existingSale.total_policies || 0)) return false;
  if ((currentSale.total_items || 0) !== (existingSale.total_items || 0)) return false;
  if (Math.abs((currentSale.total_premium || 0) - (existingSale.total_premium || 0)) > 0.01) {
    return false;
  }

  const currentSignatures = currentPolicies
    .map((policy) =>
      buildPolicySignature(
        policy.policy_type_name,
        Math.round((policy.total_premium || 0) * 100),
        policy.policy_number,
      )
    )
    .sort();
  const existingSignatures = existingPolicies
    .map((policy) =>
      buildPolicySignature(
        policy.policy_type_name,
        Math.round((policy.total_premium || 0) * 100),
        policy.policy_number,
      )
    )
    .sort();

  return JSON.stringify(currentSignatures) === JSON.stringify(existingSignatures);
}

async function findMatchedCandidateLqsSales(
  admin: AdminClient,
  sale: SaleRow,
  householdId: string,
  policies: SalePolicyDetailRow[],
): Promise<CandidateLqsSaleMatch[]> {
  const { data: candidateRows, error: candidateRowsError } = await admin
    .from("lqs_sales")
    .select("id, source_reference_id, product_type, premium_cents, policy_number")
    .eq("agency_id", sale.agency_id)
    .eq("household_id", householdId)
    .eq("sale_date", sale.sale_date);
  if (candidateRowsError) throw candidateRowsError;

  const remaining = [...((candidateRows || []) as CandidateLqsSaleMatch[])];
  const matched: CandidateLqsSaleMatch[] = [];

  for (const policy of policies) {
    const signature = buildPolicySignature(
      policy.policy_type_name,
      Math.round((policy.total_premium || 0) * 100),
      policy.policy_number,
    );
    const matchIndex = remaining.findIndex((row) =>
      buildPolicySignature(row.product_type, row.premium_cents, row.policy_number) === signature
    );

    if (matchIndex === -1) {
      continue;
    }

    matched.push(remaining.splice(matchIndex, 1)[0]);
  }

  return matched;
}

async function loadTeamMembers(
  admin: AdminClient,
  body: AuditRequest,
): Promise<TeamMemberRow[]> {
  let query = admin.from("team_members").select("id, agency_id, name");

  if (body.agency_id) {
    query = query.eq("agency_id", body.agency_id);
  }

  if (body.producer_name) {
    query = query.ilike("name", `%${body.producer_name}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as TeamMemberRow[];
}

async function loadSales(
  admin: AdminClient,
  body: AuditRequest,
  teamMembers: TeamMemberRow[],
): Promise<SaleRow[]> {
  const limit = Math.max(1, Math.min(body.limit ?? 500, 5000));
  const pageSize = Math.min(500, limit);
  const rows: SaleRow[] = [];

  for (let from = 0; from < limit; from += pageSize) {
    let query = admin
      .from("sales")
      .select(
        "id, agency_id, team_member_id, lead_source_id, contact_id, customer_name, customer_email, customer_phone, customer_zip, sale_date, total_policies, total_items, total_premium, source",
      )
      .gt("total_policies", 0)
      .order("sale_date", { ascending: true })
      .order("created_at", { ascending: true })
      .range(from, Math.min(from + pageSize - 1, limit - 1));

    if (body.agency_id) {
      query = query.eq("agency_id", body.agency_id);
    }

    if (body.producer_name && teamMembers.length > 0) {
      query = query.in("team_member_id", teamMembers.map((member) => member.id));
    }

    if (body.sale_ids && body.sale_ids.length > 0) {
      query = query.in("id", body.sale_ids);
    }

    if (body.sale_date_start) {
      query = query.gte("sale_date", body.sale_date_start);
    }

    if (body.sale_date_end) {
      query = query.lte("sale_date", body.sale_date_end);
    }

    const { data, error } = await query;
    if (error) throw error;

    const page = (data || []) as SaleRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

async function loadSalePolicies(
  admin: AdminClient,
  saleIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (saleIds.length === 0) return result;

  for (const saleIdChunk of chunk(saleIds, 250)) {
    const { data, error } = await admin
      .from("sale_policies")
      .select("sale_id")
      .in("sale_id", saleIdChunk);

    if (error) throw error;

    for (const row of (data || []) as SalePolicyRow[]) {
      result.set(row.sale_id, (result.get(row.sale_id) || 0) + 1);
    }
  }

  return result;
}

async function loadLinkedLqsSales(
  admin: AdminClient,
  saleIds: string[],
): Promise<LqsSaleRow[]> {
  if (saleIds.length === 0) return [];
  const rows: LqsSaleRow[] = [];

  for (const saleIdChunk of chunk(saleIds, 250)) {
    const { data, error } = await admin
      .from("lqs_sales")
      .select(
        "id, source_reference_id, household_id, team_member_id, sale_date, premium_cents, product_type, policy_number",
      )
      .in("source_reference_id", saleIdChunk);

    if (error) throw error;
    rows.push(...((data || []) as LqsSaleRow[]));
  }

  return rows;
}

async function loadHouseholds(
  admin: AdminClient,
  householdIds: string[],
): Promise<Map<string, HouseholdRow>> {
  const result = new Map<string, HouseholdRow>();
  if (householdIds.length === 0) return result;

  for (const householdIdChunk of chunk(householdIds, 250)) {
    const { data, error } = await admin
      .from("lqs_households")
      .select(
        "id, agency_id, household_key, first_name, last_name, zip_code, phone, email, status, sold_date, team_member_id, lead_source_id, contact_id",
      )
      .in("id", householdIdChunk);

    if (error) throw error;

    for (const row of (data || []) as HouseholdRow[]) {
      result.set(row.id, row);
    }
  }

  return result;
}

function buildIssueSummary(
  sales: SaleRow[],
  teamMemberMap: Map<string, TeamMemberRow>,
  linkedRows: LqsSaleRow[],
  householdsById: Map<string, HouseholdRow>,
  salePolicyCounts: Map<string, number>,
): {
  issues: IssueSummary[];
  producerSummaries: Array<Record<string, unknown>>;
} {
  const linkedBySaleId = new Map<string, LqsSaleRow[]>();
  for (const row of linkedRows) {
    if (!row.source_reference_id) continue;
    const existing = linkedBySaleId.get(row.source_reference_id) || [];
    existing.push(row);
    linkedBySaleId.set(row.source_reference_id, existing);
  }

  const issues: IssueSummary[] = [];
  const summaryByProducer = new Map<string, {
    agency_id: string;
    producer_id: string | null;
    producer_name: string;
    dashboard_sales: number;
    dashboard_households: Set<string>;
    linked_households: Set<string>;
    missing_links: number;
    team_member_mismatches: number;
    multi_household_links: number;
  }>();

  for (const sale of sales) {
    const producer = sale.team_member_id ? teamMemberMap.get(sale.team_member_id) : null;
    const producerName = producer?.name || (sale.team_member_id ? "Unknown" : "Unassigned");
    const producerKey = `${sale.agency_id}:${sale.team_member_id ?? "unassigned"}`;
    const summary = summaryByProducer.get(producerKey) || {
      agency_id: sale.agency_id,
      producer_id: sale.team_member_id,
      producer_name: producerName,
      dashboard_sales: 0,
      dashboard_households: new Set<string>(),
      linked_households: new Set<string>(),
      missing_links: 0,
      team_member_mismatches: 0,
      multi_household_links: 0,
    };
    summary.dashboard_sales += 1;
    const dashboardHousehold = normalizeName(sale.customer_name);
    if (dashboardHousehold) {
      summary.dashboard_households.add(dashboardHousehold);
    }

    const saleLinks = linkedBySaleId.get(sale.id) || [];
    const linkedHouseholdIds = unique(saleLinks.map((row) => row.household_id));
    linkedHouseholdIds.forEach((householdId) => summary.linked_households.add(householdId));

    const issueTypes: string[] = [];
    const linkedHouseholdNames = linkedHouseholdIds
      .map((householdId) => householdsById.get(householdId))
      .filter((row): row is HouseholdRow => !!row)
      .map((row) => `${row.first_name} ${row.last_name}`.trim());

    if ((salePolicyCounts.get(sale.id) || 0) === 0) {
      issueTypes.push("missing_sale_policies");
    }

    if (saleLinks.length === 0) {
      issueTypes.push("missing_lqs_link");
      summary.missing_links += 1;
    }

    if (linkedHouseholdIds.length > 1) {
      issueTypes.push("linked_to_multiple_households");
      summary.multi_household_links += 1;
    }

    if (
      sale.team_member_id &&
      saleLinks.some((row) => row.team_member_id !== sale.team_member_id)
    ) {
      issueTypes.push("lqs_sale_team_member_mismatch");
      summary.team_member_mismatches += 1;
    }

    if (
      sale.team_member_id &&
      linkedHouseholdIds.some((householdId) =>
        householdsById.get(householdId)?.team_member_id !== sale.team_member_id
      )
    ) {
      issueTypes.push("household_team_member_mismatch");
    }

    if (
      sale.lead_source_id &&
      linkedHouseholdIds.some((householdId) => {
        const household = householdsById.get(householdId);
        return household && household.lead_source_id !== sale.lead_source_id;
      })
    ) {
      issueTypes.push("household_lead_source_mismatch");
    }

    if (issueTypes.length > 0) {
      issues.push({
        sale_id: sale.id,
        agency_id: sale.agency_id,
        producer_id: sale.team_member_id,
        producer_name: producerName,
        sale_date: sale.sale_date,
        customer_name: sale.customer_name,
        total_premium: sale.total_premium,
        source: sale.source,
        issue_types: issueTypes,
        linked_household_ids: linkedHouseholdIds,
        linked_lqs_sale_ids: saleLinks.map((row) => row.id),
        linked_household_names: linkedHouseholdNames,
      });
    }

    summaryByProducer.set(producerKey, summary);
  }

  const producerSummaries = Array.from(summaryByProducer.values())
    .map((summary) => ({
      agency_id: summary.agency_id,
      producer_id: summary.producer_id,
      producer_name: summary.producer_name,
      dashboard_sales: summary.dashboard_sales,
      dashboard_households: summary.dashboard_households.size,
      lqs_linked_households: summary.linked_households.size,
      missing_links: summary.missing_links,
      team_member_mismatches: summary.team_member_mismatches,
      multi_household_links: summary.multi_household_links,
    }))
    .sort((a, b) =>
      (b.missing_links as number) - (a.missing_links as number) ||
      (b.dashboard_sales as number) - (a.dashboard_sales as number)
    );

  return { issues, producerSummaries };
}

async function findOrCreateHouseholdForSale(
  admin: AdminClient,
  sale: SaleRow,
): Promise<{ householdId: string; action: string }> {
  const { data: matches, error: matchError } = await admin.rpc(
    "match_sale_to_lqs_household",
    { p_sale_id: sale.id },
  );
  if (matchError) throw matchError;

  const matchedHouseholds = Array.isArray(matches)
    ? matches as HouseholdMatchRow[]
    : [];
  const matchedHouseholdId = matchedHouseholds[0]?.household_id ?? undefined;
  if (matchedHouseholdId) {
    return { householdId: matchedHouseholdId, action: "matched_existing_household" };
  }

  const normalizedPhone = normalizePhone(sale.customer_phone);
  if (normalizedPhone) {
    const { data: phoneCandidates, error: phoneError } = await admin
      .from("lqs_households")
      .select("id, phone, team_member_id, zip_code")
      .eq("agency_id", sale.agency_id)
      .not("phone", "is", null);

    if (phoneError) throw phoneError;

    const exactPhoneMatch = ((phoneCandidates || []) as PhoneCandidateRow[]).find((candidate) => {
      const householdPhones = Array.isArray(candidate.phone) ? candidate.phone : [];
      return householdPhones.some((phone) => normalizePhone(phone) === normalizedPhone);
    });

    if (exactPhoneMatch?.id) {
      return { householdId: exactPhoneMatch.id, action: "matched_phone_household" };
    }
  }

  const householdKey = generateHouseholdKey(sale.customer_name, sale.customer_zip);
  const { data: keyMatch, error: keyError } = await admin
    .from("lqs_households")
    .select("id")
    .eq("agency_id", sale.agency_id)
    .eq("household_key", householdKey)
    .maybeSingle();

  if (keyError) throw keyError;
  const typedKeyMatch = keyMatch as HouseholdIdRow | null;
  if (typedKeyMatch?.id) {
    return { householdId: typedKeyMatch.id, action: "matched_household_key" };
  }

  const { firstName, lastName } = parseCustomerName(sale.customer_name);
  const { data: createdHousehold, error: createError } = await admin
    .from("lqs_households")
    .insert({
      agency_id: sale.agency_id,
      household_key: householdKey,
      first_name: firstName.toUpperCase(),
      last_name: lastName.toUpperCase(),
      zip_code: sale.customer_zip?.substring(0, 5) || null,
      phone: sale.customer_phone ? [sale.customer_phone] : null,
      email: sale.customer_email || null,
      lead_source_id: sale.lead_source_id || null,
      status: "lead",
      lead_received_date: sale.sale_date,
      team_member_id: sale.team_member_id,
      contact_id: sale.contact_id,
      needs_attention: false,
    })
    .select("id")
    .single();

  if (createError) throw createError;

  const typedCreatedHousehold = createdHousehold as HouseholdIdRow;
  return { householdId: typedCreatedHousehold.id, action: "created_household" };
}

async function repairSaleIntegrity(
  admin: AdminClient,
  sale: SaleRow,
  issue: IssueSummary,
): Promise<Record<string, unknown>> {
  if (issue.issue_types.includes("linked_to_multiple_households")) {
    return {
      sale_id: sale.id,
      status: "manual_review_required",
      reason: "sale is linked to multiple LQS households",
    };
  }

  const actions: string[] = [];

  if (issue.issue_types.includes("missing_lqs_link")) {
    const { householdId, action } = await findOrCreateHouseholdForSale(admin, sale);
    actions.push(action);

    const { error: linkError } = await admin.rpc("link_sale_to_lqs_household", {
      p_household_id: householdId,
      p_sale_id: sale.id,
    });
    if (linkError) throw linkError;

    const householdUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (sale.team_member_id) householdUpdate.team_member_id = sale.team_member_id;
    if (sale.lead_source_id) householdUpdate.lead_source_id = sale.lead_source_id;
    if (sale.contact_id) householdUpdate.contact_id = sale.contact_id;
    if (sale.customer_email) householdUpdate.email = sale.customer_email;
    if (sale.customer_phone) householdUpdate.phone = [sale.customer_phone];

    const { error: householdUpdateError } = await admin
      .from("lqs_households")
      .update(householdUpdate)
      .eq("id", householdId)
      .eq("agency_id", sale.agency_id);
    if (householdUpdateError) throw householdUpdateError;

    const { data: linkedRows, error: linkedRowsError } = await admin
      .from("lqs_sales")
      .select("id")
      .eq("agency_id", sale.agency_id)
      .eq("source_reference_id", sale.id);
    if (linkedRowsError) throw linkedRowsError;

    if (!linkedRows || linkedRows.length === 0) {
      const { data: salePolicies, error: salePoliciesError } = await admin
        .from("sale_policies")
        .select("id, sale_id, policy_type_name, policy_number, total_items, total_premium")
        .eq("sale_id", sale.id);
      if (salePoliciesError) throw salePoliciesError;

      const policies = (salePolicies || []) as SalePolicyDetailRow[];
      if (policies.length === 0) {
        return {
          sale_id: sale.id,
          status: "manual_review_required",
          reason: "sale has no sale_policies rows to rebuild LQS linkage",
        };
      }

      const inserts = policies.map((policy) => ({
        household_id: householdId,
        agency_id: sale.agency_id,
        team_member_id: sale.team_member_id,
        sale_date: sale.sale_date,
        product_type: normalizeProductType(policy.policy_type_name),
        items_sold: policy.total_items || 1,
        policies_sold: 1,
        premium_cents: Math.round((policy.total_premium || 0) * 100),
        policy_number: policy.policy_number,
        source: "sales_dashboard",
        source_reference_id: sale.id,
      }));

      const { error: fallbackInsertError } = await admin
        .from("lqs_sales")
        .insert(inserts);
      if (fallbackInsertError) {
        const pgError = fallbackInsertError as PostgrestLikeError;
        if (pgError.code !== "23505") throw fallbackInsertError;

        const { data: existingUnlinkedRows, error: existingUnlinkedRowsError } = await admin
          .from("lqs_sales")
          .select("id, product_type, premium_cents, policy_number")
          .eq("agency_id", sale.agency_id)
          .eq("household_id", householdId)
          .eq("sale_date", sale.sale_date)
          .is("source_reference_id", null);
        if (existingUnlinkedRowsError) throw existingUnlinkedRowsError;

        const unmatchedExistingRows = [...((existingUnlinkedRows || []) as Array<{
          id: string;
          product_type: string | null;
          premium_cents: number | null;
          policy_number: string | null;
        }>)];
        let matchedExistingRows = 0;

        for (const policy of policies) {
          const normalizedPolicyType = normalizeProductType(policy.policy_type_name);
          const premiumCents = Math.round((policy.total_premium || 0) * 100);
          const matchIndex = unmatchedExistingRows.findIndex((row) =>
            normalizeProductType(row.product_type) === normalizedPolicyType &&
            (row.premium_cents || 0) === premiumCents &&
            matchesPolicyNumber(row.policy_number, policy.policy_number)
          );

          if (matchIndex === -1) {
            continue;
          }

          const matchedRow = unmatchedExistingRows.splice(matchIndex, 1)[0];
          const { data: updatedRows, error: updateExistingError } = await admin
            .from("lqs_sales")
            .update({
              source_reference_id: sale.id,
              team_member_id: sale.team_member_id,
            })
            .eq("id", matchedRow.id)
            .is("source_reference_id", null)
            .select("id");
          if (updateExistingError) throw updateExistingError;

          matchedExistingRows += updatedRows?.length || 0;
        }

        if (matchedExistingRows === policies.length) {
          actions.push("linked_existing_lqs_sales");
        }
      } else {
        actions.push("inserted_lqs_sales_fallback");
      }

      const { data: linkedRowsAfterRepair, error: linkedRowsAfterRepairError } = await admin
        .from("lqs_sales")
        .select("id")
        .eq("agency_id", sale.agency_id)
        .eq("source_reference_id", sale.id);
      if (linkedRowsAfterRepairError) throw linkedRowsAfterRepairError;

      if (!linkedRowsAfterRepair || linkedRowsAfterRepair.length === 0) {
        const matchedCandidateRows = await findMatchedCandidateLqsSales(
          admin,
          sale,
          householdId,
          policies,
        );

        if (matchedCandidateRows.length === policies.length) {
          const conflictSaleIds = unique(
            matchedCandidateRows.map((row) => row.source_reference_id).filter(Boolean),
          ) as string[];

          if (conflictSaleIds.length === 1) {
            const conflictSaleId = conflictSaleIds[0];
            const { data: conflictSale, error: conflictSaleError } = await admin
              .from("sales")
              .select(
                "id, agency_id, team_member_id, lead_source_id, contact_id, customer_name, customer_email, customer_phone, customer_zip, sale_date, total_policies, total_items, total_premium, source",
              )
              .eq("id", conflictSaleId)
              .maybeSingle();
            if (conflictSaleError) throw conflictSaleError;

            const typedConflictSale = conflictSale as SaleRow | null;

            if (!typedConflictSale) {
              const { error: relinkDanglingError } = await admin
                .from("lqs_sales")
                .update({
                  source_reference_id: sale.id,
                  team_member_id: sale.team_member_id,
                })
                .in("id", matchedCandidateRows.map((row) => row.id));
              if (relinkDanglingError) throw relinkDanglingError;

              actions.push("relinked_dangling_lqs_sales");
            } else {
              const { data: conflictPolicies, error: conflictPoliciesError } = await admin
                .from("sale_policies")
                .select("id, sale_id, policy_type_name, policy_number, total_items, total_premium")
                .eq("sale_id", typedConflictSale.id);
              if (conflictPoliciesError) throw conflictPoliciesError;

              const existingPolicies = (conflictPolicies || []) as SalePolicyDetailRow[];
              if (
                typedConflictSale.source === "lqs_import" &&
                isExactDuplicateSale(
                  sale,
                  policies,
                  typedConflictSale,
                  existingPolicies,
                )
              ) {
                const canonicalSaleId = typedConflictSale.id;

                const saleUpdate: Record<string, unknown> = {};
                if (!typedConflictSale.customer_email && sale.customer_email) {
                  saleUpdate.customer_email = sale.customer_email;
                }
                if (!typedConflictSale.customer_phone && sale.customer_phone) {
                  saleUpdate.customer_phone = sale.customer_phone;
                }
                if (!typedConflictSale.contact_id && sale.contact_id) {
                  saleUpdate.contact_id = sale.contact_id;
                }
                if (!typedConflictSale.lead_source_id && sale.lead_source_id) {
                  saleUpdate.lead_source_id = sale.lead_source_id;
                }
                if (Object.keys(saleUpdate).length > 0) {
                  const { error: canonicalSaleUpdateError } = await admin
                    .from("sales")
                    .update(saleUpdate)
                    .eq("id", canonicalSaleId);
                  if (canonicalSaleUpdateError) throw canonicalSaleUpdateError;
                }

                const { error: deleteItemsError } = await admin
                  .from("sale_items")
                  .delete()
                  .eq("sale_id", sale.id);
                if (deleteItemsError) throw deleteItemsError;

                const { error: deletePoliciesError } = await admin
                  .from("sale_policies")
                  .delete()
                  .eq("sale_id", sale.id);
                if (deletePoliciesError) throw deletePoliciesError;

                const { error: deleteSaleError } = await admin
                  .from("sales")
                  .delete()
                  .eq("id", sale.id);
                if (deleteSaleError) throw deleteSaleError;

                return {
                  sale_id: sale.id,
                  status: "repaired",
                  actions: [
                    ...actions,
                    "merged_duplicate_into_existing_sale",
                  ],
                  canonical_sale_id: canonicalSaleId,
                };
              }
            }
          }
        }

        const { data: linkedRowsAfterFallback, error: linkedRowsAfterFallbackError } = await admin
          .from("lqs_sales")
          .select("id")
          .eq("agency_id", sale.agency_id)
          .eq("source_reference_id", sale.id);
        if (linkedRowsAfterFallbackError) throw linkedRowsAfterFallbackError;

        if (!linkedRowsAfterFallback || linkedRowsAfterFallback.length === 0) {
          const matchedCount = matchedCandidateRows.length;
          return {
            sale_id: sale.id,
            status: "manual_review_required",
            reason:
              matchedCount > 0
                ? `duplicate LQS sales existed, but only matched ${matchedCount} of ${policies.length} policy rows`
                : "repair did not produce any source_reference_id-linked LQS sales",
          };
        }
      }
    }
  }

  if (sale.team_member_id && issue.issue_types.includes("lqs_sale_team_member_mismatch")) {
    const { error: lqsSalesUpdateError } = await admin
      .from("lqs_sales")
      .update({ team_member_id: sale.team_member_id })
      .eq("source_reference_id", sale.id)
      .eq("agency_id", sale.agency_id);
    if (lqsSalesUpdateError) throw lqsSalesUpdateError;
    actions.push("updated_lqs_sale_team_member");
  }

  if (sale.team_member_id && issue.issue_types.includes("household_team_member_mismatch")) {
    const householdIds = issue.linked_household_ids;
    if (householdIds.length === 1) {
      const { error: householdTeamMemberError } = await admin
        .from("lqs_households")
        .update({ team_member_id: sale.team_member_id })
        .eq("id", householdIds[0])
        .eq("agency_id", sale.agency_id);
      if (householdTeamMemberError) throw householdTeamMemberError;
      actions.push("updated_household_team_member");
    }
  }

  if (sale.lead_source_id && issue.issue_types.includes("household_lead_source_mismatch")) {
    const householdIds = issue.linked_household_ids;
    if (householdIds.length === 1) {
      const { error: leadSourceUpdateError } = await admin
        .from("lqs_households")
        .update({ lead_source_id: sale.lead_source_id })
        .eq("id", householdIds[0])
        .eq("agency_id", sale.agency_id);
      if (leadSourceUpdateError) throw leadSourceUpdateError;
      actions.push("updated_household_lead_source");
    }
  }

  return {
    sale_id: sale.id,
    status: actions.length > 0 ? "repaired" : "no_changes_needed",
    actions,
  };
}

async function inspectSales(
  admin: AdminClient,
  sales: SaleRow[],
): Promise<Array<Record<string, unknown>>> {
  const results: Array<Record<string, unknown>> = [];

  for (const sale of sales) {
    const { data: salePolicies, error: salePoliciesError } = await admin
      .from("sale_policies")
      .select("id, policy_type_name, policy_number, total_items, total_premium")
      .eq("sale_id", sale.id);
    if (salePoliciesError) throw salePoliciesError;

    const { data: linkedRows, error: linkedRowsError } = await admin
      .from("lqs_sales")
      .select(
        "id, household_id, source_reference_id, sale_date, product_type, premium_cents, policy_number, team_member_id",
      )
      .eq("agency_id", sale.agency_id)
      .eq("source_reference_id", sale.id);
    if (linkedRowsError) throw linkedRowsError;

    const { data: matchCandidates, error: matchCandidatesError } = await admin.rpc(
      "match_sale_to_lqs_household",
      { p_sale_id: sale.id },
    );
    if (matchCandidatesError) throw matchCandidatesError;

    const householdKey = generateHouseholdKey(sale.customer_name, sale.customer_zip);
    const candidateHouseholdIds = unique([
      ...((Array.isArray(matchCandidates) ? matchCandidates : []) as HouseholdMatchRow[])
        .map((row) => row.household_id || ""),
    ].filter(Boolean));

    const { data: keyHouseholds, error: keyHouseholdsError } = await admin
      .from("lqs_households")
      .select("id, household_key, first_name, last_name, zip_code, phone, email, team_member_id")
      .eq("agency_id", sale.agency_id)
      .eq("household_key", householdKey);
    if (keyHouseholdsError) throw keyHouseholdsError;

    (keyHouseholds as HouseholdRow[] | null)?.forEach((row) => candidateHouseholdIds.push(row.id));

    let candidateLqsSales: Array<Record<string, unknown>> = [];
    if (candidateHouseholdIds.length > 0) {
      const { data, error: candidateLqsSalesError } = await admin
        .from("lqs_sales")
        .select(
          "id, household_id, source_reference_id, sale_date, product_type, premium_cents, policy_number, team_member_id",
        )
        .eq("agency_id", sale.agency_id)
        .eq("sale_date", sale.sale_date)
        .in("household_id", unique(candidateHouseholdIds));
      if (candidateLqsSalesError) throw candidateLqsSalesError;
      candidateLqsSales = data || [];
    }

    results.push({
      sale,
      sale_policies: ((salePolicies || []) as SalePolicyDetailRow[]).map((policy) => ({
        ...policy,
        normalized_product_type: normalizeProductType(policy.policy_type_name),
        premium_cents: Math.round((((policy.total_premium as number | null) || 0) * 100)),
      })),
      linked_lqs_sales: linkedRows || [],
      match_candidates: Array.isArray(matchCandidates) ? matchCandidates : [],
      key_households: keyHouseholds || [],
      candidate_lqs_sales: candidateLqsSales.map((row) => ({
        ...row,
        normalized_product_type: normalizeProductType(row.product_type as string | null | undefined),
      })),
    });
  }

  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const maintenanceKey = Deno.env.get("LQS_MAINTENANCE_KEY");
    if (!maintenanceKey) {
      return json(500, { error: "Missing LQS_MAINTENANCE_KEY secret" });
    }

    if (req.headers.get("x-maintenance-key") !== maintenanceKey) {
      return json(401, { error: "Invalid maintenance key" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = (await req.json().catch(() => ({}))) as AuditRequest;
    const mode = body.mode || "preview";
    if (!["preview", "repair", "inspect"].includes(mode)) {
      return json(400, { error: "mode must be preview, repair, or inspect" });
    }

    const teamMembers = await loadTeamMembers(admin, body);
    const teamMemberMap = new Map(teamMembers.map((row) => [row.id, row]));
    const sales = await loadSales(admin, body, teamMembers);
    const saleIds = sales.map((sale) => sale.id);
    const salePolicyCounts = await loadSalePolicies(admin, saleIds);
    const linkedRows = await loadLinkedLqsSales(admin, saleIds);
    const householdsById = await loadHouseholds(
      admin,
      unique(linkedRows.map((row) => row.household_id)),
    );

    const { issues, producerSummaries } = buildIssueSummary(
      sales,
      teamMemberMap,
      linkedRows,
      householdsById,
      salePolicyCounts,
    );

    if (mode === "preview") {
      return json(200, {
        mode,
        filters: body,
        matched_team_members: teamMembers,
        total_sales_scanned: sales.length,
        issues_found: issues.length,
        producer_summaries: producerSummaries,
        issues,
      });
    }

    if (mode === "inspect") {
      return json(200, {
        mode,
        filters: body,
        total_sales_scanned: sales.length,
        inspections: await inspectSales(admin, sales),
      });
    }

    const salesById = new Map(sales.map((sale) => [sale.id, sale]));
    const repairs: Array<Record<string, unknown>> = [];

    for (const issue of issues) {
      const sale = salesById.get(issue.sale_id);
      if (!sale) continue;
      try {
        const result = await repairSaleIntegrity(admin, sale, issue);
        repairs.push(result);
      } catch (error) {
        repairs.push({
          sale_id: sale.id,
          status: "repair_failed",
          error: error instanceof Error
            ? error.message
            : typeof error === "string"
            ? error
            : JSON.stringify(error),
        });
      }
    }

    return json(200, {
      mode,
      filters: body,
      total_sales_scanned: sales.length,
      issues_found: issues.length,
      repairs_attempted: repairs.length,
      repairs,
    });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
