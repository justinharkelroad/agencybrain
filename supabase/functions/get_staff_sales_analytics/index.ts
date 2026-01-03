import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-staff-session",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const staffSession = req.headers.get("x-staff-session");
    if (!staffSession) {
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

    // Verify staff session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("staff_sessions")
      .select("staff_user_id, expires_at")
      .eq("session_token", staffSession)
      .single();

    if (sessionError || !session) {
      console.error("[get_staff_sales_analytics] Session not found:", sessionError);
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(session.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Session expired" }), {
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
    const { type, start_date, end_date } = await req.json();

    console.log(`[get_staff_sales_analytics] Type: ${type}, Agency: ${agencyId}, Dates: ${start_date} - ${end_date}`);

    let result: unknown;

    switch (type) {
      case "by-date": {
        const { data: sales, error } = await supabaseAdmin
          .from("sales")
          .select("sale_date, total_items, total_premium, total_points, customer_name")
          .eq("agency_id", agencyId)
          .gte("sale_date", start_date)
          .lte("sale_date", end_date)
          .order("sale_date");

        if (error) throw error;

        // Group by date
        const grouped: Record<string, { sale_date: string; items: number; premium: number; points: number; policies: number; households: Set<string> }> = {};
        
        for (const sale of sales || []) {
          const date = sale.sale_date;
          if (!grouped[date]) {
            grouped[date] = { sale_date: date, items: 0, premium: 0, points: 0, policies: 0, households: new Set() };
          }
          grouped[date].items += sale.total_items || 0;
          grouped[date].premium += sale.total_premium || 0;
          grouped[date].points += sale.total_points || 0;
          grouped[date].policies += 1;
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

        // Group by product type
        const grouped: Record<string, { policy_type: string; items: number; premium: number; points: number }> = {};
        
        for (const item of items || []) {
          const typeName = item.product_type_id 
            ? (ptMap.get(item.product_type_id) || item.product_type_name || "Unknown")
            : (item.product_type_name || "Unknown");
          
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
        const { data: sales, error } = await supabaseAdmin
          .from("sales")
          .select("id, total_items, total_premium, customer_name, lead_source_id")
          .eq("agency_id", agencyId)
          .gte("sale_date", start_date)
          .lte("sale_date", end_date);

        if (error) throw error;

        const { data: leadSources } = await supabaseAdmin
          .from("lead_sources")
          .select("id, name")
          .eq("agency_id", agencyId);

        const sourceMap = new Map((leadSources || []).map((ls) => [ls.id, ls.name]));

        // Group by lead source
        const grouped: Record<string, { lead_source: string; items: number; premium: number; policies: number; households: Set<string> }> = {};
        
        for (const sale of sales || []) {
          const sourceId = sale.lead_source_id;
          const sourceName = sourceId ? (sourceMap.get(sourceId) || "Unknown") : "Not Set";
          
          if (!grouped[sourceName]) {
            grouped[sourceName] = { lead_source: sourceName, items: 0, premium: 0, policies: 0, households: new Set() };
          }
          grouped[sourceName].items += sale.total_items || 0;
          grouped[sourceName].premium += sale.total_premium || 0;
          grouped[sourceName].policies += 1;
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
        const { data: sales, error } = await supabaseAdmin
          .from("sales")
          .select("bundle_type, total_items, total_premium, customer_name")
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
          grouped[bundleType].items += sale.total_items || 0;
          grouped[bundleType].premium += sale.total_premium || 0;
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
        const { data: sales, error } = await supabaseAdmin
          .from("sales")
          .select("customer_zip, total_items, total_premium, customer_name")
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
          grouped[zip].items += sale.total_items || 0;
          grouped[zip].premium += sale.total_premium || 0;
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

    console.log(`[get_staff_sales_analytics] Returning ${Array.isArray(result) ? result.length : 0} records`);

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[get_staff_sales_analytics] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
