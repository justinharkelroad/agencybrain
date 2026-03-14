import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-staff-session",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXCLUDED_PRODUCTS = ["motor club"];

type SyncMode = "preview" | "execute" | "undo";

interface SyncRequest {
  mode: SyncMode;
  agency_id: string;
  date_start?: string;
  date_end?: string;
  lqs_sale_ids?: string[];
  include_unassigned?: boolean;
  team_member_ids?: string[];
  dry_run?: boolean;
  batch_size?: number;
  cursor?: string | null;
  batch_id?: string | null;
}

interface LqsSaleRow {
  id: string;
  household_id: string;
  sale_date: string;
  team_member_id: string | null;
  product_type: string;
  items_sold: number;
  policies_sold: number;
  premium_cents: number;
  policy_number: string | null;
  source_reference_id: string | null;
  is_one_call_close: boolean;
  sync_status?: string | null;
}

interface PolicyTypeMeta {
  id: string;
  name: string;
  is_vc_item: boolean | null; // per-agency override; null = inherit from product_type
  product_type: {
    name: string | null;
    default_points: number | null;
    is_vc_item: boolean | null;
  } | {
    name: string | null;
    default_points: number | null;
    is_vc_item: boolean | null;
  }[] | null;
}

interface HouseholdMeta {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string[] | null;
  zip_code: string | null;
  contact_id: string | null;
  lead_source_id: string | null;
  prior_insurance_company_id: string | null;
}

interface ExistingSalePolicyLink {
  sale_id: string;
  policy_number: string | null;
  sales: {
    id: string;
    agency_id: string;
  } | {
    id: string;
    agency_id: string;
  }[] | null;
}

function unwrapProductTypeMeta(
  productType: PolicyTypeMeta["product_type"],
): { name: string | null; default_points: number | null; is_vc_item: boolean | null } | null {
  if (!productType) return null;
  return Array.isArray(productType) ? productType[0] ?? null : productType;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeProductName(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function isExcludedProduct(value: string | null | undefined): boolean {
  const normalized = normalizeProductName(value);
  return EXCLUDED_PRODUCTS.some((excluded) => excluded === normalized);
}

function toDollars(cents: number | null | undefined): number {
  return Math.round(((cents || 0) / 100) * 100) / 100;
}

function getGroupKey(row: LqsSaleRow): string {
  return `${row.sale_date}|${row.household_id}|${
    row.team_member_id ?? "unassigned"
  }`;
}

function deriveBundleType(
  productNames: string[],
): { is_bundle: boolean; bundle_type: string | null } {
  const canonical = new Set<string>();
  for (const raw of productNames) {
    const name = normalizeProductName(raw);
    if (!name || isExcludedProduct(name)) continue;

    const lineCodeMatch = name.match(/^(\d{3})\s*-\s*/);
    const lineCodeMap: Record<string, string> = {
      "010": "standard_auto",
      "020": "other_recognized",
      "021": "other_recognized",
      "070": "homeowners",
      "072": "property_other",
      "073": "property_other",
      "074": "condo",
      "078": "condo",
      "080": "other_recognized",
      "090": "other_recognized",
    };
    const lineMapped = lineCodeMatch ? lineCodeMap[lineCodeMatch[1]] : null;
    if (lineMapped) {
      canonical.add(lineMapped);
      continue;
    }

    if (["standard auto", "auto", "personal auto"].includes(name)) {
      canonical.add("standard_auto");
    } else if (["homeowners", "north light homeowners", "home"].includes(name)) {
      canonical.add("homeowners");
    } else if (["condo", "north light condo", "condominium"].includes(name)) {
      canonical.add("condo");
    } else if ([
      "renters",
      "landlords",
      "landlord package",
      "landlord/dwelling",
      "mobilehome",
      "manufactured home",
    ].includes(name)) {
      canonical.add("property_other");
    } else if ([
      "non-standard auto",
      "auto - special",
      "specialty auto",
      "motorcycle",
      "boatowners",
      "personal umbrella",
      "off-road vehicle",
      "recreational vehicle",
      "flood",
    ].includes(name)) {
      canonical.add("other_recognized");
    }
  }

  const hasAuto = canonical.has("standard_auto");
  const hasHome = canonical.has("homeowners") || canonical.has("condo");
  const isBundle = canonical.size >= 2 || (hasAuto && hasHome);

  if (hasAuto && hasHome) return { is_bundle: true, bundle_type: "Preferred" };
  if (isBundle) return { is_bundle: true, bundle_type: "Standard" };
  return { is_bundle: false, bundle_type: null };
}

function clampBatchSize(value: number | undefined): number {
  if (!value || Number.isNaN(value)) return 200;
  return Math.max(25, Math.min(500, Math.trunc(value)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = (await req.json().catch(() => ({}))) as Partial<SyncRequest>;
    const mode = body.mode;
    const agencyId = body.agency_id;

    if (!mode || !["preview", "execute", "undo"].includes(mode)) {
      return json(400, {
        error: "mode must be 'preview', 'execute', or 'undo'",
      });
    }
    if (!agencyId) {
      return json(400, { error: "agency_id is required" });
    }

    let authorized = false;
    let startedByUserId: string | null = null;
    let startedByStaffUserId: string | null = null;

    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await userClient.auth.getUser();
      const userId = userData.user?.id;
      if (userId) {
        const { data: access, error: accessError } = await admin.rpc(
          "has_agency_access",
          {
            _user_id: userId,
            _agency_id: agencyId,
          },
        );
        if (!accessError && access === true) {
          authorized = true;
          startedByUserId = userId;
        }
      }
    }

    if (!authorized) {
      const sessionToken = req.headers.get("x-staff-session");
      if (sessionToken) {
        const nowIso = new Date().toISOString();
        const { data: session, error: sessionError } = await admin
          .from("staff_sessions")
          .select("staff_user_id, is_valid, expires_at")
          .eq("session_token", sessionToken)
          .eq("is_valid", true)
          .gt("expires_at", nowIso)
          .maybeSingle();

        if (!sessionError && session) {
          const { data: staffUser, error: staffError } = await admin
            .from("staff_users")
            .select("id, agency_id, is_active")
            .eq("id", session.staff_user_id)
            .maybeSingle();

          if (
            !staffError && staffUser?.is_active &&
            staffUser.agency_id === agencyId
          ) {
            authorized = true;
            startedByStaffUserId = staffUser.id;
          }
        }
      }
    }

    if (!authorized) {
      return json(403, { error: "Unauthorized for requested agency" });
    }

    const includeUnassigned = body.include_unassigned ?? true;
    const requestedSaleIds = Array.isArray(body.lqs_sale_ids)
      ? Array.from(new Set(body.lqs_sale_ids.filter((value): value is string =>
          typeof value === "string" && value.length > 0
        )))
      : null;
    const teamMemberIds = body.team_member_ids ?? [];

    let rows: LqsSaleRow[] = [];
    if (!requestedSaleIds || requestedSaleIds.length > 0) {
      let baseQuery = admin
        .from("lqs_sales")
        .select(
          "id, household_id, sale_date, team_member_id, product_type, items_sold, policies_sold, premium_cents, policy_number, source_reference_id, is_one_call_close, sync_status",
        )
        .eq("agency_id", agencyId)
        .is("source_reference_id", null)
        .or("sync_status.is.null,sync_status.eq.failed");

      if (requestedSaleIds) {
        baseQuery = baseQuery.in("id", requestedSaleIds);
      }
      if (body.date_start) {
        baseQuery = baseQuery.gte("sale_date", body.date_start);
      }
      if (body.date_end) baseQuery = baseQuery.lte("sale_date", body.date_end);
      if (!includeUnassigned) {
        baseQuery = baseQuery.not("team_member_id", "is", null);
      }
      if (teamMemberIds.length > 0) {
        baseQuery = baseQuery.in("team_member_id", teamMemberIds);
      }

      const { data: allRows, error } = await baseQuery;
      if (error) return json(500, { error: error.message });
      rows = (allRows || []) as LqsSaleRow[];
    }

    if (mode === "preview") {
      const excludedRows = rows.filter((r) =>
        isExcludedProduct(r.product_type)
      );
      const candidates = rows.filter((r) => !isExcludedProduct(r.product_type));

      const groups = new Map<string, LqsSaleRow[]>();
      for (const row of candidates) {
        const key = getGroupKey(row);
        const existing = groups.get(key) || [];
        existing.push(row);
        groups.set(key, existing);
      }

      const productBreakdown = new Map<
        string,
        {
          rows: number;
          groups: number;
          items: number;
          policies: number;
          premium_cents: number;
        }
      >();
      const groupCountByProduct = new Map<string, Set<string>>();

      let totalItems = 0;
      let totalPolicies = 0;
      let totalPremiumCents = 0;
      let unassignedCount = 0;

      for (const [groupKey, groupRows] of groups.entries()) {
        const groupUnassigned = !groupRows[0].team_member_id;
        if (groupUnassigned) unassignedCount += 1;

        for (const row of groupRows) {
          totalItems += row.items_sold || 0;
          totalPolicies += row.policies_sold || 0;
          totalPremiumCents += row.premium_cents || 0;

          const product = normalizeProductName(row.product_type);
          const current = productBreakdown.get(product) || {
            rows: 0,
            groups: 0,
            items: 0,
            policies: 0,
            premium_cents: 0,
          };
          current.rows += 1;
          current.items += row.items_sold || 0;
          current.policies += row.policies_sold || 0;
          current.premium_cents += row.premium_cents || 0;
          productBreakdown.set(product, current);

          const groupSet = groupCountByProduct.get(product) ||
            new Set<string>();
          groupSet.add(groupKey);
          groupCountByProduct.set(product, groupSet);
        }
      }

      for (const [product, set] of groupCountByProduct.entries()) {
        const row = productBreakdown.get(product);
        if (row) row.groups = set.size;
      }

      return json(200, {
        mode: "preview",
        agency_id: agencyId,
        date_start: body.date_start ?? null,
        date_end: body.date_end ?? null,
        candidate_count: candidates.length,
        excluded_count: excludedRows.length,
        grouped_candidate_count: groups.size,
        to_insert_count: groups.size,
        unassigned_count: unassignedCount,
        totals: {
          premium_cents: totalPremiumCents,
          items: totalItems,
          policies: totalPolicies,
        },
        product_breakdown: Array.from(productBreakdown.entries())
          .map(([product_type, v]) => ({ product_type, ...v }))
          .sort((a, b) => b.premium_cents - a.premium_cents),
        notes: [
          "Motor Club is excluded and will be marked as skipped in execute mode.",
          "metrics_daily may already reflect LQS uploads; this sync targets sales-table dashboards and promos.",
          "brokered carrier attribution is not available on lqs_sales and defaults to non-brokered in v1 sync.",
        ],
        errors: [],
      });
    }

    if (mode === "undo") {
      const batchId = body.batch_id;
      if (!batchId) {
        return json(400, { error: "batch_id is required for undo mode" });
      }

      const { data: batch, error: batchError } = await admin
        .from("lqs_sales_sync_batches")
        .select("id, agency_id, status")
        .eq("id", batchId)
        .eq("agency_id", agencyId)
        .maybeSingle();

      if (batchError) return json(500, { error: batchError.message });
      if (!batch) return json(404, { error: "batch not found" });

      const { data: salesRows, error: salesLookupError } = await admin
        .from("sales")
        .select("id")
        .eq("agency_id", agencyId)
        .eq("source", "lqs_import")
        .eq("source_details->>sync_batch_id", batchId);

      if (salesLookupError) {
        return json(500, { error: salesLookupError.message });
      }

      const saleIds = (salesRows || []).map((row) => row.id as string);
      let deletedSales = 0;

      for (let i = 0; i < saleIds.length; i += 500) {
        const chunk = saleIds.slice(i, i + 500);

        const { error: deleteItemsError } = await admin.from("sale_items")
          .delete().in("sale_id", chunk);
        if (deleteItemsError) {
          return json(500, { error: deleteItemsError.message });
        }

        const { error: deletePoliciesError } = await admin.from("sale_policies")
          .delete().in("sale_id", chunk);
        if (deletePoliciesError) {
          return json(500, { error: deletePoliciesError.message });
        }

        const { error: deleteSalesError } = await admin.from("sales").delete()
          .in("id", chunk);
        if (deleteSalesError) {
          return json(500, { error: deleteSalesError.message });
        }

        deletedSales += chunk.length;
      }

      const { data: clearedRows, error: clearLookupError } = await admin
        .from("lqs_sales")
        .select("id")
        .eq("agency_id", agencyId)
        .eq("sync_batch_id", batchId);
      if (clearLookupError) {
        return json(500, { error: clearLookupError.message });
      }

      const clearedIds = (clearedRows || []).map((row) => row.id as string);
      if (clearedIds.length > 0) {
        const { error: clearError } = await admin
          .from("lqs_sales")
          .update({
            source_reference_id: null,
            sync_batch_id: null,
            sync_status: null,
            sync_error: null,
            synced_at: null,
          })
          .in("id", clearedIds);
        if (clearError) return json(500, { error: clearError.message });
      }

      const { error: batchUpdateError } = await admin
        .from("lqs_sales_sync_batches")
        .update({
          status: "cancelled",
          finished_at: new Date().toISOString(),
          notes: `Undo completed on ${
            new Date().toISOString()
          }. Deleted ${deletedSales} synced sales.`,
        })
        .eq("id", batchId)
        .eq("agency_id", agencyId);

      if (batchUpdateError) {
        return json(500, { error: batchUpdateError.message });
      }

      return json(200, {
        mode: "undo",
        batch_id: batchId,
        deleted_sales: deletedSales,
        cleared_lqs_rows: clearedIds.length,
      });
    }

    // execute mode
    const dryRun = body.dry_run ?? false;
    const batchSize = clampBatchSize(body.batch_size);
    const nowIso = new Date().toISOString();

    let batchId = body.batch_id ?? null;
    let existingBatch:
      | {
        id: string;
        status: string;
        started_by_user_id: string | null;
        total_candidates: number;
        inserted_sales: number;
        already_linked: number;
        failed_rows: number;
      }
      | null = null;

    if (batchId) {
      const { data: batch, error: batchError } = await admin
        .from("lqs_sales_sync_batches")
        .select(
          "id, status, started_by_user_id, total_candidates, inserted_sales, already_linked, failed_rows",
        )
        .eq("id", batchId)
        .eq("agency_id", agencyId)
        .maybeSingle();
      if (batchError) return json(500, { error: batchError.message });
      if (!batch) return json(404, { error: "batch not found" });
      if (batch.status !== "running") {
        return json(409, {
          error: `batch is not running (status=${batch.status})`,
        });
      }
      existingBatch = batch as unknown as typeof existingBatch;
    } else if (!dryRun) {
      if (!startedByUserId && !startedByStaffUserId) {
        return json(400, {
          error: "could not determine batch starter identity",
        });
      }

      const { data: createdBatch, error: createBatchError } = await admin
        .from("lqs_sales_sync_batches")
        .insert({
          agency_id: agencyId,
          started_by_user_id: startedByUserId,
          started_by_staff_user_id: startedByStaffUserId,
          status: "running",
          date_start: body.date_start ?? null,
          date_end: body.date_end ?? null,
          include_unassigned: includeUnassigned,
          total_candidates: rows.length,
          inserted_sales: 0,
          already_linked: 0,
          failed_rows: 0,
        })
        .select(
          "id, status, started_by_user_id, total_candidates, inserted_sales, already_linked, failed_rows",
        )
        .single();

      if (createBatchError) {
        return json(409, {
          error: "failed_to_create_batch",
          message: createBatchError.message,
        });
      }

      batchId = createdBatch.id;
      existingBatch = createdBatch as unknown as typeof existingBatch;
    } else {
      existingBatch = {
        id: "dry-run",
        status: "running",
        started_by_user_id: startedByUserId,
        total_candidates: rows.length,
        inserted_sales: 0,
        already_linked: 0,
        failed_rows: 0,
      };
    }

    const excludedRows = rows.filter((r) => isExcludedProduct(r.product_type));
    const eligibleRows = rows.filter((r) => !isExcludedProduct(r.product_type));

    if (!dryRun && excludedRows.length > 0) {
      const excludedIds = excludedRows.map((r) => r.id);
      const { error: excludedUpdateError } = await admin
        .from("lqs_sales")
        .update({
          sync_batch_id: batchId,
          sync_status: "skipped",
          sync_error: "Excluded product type (Motor Club)",
          synced_at: nowIso,
        })
        .in("id", excludedIds);
      if (excludedUpdateError) {
        return json(500, { error: excludedUpdateError.message });
      }
    }

    const groups = new Map<string, LqsSaleRow[]>();
    for (const row of eligibleRows) {
      const key = getGroupKey(row);
      const existing = groups.get(key) || [];
      existing.push(row);
      groups.set(key, existing);
    }

    const orderedKeys = Array.from(groups.keys()).sort();
    const cursor = body.cursor ?? null;

    let startIndex = 0;
    if (cursor) {
      const exactIndex = orderedKeys.findIndex((key) => key === cursor);
      if (exactIndex >= 0) {
        startIndex = exactIndex + 1;
      } else {
        const nextIndex = orderedKeys.findIndex((key) => key > cursor);
        startIndex = nextIndex >= 0 ? nextIndex : orderedKeys.length;
      }
    }

    const selectedKeys = orderedKeys.slice(startIndex, startIndex + batchSize);
    const hasMore = startIndex + batchSize < orderedKeys.length;
    const nextCursor = selectedKeys.length > 0
      ? selectedKeys[selectedKeys.length - 1]
      : null;

    if (dryRun) {
      return json(200, {
        mode: "execute",
        dry_run: true,
        batch_id: batchId,
        batch_size: batchSize,
        total_group_candidates: orderedKeys.length,
        selected_group_count: selectedKeys.length,
        excluded_count: excludedRows.length,
        has_more: hasMore,
        next_cursor: nextCursor,
      });
    }

    if (selectedKeys.length === 0) {
      const { error: finishBatchError } = await admin
        .from("lqs_sales_sync_batches")
        .update({
          status: "completed",
          finished_at: nowIso,
          already_linked: (existingBatch?.already_linked || 0) +
            excludedRows.length,
        })
        .eq("id", batchId)
        .eq("agency_id", agencyId);

      if (finishBatchError) {
        return json(500, { error: finishBatchError.message });
      }

      return json(200, {
        mode: "execute",
        batch_id: batchId,
        processed_groups: 0,
        inserted_sales: 0,
        linked_rows: 0,
        failed_rows: 0,
        skipped_rows: excludedRows.length,
        has_more: false,
        next_cursor: null,
        status: "completed",
      });
    }

    const selectedRows = selectedKeys.flatMap((key) => groups.get(key) || []);
    const householdIds = Array.from(
      new Set(selectedRows.map((row) => row.household_id)),
    );
    const { data: householdsData, error: householdError } = await admin
      .from("lqs_households")
      .select(
        "id, first_name, last_name, email, phone, zip_code, contact_id, lead_source_id, prior_insurance_company_id",
      )
      .in("id", householdIds);
    if (householdError) return json(500, { error: householdError.message });

    const { data: policyTypesData, error: policyTypesError } = await admin
      .from("policy_types")
      .select(
        "id, name, is_vc_item, product_type:product_types(name, default_points, is_vc_item)",
      )
      .eq("agency_id", agencyId);

    if (policyTypesError) return json(500, { error: policyTypesError.message });

    const householdById = new Map<string, HouseholdMeta>();
    for (const household of (householdsData || []) as HouseholdMeta[]) {
      householdById.set(household.id, household);
    }

    // Build all-time household product history from LQS sales so bundle
    // classification reflects historical cross-date product ownership.
    const householdProductHistory = new Map<string, Set<string>>();
    const { data: householdSalesHistory, error: householdSalesHistoryError } =
      await admin
        .from("lqs_sales")
        .select("household_id, product_type")
        .eq("agency_id", agencyId)
        .in("household_id", householdIds);
    if (householdSalesHistoryError) {
      return json(500, { error: householdSalesHistoryError.message });
    }
    for (const historyRow of householdSalesHistory || []) {
      const product = normalizeProductName(historyRow.product_type);
      if (!product || isExcludedProduct(product)) continue;
      const existing = householdProductHistory.get(historyRow.household_id) ||
        new Set<string>();
      existing.add(product);
      householdProductHistory.set(historyRow.household_id, existing);
    }

    const policyByNormalizedName = new Map<string, PolicyTypeMeta>();
    for (const policyType of (policyTypesData || []) as PolicyTypeMeta[]) {
      policyByNormalizedName.set(
        normalizeProductName(policyType.name),
        policyType,
      );
    }

    let insertedSales = 0;
    let linkedRows = 0;
    let failedRows = 0;
    const skippedRows = excludedRows.length;

    for (const groupKey of selectedKeys) {
      const groupRows = groups.get(groupKey) || [];
      if (groupRows.length === 0) continue;

      const first = groupRows[0];
      const household = householdById.get(first.household_id);

      const policyInserts: Array<{
        rowId: string;
        product_type_id: string | null;
        policy_type_name: string;
        policy_number: string | null;
        effective_date: string;
        expiration_date: string | null;
        total_items: number;
        total_premium: number;
        total_points: number;
        is_vc_qualifying: boolean;
        canonical_name: string;
      }> = [];

      for (const row of groupRows) {
        const normalized = normalizeProductName(row.product_type);
        const policyType = policyByNormalizedName.get(normalized);
        const resolvedProductType = unwrapProductTypeMeta(policyType?.product_type ?? null);
        const defaultPoints = resolvedProductType?.default_points || 0;
        const isVc = policyType?.is_vc_item != null
          ? !!policyType.is_vc_item
          : !!resolvedProductType?.is_vc_item;
        const itemCount = row.items_sold || 0;
        const premium = toDollars(row.premium_cents);

        policyInserts.push({
          rowId: row.id,
          product_type_id: policyType?.id || null,
          policy_type_name: policyType?.name || row.product_type,
          policy_number: row.policy_number || null,
          effective_date: row.sale_date,
          expiration_date: null,
          total_items: itemCount,
          total_premium: premium,
          total_points: defaultPoints * itemCount,
          is_vc_qualifying: isVc,
          canonical_name: resolvedProductType?.name || policyType?.name ||
            row.product_type,
        });
      }

      const groupPolicyNumbers = Array.from(
        new Set(
          policyInserts
            .map((policy) => policy.policy_number?.trim())
            .filter((value): value is string => !!value)
        )
      );

      const saleTotals = policyInserts.reduce(
        (acc, policy) => {
          acc.total_policies += 1;
          acc.total_items += policy.total_items;
          acc.total_premium += policy.total_premium;
          acc.total_points += policy.total_points;
          if (policy.is_vc_qualifying) {
            acc.vc_items += policy.total_items;
            acc.vc_premium += policy.total_premium;
            acc.vc_points += policy.total_points;
          }
          return acc;
        },
        {
          total_policies: 0,
          total_items: 0,
          total_premium: 0,
          total_points: 0,
          vc_items: 0,
          vc_premium: 0,
          vc_points: 0,
        },
      );

      const historicalProducts = householdProductHistory.get(first.household_id)
        ? [...(householdProductHistory.get(first.household_id) as Set<string>)]
        : [];
      const currentProducts = policyInserts.map((policy) => policy.canonical_name);
      const bundle = deriveBundleType([...historicalProducts, ...currentProducts]);
      const customerName =
        `${household?.first_name || ""} ${household?.last_name || ""}`.trim() ||
        "Unknown Household";
      const customerPhone =
        Array.isArray(household?.phone) && household?.phone.length > 0
          ? household?.phone[0]
          : null;
      const createdBy = existingBatch?.started_by_user_id || startedByUserId ||
        null;
      const isOneCallClose = groupRows.some((row) => row.is_one_call_close);

      let saleId: string | null = null;
      try {
        if (groupPolicyNumbers.length > 0) {
          const { data: existingPolicyLinks, error: existingPolicyLinksError } = await admin
            .from("sale_policies")
            .select("sale_id, policy_number, sales!inner(id, agency_id)")
            .in("policy_number", groupPolicyNumbers)
            .eq("sales.agency_id", agencyId);

          if (existingPolicyLinksError) throw existingPolicyLinksError;

          const existingSaleId = (existingPolicyLinks as ExistingSalePolicyLink[] | null)
            ?.find((row) => row.sale_id)?.sale_id ?? null;

          if (existingSaleId) {
            const groupRowIds = groupRows.map((row) => row.id);
            const { error: linkExistingError } = await admin
              .from("lqs_sales")
              .update({
                source_reference_id: existingSaleId,
                sync_batch_id: batchId,
                sync_status: "synced",
                sync_error: "Linked to existing sales row by policy number",
                synced_at: nowIso,
              })
              .in("id", groupRowIds);

            if (linkExistingError) throw linkExistingError;

            linkedRows += groupRows.length;
            continue;
          }
        }

        const { data: saleRow, error: saleError } = await admin
          .from("sales")
          .insert({
            agency_id: agencyId,
            team_member_id: first.team_member_id,
            contact_id: household?.contact_id || null,
            lead_source_id: household?.lead_source_id || null,
            prior_insurance_company_id: household?.prior_insurance_company_id ||
              null,
            customer_name: customerName,
            customer_email: household?.email || null,
            customer_phone: customerPhone,
            customer_zip: household?.zip_code || null,
            sale_date: first.sale_date,
            effective_date: first.sale_date,
            expiration_date: null,
            total_policies: saleTotals.total_policies,
            total_items: saleTotals.total_items,
            total_premium: saleTotals.total_premium,
            total_points: saleTotals.total_points,
            is_vc_qualifying: saleTotals.vc_items > 0,
            vc_items: saleTotals.vc_items,
            vc_premium: saleTotals.vc_premium,
            vc_points: saleTotals.vc_points,
            is_bundle: bundle.is_bundle,
            bundle_type: bundle.bundle_type,
            source: "lqs_import",
            source_details: {
              sync_batch_id: batchId,
              group_key: groupKey,
              lqs_sales_row_ids: policyInserts.map((policy) => policy.rowId),
            },
            is_one_call_close: isOneCallClose,
            created_by: createdBy,
          })
          .select("id")
          .single();

        if (saleError) throw saleError;
        saleId = saleRow.id;

        const groupRowIds = groupRows.map((row) => row.id);
        const { error: linkError } = await admin
          .from("lqs_sales")
          .update({
            source_reference_id: saleId,
            sync_batch_id: batchId,
            sync_status: "synced",
            sync_error: null,
            synced_at: nowIso,
          })
          .in("id", groupRowIds);

        if (linkError) throw linkError;

        for (const policy of policyInserts) {
          const { data: createdPolicy, error: policyError } = await admin
            .from("sale_policies")
            .insert({
              sale_id: saleId,
              product_type_id: policy.product_type_id,
              policy_type_name: policy.policy_type_name,
              policy_number: policy.policy_number,
              effective_date: policy.effective_date,
              expiration_date: policy.expiration_date,
              total_items: policy.total_items,
              total_premium: policy.total_premium,
              total_points: policy.total_points,
              is_vc_qualifying: policy.is_vc_qualifying,
            })
            .select("id")
            .single();

          if (policyError) throw policyError;

          const { error: itemError } = await admin.from("sale_items").insert({
            sale_id: saleId,
            sale_policy_id: createdPolicy.id,
            product_type_id: policy.product_type_id,
            product_type_name: policy.policy_type_name,
            item_count: policy.total_items,
            premium: policy.total_premium,
            points: policy.total_points,
            is_vc_qualifying: policy.is_vc_qualifying,
          });
          if (itemError) throw itemError;
        }

        insertedSales += 1;
        linkedRows += groupRows.length;
      } catch (groupError) {
        console.error(
          "[sync_lqs_sales_to_dashboard] Group failed",
          groupKey,
          groupError,
        );

        if (saleId) {
          await admin.from("sale_items").delete().eq("sale_id", saleId);
          await admin.from("sale_policies").delete().eq("sale_id", saleId);
          await admin.from("sales").delete().eq("id", saleId);
        }

        const groupRowIds = groupRows.map((row) => row.id);
        const errorMessage = groupError instanceof Error
          ? groupError.message
          : "failed to sync group";
        await admin
          .from("lqs_sales")
          .update({
            source_reference_id: null,
            sync_batch_id: batchId,
            sync_status: "failed",
            sync_error: errorMessage.substring(0, 800),
            synced_at: nowIso,
          })
          .in("id", groupRowIds);

        failedRows += groupRows.length;
      }
    }

    const cumulativeInserted = (existingBatch?.inserted_sales || 0) +
      insertedSales;
    const cumulativeLinked = (existingBatch?.already_linked || 0) + linkedRows +
      skippedRows;
    const cumulativeFailed = (existingBatch?.failed_rows || 0) + failedRows;

    const batchPatch: Record<string, unknown> = {
      inserted_sales: cumulativeInserted,
      already_linked: cumulativeLinked,
      failed_rows: cumulativeFailed,
    };

    if (!hasMore) {
      batchPatch.status = "completed";
      batchPatch.finished_at = nowIso;
    }

    const { error: batchUpdateError } = await admin
      .from("lqs_sales_sync_batches")
      .update(batchPatch)
      .eq("id", batchId)
      .eq("agency_id", agencyId);

    if (batchUpdateError) return json(500, { error: batchUpdateError.message });

    return json(200, {
      mode: "execute",
      batch_id: batchId,
      batch_size: batchSize,
      processed_groups: selectedKeys.length,
      inserted_sales: insertedSales,
      linked_rows: linkedRows,
      failed_rows: failedRows,
      skipped_rows: skippedRows,
      has_more: hasMore,
      next_cursor: nextCursor,
      status: hasMore ? "running" : "completed",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json(500, { error: message });
  }
});
