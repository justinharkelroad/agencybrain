import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-staff-session",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Motor Club exclusion logic - must match frontend product-constants.ts
const EXCLUDED_PRODUCTS = ['Motor Club'];
function isExcludedProduct(productType: string | null | undefined): boolean {
  if (!productType) return false;
  return EXCLUDED_PRODUCTS.some(
    excluded => excluded.toLowerCase() === productType.toLowerCase()
  );
}

interface SalePolicy {
  id: string;
  policy_type_name: string | null;
  total_premium: number | null;
  total_items: number | null;
  total_points: number | null;
}

type BundleType = "Preferred" | "Standard" | "Monoline";

function normalizeProductName(name: string | null | undefined): string {
  return (name || "").toLowerCase().trim();
}

function buildCustomerKey(
  customerName: string | null | undefined,
  customerZip?: string | null | undefined,
): string {
  const normalizedName = normalizeProductName(customerName);
  if (!normalizedName) return "";
  const normalizedZip = (customerZip || "").trim();
  return normalizedZip ? `${normalizedName}|${normalizedZip}` : normalizedName;
}

function classifyBundleType(productNames: Iterable<string | null | undefined>): BundleType {
  const canonical = new Set<string>();
  for (const rawName of productNames) {
    const name = normalizeProductName(rawName);
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

  if (hasAuto && hasHome) return "Preferred";
  if (canonical.size >= 2) return "Standard";
  return "Monoline";
}

function buildCustomerBundleMap(sales: Array<{ customer_name?: string | null; customer_zip?: string | null; sale_policies?: Array<{ policy_type_name?: string | null; policy_type?: string | null }> | null }>): Map<string, BundleType> {
  const byCustomer = new Map<string, Set<string>>();

  for (const sale of sales) {
    const customerKey = buildCustomerKey(sale.customer_name, sale.customer_zip);
    if (!customerKey) continue;
    if (!byCustomer.has(customerKey)) byCustomer.set(customerKey, new Set());
    const products = byCustomer.get(customerKey)!;
    for (const policy of sale.sale_policies || []) {
      const name = normalizeProductName(policy.policy_type_name || policy.policy_type);
      if (!name || isExcludedProduct(name)) continue;
      products.add(name);
    }
  }

  const result = new Map<string, BundleType>();
  for (const [customerKey, products] of byCustomer.entries()) {
    result.set(customerKey, classifyBundleType(products));
  }
  return result;
}

function calculateCountableTotals(policies: SalePolicy[]): { premium: number; items: number; points: number; policyCount: number } {
  const countable = policies.filter(p => !isExcludedProduct(p.policy_type_name));
  return {
    premium: countable.reduce((sum, p) => sum + (p.total_premium || 0), 0),
    items: countable.reduce((sum, p) => sum + (p.total_items || 0), 0),
    points: countable.reduce((sum, p) => sum + (p.total_points || 0), 0),
    policyCount: countable.length,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const staffSession = req.headers.get("x-staff-session");
    console.log("[get_staff_sales_analytics] Staff session header:", staffSession ? "present" : "missing");

    if (!staffSession) {
      console.error("[get_staff_sales_analytics] No x-staff-session header found");
      return new Response(JSON.stringify({ error: "Missing staff session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin client to verify session
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify staff session - match get_staff_sales validation pattern
    const nowISO = new Date().toISOString();
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("staff_sessions")
      .select("staff_user_id, expires_at, is_valid")
      .eq("session_token", staffSession)
      .eq("is_valid", true)
      .gt("expires_at", nowISO)
      .maybeSingle();

    console.log("[get_staff_sales_analytics] Session lookup result:", session ? "found" : "not found");

    if (sessionError) {
      console.error("[get_staff_sales_analytics] Session query error:", sessionError);
      return new Response(JSON.stringify({ error: "Session validation failed" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!session) {
      console.error("[get_staff_sales_analytics] No valid session found for token");
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get staff user info
    const { data: staffUser, error: staffError } = await supabaseAdmin
      .from("staff_users")
      .select("agency_id")
      .eq("id", session.staff_user_id)
      .single();

    if (staffError || !staffUser) {
      console.error("[get_staff_sales_analytics] Staff user not found:", staffError);
      return new Response(JSON.stringify({ error: "Staff user not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const agencyId = staffUser.agency_id;
    const body = await req.json();
    const { type, start_date, end_date, business_filter = "all" } = body;

    console.log(`[get_staff_sales_analytics] Type: ${type}, Agency: ${agencyId}, Dates: ${start_date} - ${end_date}, Filter: ${business_filter}`);

    // Helper to apply business filter to a query
    const applyBusinessFilter = (query: any) => {
      if (business_filter === "regular") {
        return query.is("brokered_carrier_id", null);
      } else if (business_filter === "brokered") {
        return query.not("brokered_carrier_id", "is", null);
      }
      return query; // "all" - no filter
    };

    let result: unknown;

    switch (type) {
      case "drilldown": {
        const { filter_type, filter_value, page = 1, page_size = 10 } = body;
        console.log(`[get_staff_sales_analytics] Drilldown: ${filter_type}=${filter_value}, page=${page}`);

        let saleIds: string[] | null = null;

        // For policy_type, we need to find matching sale IDs first
        if (filter_type === 'policy_type') {
          const { data: saleItems } = await supabaseAdmin
            .from("sale_items")
            .select("sale_policy_id")
            .eq("product_type_name", filter_value);

          if (!saleItems || saleItems.length === 0) {
            result = { data: [], total_count: 0, page, page_size };
            break;
          }

          const salePolicyIds = [...new Set(saleItems.map((i: any) => i.sale_policy_id))];

          const { data: salePolicies } = await supabaseAdmin
            .from("sale_policies")
            .select("sale_id")
            .in("id", salePolicyIds);

          if (!salePolicies || salePolicies.length === 0) {
            result = { data: [], total_count: 0, page, page_size };
            break;
          }

          saleIds = [...new Set(salePolicies.map((p: any) => p.sale_id))];
        }

        if (filter_type === 'bundle_type') {
          let bundleQuery = supabaseAdmin
            .from("sales")
            .select("id, sale_date, customer_name, customer_zip, team_member_id, lead_source_id, brokered_carrier_id, sale_policies(id, policy_type_name, total_premium, total_items, total_points)")
            .eq("agency_id", agencyId)
            .gte("sale_date", start_date)
            .lte("sale_date", end_date)
            .order("sale_date", { ascending: false });

          bundleQuery = applyBusinessFilter(bundleQuery);
          const { data: bundleSales, error: bundleError } = await bundleQuery;
          if (bundleError) throw bundleError;

          const customerNames = Array.from(
            new Set(
              (bundleSales || [])
                .map((sale: any) => sale.customer_name?.trim())
                .filter((name: string | undefined): name is string => !!name)
            )
          );

          let historicalSales: any[] = [];
          if (customerNames.length > 0) {
            let historicalQuery = supabaseAdmin
              .from("sales")
              .select("customer_name, customer_zip, sale_policies(policy_type_name), brokered_carrier_id")
              .eq("agency_id", agencyId)
              .in("customer_name", customerNames);
            historicalQuery = applyBusinessFilter(historicalQuery);
            const { data: historicalData, error: historicalError } = await historicalQuery;
            if (historicalError) throw historicalError;
            historicalSales = historicalData || [];
          }

          const bundleMap = buildCustomerBundleMap(historicalSales);

          const filteredSales = (bundleSales || []).filter((sale: any) => {
            const customerKey = buildCustomerKey(sale.customer_name, sale.customer_zip);
            const effectiveBundle = bundleMap.get(customerKey) || "Monoline";
            return filter_value === "__all__" ? true : effectiveBundle === filter_value;
          });

          const groupedByHousehold = new Map<string, {
            id: string;
            sale_date: string;
            customer_name: string;
            lead_source_id: string | null;
            team_member_id: string | null;
            policy_types: Set<string>;
            total_items: number;
            total_premium: number;
            total_points: number;
          }>();

          for (const sale of filteredSales) {
            const customerKey = buildCustomerKey(sale.customer_name, sale.customer_zip);
            if (!customerKey) continue;

            const policies = sale.sale_policies || [];
            const countable = calculateCountableTotals(policies);

            const existing = groupedByHousehold.get(customerKey);
            if (!existing) {
              groupedByHousehold.set(customerKey, {
                id: sale.id,
                sale_date: sale.sale_date,
                customer_name: sale.customer_name || "Unknown",
                lead_source_id: sale.lead_source_id || null,
                team_member_id: sale.team_member_id || null,
                policy_types: new Set(
                  policies
                    .filter((p: any) => !isExcludedProduct(p.policy_type_name))
                    .map((p: any) => p.policy_type_name)
                    .filter(Boolean),
                ),
                total_items: countable.items,
                total_premium: countable.premium,
                total_points: countable.points,
              });
              continue;
            }

            if (sale.sale_date > existing.sale_date) {
              existing.id = sale.id;
              existing.sale_date = sale.sale_date;
              existing.lead_source_id = sale.lead_source_id || null;
              existing.team_member_id = sale.team_member_id || null;
            }

            for (const policy of policies) {
              if (!isExcludedProduct(policy.policy_type_name) && policy.policy_type_name) {
                existing.policy_types.add(policy.policy_type_name);
              }
            }
            existing.total_items += countable.items;
            existing.total_premium += countable.premium;
            existing.total_points += countable.points;
          }

          const householdRows = Array.from(groupedByHousehold.values()).sort((a, b) =>
            b.sale_date.localeCompare(a.sale_date)
          );
          const paged = householdRows.slice((page - 1) * page_size, page * page_size);

          const teamMemberIds = [...new Set(paged.map((s: any) => s.team_member_id).filter(Boolean))];
          const leadSourceIds = [...new Set(paged.map((s: any) => s.lead_source_id).filter(Boolean))];

          const teamMemberMap = new Map<string, string>();
          const leadSourceMap = new Map<string, string>();
          if (teamMemberIds.length > 0) {
            const { data: teamMembers } = await supabaseAdmin
              .from("team_members")
              .select("id, name")
              .in("id", teamMemberIds);
            for (const tm of teamMembers || []) teamMemberMap.set(tm.id, tm.name);
          }
          if (leadSourceIds.length > 0) {
            const { data: leadSources } = await supabaseAdmin
              .from("lead_sources")
              .select("id, name")
              .in("id", leadSourceIds);
            for (const ls of leadSources || []) leadSourceMap.set(ls.id, ls.name);
          }

          const records = paged.map((sale: any) => {
            return {
              id: sale.id,
              sale_date: sale.sale_date,
              customer_name: sale.customer_name || "Unknown",
              policy_types: Array.from(sale.policy_types).join(", ") || null,
              lead_source_name: sale.lead_source_id ? leadSourceMap.get(sale.lead_source_id) || null : null,
              producer_name: sale.team_member_id ? teamMemberMap.get(sale.team_member_id) || null : null,
              total_items: sale.total_items,
              total_premium: sale.total_premium,
              total_points: sale.total_points,
            };
          });

          result = { data: records, total_count: householdRows.length, page, page_size };
          break;
        }

        // Build query - now includes sale_policies for Motor Club filtering
        let query = supabaseAdmin
          .from("sales")
          .select("id, sale_date, customer_name, team_member_id, lead_source_id, brokered_carrier_id, sale_policies(id, policy_type_name, total_premium, total_items, total_points)", { count: 'exact' })
          .eq("agency_id", agencyId)
          .gte("sale_date", start_date)
          .lte("sale_date", end_date);

        // Apply business filter
        query = applyBusinessFilter(query);
        query = query.order("sale_date", { ascending: false });

        // Apply filter
        if (filter_type === 'date') {
          query = query.eq('sale_date', filter_value);
        } else if (filter_type === 'lead_source') {
          if (filter_value === 'Not Set') {
            query = query.is('lead_source_id', null);
          } else {
            const { data: leadSources } = await supabaseAdmin
              .from("lead_sources")
              .select("id")
              .eq("agency_id", agencyId)
              .eq("name", filter_value)
              .limit(1);
            
            if (leadSources && leadSources.length > 0) {
              query = query.eq('lead_source_id', leadSources[0].id);
            } else {
              result = { data: [], total_count: 0, page, page_size };
              break;
            }
          }
        } else if (filter_type === 'bundle_type') {
          if (filter_value === 'Monoline') {
            query = query.is('bundle_type', null);
          } else {
            query = query.eq('bundle_type', filter_value);
          }
        } else if (filter_type === 'zipcode') {
          query = query.eq('customer_zip', filter_value);
        } else if (filter_type === 'policy_type' && saleIds) {
          query = query.in('id', saleIds);
        }

        // Apply pagination
        const { data: sales, count, error: queryError } = await query
          .range((page - 1) * page_size, page * page_size - 1);

        if (queryError) throw queryError;

        // Get team member and lead source names
        const teamMemberIds = [...new Set((sales || []).map((s: any) => s.team_member_id).filter(Boolean))];
        const leadSourceIds = [...new Set((sales || []).map((s: any) => s.lead_source_id).filter(Boolean))];

        const teamMemberMap = new Map<string, string>();
        const leadSourceMap = new Map<string, string>();

        if (teamMemberIds.length > 0) {
          const { data: teamMembers } = await supabaseAdmin
            .from("team_members")
            .select("id, name")
            .in("id", teamMemberIds);
          for (const tm of teamMembers || []) {
            teamMemberMap.set(tm.id, tm.name);
          }
        }

        if (leadSourceIds.length > 0) {
          const { data: leadSources } = await supabaseAdmin
            .from("lead_sources")
            .select("id, name")
            .in("id", leadSourceIds);
          for (const ls of leadSources || []) {
            leadSourceMap.set(ls.id, ls.name);
          }
        }

        // Calculate filtered totals for each sale (excluding Motor Club)
        const records = (sales || []).map((sale: any) => {
          const policies = sale.sale_policies || [];
          const countable = calculateCountableTotals(policies);
          const policyTypes = policies
            .filter((p: any) => !isExcludedProduct(p.policy_type_name))
            .map((p: any) => p.policy_type_name)
            .filter((name: string | null | undefined) => !!name)
            .join(", ");
          return {
            id: sale.id,
            sale_date: sale.sale_date,
            customer_name: sale.customer_name || "Unknown",
            policy_types: policyTypes || null,
            lead_source_name: sale.lead_source_id ? leadSourceMap.get(sale.lead_source_id) || null : null,
            producer_name: sale.team_member_id ? teamMemberMap.get(sale.team_member_id) || null : null,
            total_items: countable.items,
            total_premium: countable.premium,
            total_points: countable.points,
          };
        });

        result = { data: records, total_count: count || 0, page, page_size };
        break;
      }

      case "by-date": {
        // Fetch with sale_policies for Motor Club filtering
        let byDateQuery = supabaseAdmin
          .from("sales")
          .select("sale_date, customer_name, customer_zip, brokered_carrier_id, sale_policies(id, policy_type_name, total_premium, total_items, total_points)")
          .eq("agency_id", agencyId)
          .gte("sale_date", start_date)
          .lte("sale_date", end_date);
        byDateQuery = applyBusinessFilter(byDateQuery);
        const { data: sales, error } = await byDateQuery.order("sale_date");

        if (error) throw error;

        // Group by date with Motor Club excluded
        const grouped: Record<string, { sale_date: string; items: number; premium: number; points: number; policies: number; households: Set<string> }> = {};
        
        for (const sale of sales || []) {
          const date = sale.sale_date;
          if (!grouped[date]) {
            grouped[date] = { sale_date: date, items: 0, premium: 0, points: 0, policies: 0, households: new Set() };
          }
          
          const countable = calculateCountableTotals(sale.sale_policies || []);
          grouped[date].items += countable.items;
          grouped[date].premium += countable.premium;
          grouped[date].points += countable.points;
          grouped[date].policies += countable.policyCount;
          const customerKey = buildCustomerKey(sale.customer_name, sale.customer_zip);
          if (customerKey) {
            grouped[date].households.add(customerKey);
          }
        }

        result = Object.values(grouped).map((row) => ({
          sale_date: row.sale_date,
          items: row.items,
          premium: row.premium,
          points: row.points,
          policies: row.policies,
          households: row.households.size,
        }));
        break;
      }

      case "by-policy-type": {
        // Get sales IDs
        let policyTypeQuery = supabaseAdmin
          .from("sales")
          .select("id, brokered_carrier_id")
          .eq("agency_id", agencyId)
          .gte("sale_date", start_date)
          .lte("sale_date", end_date);
        policyTypeQuery = applyBusinessFilter(policyTypeQuery);
        const { data: salesData, error: salesError } = await policyTypeQuery;

        if (salesError) throw salesError;
        const saleIds = (salesData || []).map((s) => s.id);
        
        if (saleIds.length === 0) {
          result = [];
          break;
        }

        // Get sale_policies
        const { data: policies, error: policiesError } = await supabaseAdmin
          .from("sale_policies")
          .select("id")
          .in("sale_id", saleIds);

        if (policiesError) throw policiesError;
        const policyIds = (policies || []).map((p) => p.id);

        if (policyIds.length === 0) {
          result = [];
          break;
        }

        // Get sale_items
        const { data: items, error: itemsError } = await supabaseAdmin
          .from("sale_items")
          .select("item_count, premium, points, product_type_id, product_type_name")
          .in("sale_policy_id", policyIds);

        if (itemsError) throw itemsError;

        // Get product types
        const { data: productTypes } = await supabaseAdmin
          .from("product_types")
          .select("id, name")
          .eq("agency_id", agencyId);

        const ptMap = new Map((productTypes || []).map((pt) => [pt.id, pt.name]));

        // Group by product type, excluding Motor Club
        const grouped: Record<string, { policy_type: string; items: number; premium: number; points: number }> = {};
        
        for (const item of items || []) {
          const typeName = item.product_type_id 
            ? (ptMap.get(item.product_type_id) || item.product_type_name || "Unknown")
            : (item.product_type_name || "Unknown");
          
          // Skip excluded products (Motor Club)
          if (isExcludedProduct(typeName)) continue;
          
          if (!grouped[typeName]) {
            grouped[typeName] = { policy_type: typeName, items: 0, premium: 0, points: 0 };
          }
          grouped[typeName].items += item.item_count || 0;
          grouped[typeName].premium += item.premium || 0;
          grouped[typeName].points += item.points || 0;
        }

        result = Object.values(grouped).sort((a, b) => b.items - a.items);
        break;
      }

      case "by-source": {
        // Fetch with sale_policies for Motor Club filtering
        let bySourceQuery = supabaseAdmin
          .from("sales")
          .select("id, customer_name, customer_zip, lead_source_id, brokered_carrier_id, sale_policies(id, policy_type_name, total_premium, total_items, total_points)")
          .eq("agency_id", agencyId)
          .gte("sale_date", start_date)
          .lte("sale_date", end_date);
        bySourceQuery = applyBusinessFilter(bySourceQuery);
        const { data: sales, error } = await bySourceQuery;

        if (error) throw error;

        const { data: leadSources } = await supabaseAdmin
          .from("lead_sources")
          .select("id, name")
          .eq("agency_id", agencyId);

        const sourceMap = new Map((leadSources || []).map((ls) => [ls.id, ls.name]));

        // Group by lead source with Motor Club excluded
        const grouped: Record<string, { lead_source: string; items: number; premium: number; policies: number; households: Set<string> }> = {};
        
        for (const sale of sales || []) {
          const sourceId = sale.lead_source_id;
          const sourceName = sourceId ? (sourceMap.get(sourceId) || "Unknown") : "Not Set";
          
          if (!grouped[sourceName]) {
            grouped[sourceName] = { lead_source: sourceName, items: 0, premium: 0, policies: 0, households: new Set() };
          }
          
          const countable = calculateCountableTotals(sale.sale_policies || []);
          grouped[sourceName].items += countable.items;
          grouped[sourceName].premium += countable.premium;
          grouped[sourceName].policies += countable.policyCount;
          const customerKey = buildCustomerKey(sale.customer_name, sale.customer_zip);
          if (customerKey) {
            grouped[sourceName].households.add(customerKey);
          }
        }

        result = Object.values(grouped)
          .map((row) => ({
            lead_source: row.lead_source,
            items: row.items,
            premium: row.premium,
            policies: row.policies,
            households: row.households.size,
          }))
          .sort((a, b) => b.items - a.items);
        break;
      }

      case "by-bundle": {
        // Fetch with sale_policies for Motor Club filtering
        let byBundleQuery = supabaseAdmin
          .from("sales")
          .select("bundle_type, customer_name, customer_zip, brokered_carrier_id, sale_policies(id, policy_type_name, total_premium, total_items, total_points)")
          .eq("agency_id", agencyId)
          .gte("sale_date", start_date)
          .lte("sale_date", end_date);
        byBundleQuery = applyBusinessFilter(byBundleQuery);
        const { data: sales, error } = await byBundleQuery;

        if (error) throw error;

        const periodSales = sales || [];
        const customerNames = Array.from(
          new Set(
            periodSales
              .map((sale) => sale.customer_name?.trim())
              .filter((name): name is string => !!name)
          )
        );

        let historicalSales = periodSales;
        if (customerNames.length > 0) {
          let historicalQuery = supabaseAdmin
            .from("sales")
            .select("customer_name, customer_zip, sale_policies(policy_type_name), brokered_carrier_id")
            .eq("agency_id", agencyId)
            .in("customer_name", customerNames);
          historicalQuery = applyBusinessFilter(historicalQuery);
          const { data: historicalData, error: historicalError } = await historicalQuery;
          if (historicalError) throw historicalError;
          historicalSales = (historicalData || []) as unknown as typeof periodSales;
        }

        const customerBundleMap = buildCustomerBundleMap(historicalSales);

        // Aggregate everything by customer's best bundle type so items/premium/households stay consistent
        const grouped: Record<string, { bundle_type: string; items: number; premium: number; households: Set<string> }> = {};

        for (const sale of periodSales) {
          const customerKey = buildCustomerKey(sale.customer_name, sale.customer_zip);
          const bestType = customerKey ? (customerBundleMap.get(customerKey) || "Monoline") : "Monoline";

          if (!grouped[bestType]) {
            grouped[bestType] = { bundle_type: bestType, items: 0, premium: 0, households: new Set() };
          }

          const countable = calculateCountableTotals(sale.sale_policies || []);
          grouped[bestType].items += countable.items;
          grouped[bestType].premium += countable.premium;
          if (customerKey) {
            grouped[bestType].households.add(customerKey);
          }
        }

        const BUNDLE_ORDER = ["Preferred", "Standard", "Monoline"];
        result = BUNDLE_ORDER
          .filter((bt) => grouped[bt])
          .map((bt) => ({
            bundle_type: bt,
            items: grouped[bt].items,
            premium: grouped[bt].premium,
            households: grouped[bt].households.size,
          }));
        break;
      }

      case "by-zipcode": {
        // Fetch with sale_policies for Motor Club filtering
        let byZipQuery = supabaseAdmin
          .from("sales")
          .select("customer_zip, customer_name, brokered_carrier_id, sale_policies(id, policy_type_name, total_premium, total_items, total_points)")
          .eq("agency_id", agencyId)
          .gte("sale_date", start_date)
          .lte("sale_date", end_date)
          .not("customer_zip", "is", null);
        byZipQuery = applyBusinessFilter(byZipQuery);
        const { data: sales, error } = await byZipQuery;

        if (error) throw error;

        const grouped: Record<string, { zipcode: string; items: number; premium: number; households: Set<string> }> = {};
        
        for (const sale of sales || []) {
          const zip = sale.customer_zip?.trim();
          if (!zip) continue;
          
          if (!grouped[zip]) {
            grouped[zip] = { zipcode: zip, items: 0, premium: 0, households: new Set() };
          }
          
          const countable = calculateCountableTotals(sale.sale_policies || []);
          grouped[zip].items += countable.items;
          grouped[zip].premium += countable.premium;
          const customerKey = buildCustomerKey(sale.customer_name, sale.customer_zip);
          if (customerKey) {
            grouped[zip].households.add(customerKey);
          }
        }

        result = Object.values(grouped)
          .map((row) => ({
            zipcode: row.zipcode,
            items: row.items,
            premium: row.premium,
            households: row.households.size,
          }))
          .sort((a, b) => b.items - a.items)
          .slice(0, 15);
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    console.log(`[get_staff_sales_analytics] Returning ${Array.isArray(result) ? result.length : 'object'} records`);

    return new Response(JSON.stringify(type === "drilldown" ? result : { data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[get_staff_sales_analytics] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
