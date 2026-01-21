import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { type, start_date, end_date } = body;

    console.log(`[get_staff_sales_analytics] Type: ${type}, Agency: ${agencyId}, Dates: ${start_date} - ${end_date}`);

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

        // Build query - now includes sale_policies for Motor Club filtering
        let query = supabaseAdmin
          .from("sales")
          .select("id, sale_date, customer_name, team_member_id, lead_source_id, sale_policies(id, policy_type_name, total_premium, total_items, total_points)", { count: 'exact' })
          .eq("agency_id", agencyId)
          .gte("sale_date", start_date)
          .lte("sale_date", end_date)
          .order("sale_date", { ascending: false });

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
          const countable = calculateCountableTotals(sale.sale_policies || []);
          return {
            id: sale.id,
            sale_date: sale.sale_date,
            customer_name: sale.customer_name || "Unknown",
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
        const { data: sales, error } = await supabaseAdmin
          .from("sales")
          .select("sale_date, customer_name, sale_policies(id, policy_type_name, total_premium, total_items, total_points)")
          .eq("agency_id", agencyId)
          .gte("sale_date", start_date)
          .lte("sale_date", end_date)
          .order("sale_date");

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
          if (sale.customer_name) {
            grouped[date].households.add(sale.customer_name.toLowerCase().trim());
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
        const { data: salesData, error: salesError } = await supabaseAdmin
          .from("sales")
          .select("id")
          .eq("agency_id", agencyId)
          .gte("sale_date", start_date)
          .lte("sale_date", end_date);

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
        const { data: sales, error } = await supabaseAdmin
          .from("sales")
          .select("id, customer_name, lead_source_id, sale_policies(id, policy_type_name, total_premium, total_items, total_points)")
          .eq("agency_id", agencyId)
          .gte("sale_date", start_date)
          .lte("sale_date", end_date);

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
          if (sale.customer_name) {
            grouped[sourceName].households.add(sale.customer_name.toLowerCase().trim());
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
        const { data: sales, error } = await supabaseAdmin
          .from("sales")
          .select("bundle_type, customer_name, sale_policies(id, policy_type_name, total_premium, total_items, total_points)")
          .eq("agency_id", agencyId)
          .gte("sale_date", start_date)
          .lte("sale_date", end_date);

        if (error) throw error;

        const grouped: Record<string, { bundle_type: string; items: number; premium: number; households: Set<string> }> = {};
        
        for (const sale of sales || []) {
          const bundleType = sale.bundle_type || "Monoline";
          
          if (!grouped[bundleType]) {
            grouped[bundleType] = { bundle_type: bundleType, items: 0, premium: 0, households: new Set() };
          }
          
          const countable = calculateCountableTotals(sale.sale_policies || []);
          grouped[bundleType].items += countable.items;
          grouped[bundleType].premium += countable.premium;
          if (sale.customer_name) {
            grouped[bundleType].households.add(sale.customer_name.toLowerCase().trim());
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
        const { data: sales, error } = await supabaseAdmin
          .from("sales")
          .select("customer_zip, customer_name, sale_policies(id, policy_type_name, total_premium, total_items, total_points)")
          .eq("agency_id", agencyId)
          .gte("sale_date", start_date)
          .lte("sale_date", end_date)
          .not("customer_zip", "is", null);

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
          if (sale.customer_name) {
            grouped[zip].households.add(sale.customer_name.toLowerCase().trim());
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
