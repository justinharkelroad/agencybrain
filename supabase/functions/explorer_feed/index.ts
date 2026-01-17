import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyRequest, isVerifyError } from "../_shared/verifyRequest.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify request using dual-mode auth (Supabase JWT or Staff session)
    const authResult = await verifyRequest(req);
    
    if (isVerifyError(authResult)) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { 
          status: authResult.status, 
          headers: { ...corsHeaders, "content-type": "application/json" }
        }
      );
    }

    // Create service role client for database queries
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const { 
      agency_slug, start, end, query, staffId, leadSource, 
      page = 1, pageSize = 50,
      sortBy = "created_at", 
      sortOrder = "desc",
      recordType = "all" // "all" | "prospect" | "customer"
    } = body;

    // Use authenticated user's agency ID
    const agencyId = authResult.agencyId;

    // If agency_slug provided, verify it matches
    if (agency_slug) {
      const { data: ag } = await sb.from("agencies").select("id").eq("slug", agency_slug).single();
      if (ag && ag.id !== agencyId) {
        return new Response(
          JSON.stringify({ error: "Access denied to this agency" }), 
          { 
            status: 403, 
            headers: { ...corsHeaders, "content-type": "application/json" }
          }
        );
      }
    }

    // Valid sort fields for each record type
    const VALID_SORT_FIELDS = [
      "created_at",
      "work_date",
      "household_name",
      "items_quoted",
      "policies_quoted",
      "premium_potential_cents"
    ];
    
    const sortField = VALID_SORT_FIELDS.includes(sortBy) ? sortBy : "created_at";
    const ascending = sortOrder === "asc";
    
    console.log(`Explorer [${authResult.mode}]: recordType=${recordType}, sort=${sortField}/${sortOrder}`);

    let prospects: any[] = [];
    let customers: any[] = [];
    let prospectCount = 0;
    let customerCount = 0;

    // Query prospects (quoted_household_details)
    if (recordType === "all" || recordType === "prospect") {
      let prospectQuery = sb
        .from("quoted_household_details")
        .select(`
          id,
          submission_id,
          created_at,
          work_date,
          household_name,
          lead_source_label,
          zip_code,
          extras,
          items_quoted,
          policies_quoted,
          premium_potential_cents,
          submissions!inner(
            form_template_id,
            team_member_id,
            team_members(name),
            form_templates!inner(agency_id)
          )
        `, { count: 'exact' })
        .eq("submissions.form_templates.agency_id", agencyId);

      // Apply filters
      if (start) prospectQuery = prospectQuery.gte("created_at", start + "T00:00:00");
      if (end) prospectQuery = prospectQuery.lte("created_at", end + "T23:59:59");
      if (query) prospectQuery = prospectQuery.ilike("household_name", `%${query}%`);

      // Apply sorting
      prospectQuery = prospectQuery.order(sortField, { ascending });
      if (sortField !== "created_at") {
        prospectQuery = prospectQuery.order("created_at", { ascending: false });
      }

      const { data: prospectData, count: pCount, error: prospectError } = await prospectQuery;
      
      if (prospectError) {
        console.error("Prospect query error:", prospectError);
      } else {
        prospects = (prospectData || []).map((row: any) => ({
          id: row.id,
          submission_id: row.submission_id,
          form_template_id: row.submissions?.form_template_id,
          team_member_id: row.submissions?.team_member_id,
          work_date: row.work_date,
          created_at: row.created_at,
          prospect_name: row.household_name,
          staff_member_name: row.submissions?.team_members?.name,
          lead_source_label: row.lead_source_label || "Undefined",
          zip: row.zip_code || null,
          notes: row.extras?.detailed_notes || row.extras?.notes || null,
          custom_fields: row.extras?.custom_fields || {},
          items_quoted: row.items_quoted,
          policies_quoted: row.policies_quoted,
          premium_potential_cents: row.premium_potential_cents,
          record_type: "prospect"
        }));
        prospectCount = pCount || 0;
      }
    }

    // Query customers (sold_policy_details)
    if (recordType === "all" || recordType === "customer") {
      let customerQuery = sb
        .from("sold_policy_details")
        .select(`
          id,
          submission_id,
          created_at,
          policy_holder_name,
          policy_type,
          premium_amount_cents,
          lead_source_id,
          extras,
          submissions!inner(
            form_template_id,
            team_member_id,
            work_date,
            team_members(name),
            form_templates!inner(agency_id)
          )
        `, { count: 'exact' })
        .eq("submissions.form_templates.agency_id", agencyId);

      // Apply filters - use created_at for sold_policy_details
      if (start) customerQuery = customerQuery.gte("created_at", start + "T00:00:00");
      if (end) customerQuery = customerQuery.lte("created_at", end + "T23:59:59");
      if (query) customerQuery = customerQuery.ilike("policy_holder_name", `%${query}%`);

      // Apply sorting - map fields for sold_policy_details
      const customerSortField = sortField === "household_name" ? "policy_holder_name" 
        : sortField === "premium_potential_cents" ? "premium_amount_cents"
        : sortField;
      
      // Only sort by valid fields for this table
      const validCustomerSort = ["created_at", "policy_holder_name", "premium_amount_cents"].includes(customerSortField);
      if (validCustomerSort) {
        customerQuery = customerQuery.order(customerSortField, { ascending });
      } else {
        customerQuery = customerQuery.order("created_at", { ascending: false });
      }

      const { data: customerData, count: cCount, error: customerError } = await customerQuery;
      
      if (customerError) {
        console.error("Customer query error:", customerError);
      } else {
        // Get lead source names for lookup
        const { data: leadSourcesData } = await sb
          .from("lead_sources")
          .select("id, name")
          .eq("agency_id", agencyId);
        
        const leadSourceMap = new Map((leadSourcesData || []).map(ls => [ls.id, ls.name]));

        customers = (customerData || []).map((row: any) => ({
          id: row.id,
          submission_id: row.submission_id,
          form_template_id: row.submissions?.form_template_id,
          team_member_id: row.submissions?.team_member_id,
          work_date: row.submissions?.work_date || row.extras?.work_date,
          created_at: row.created_at,
          prospect_name: row.policy_holder_name,
          staff_member_name: row.submissions?.team_members?.name,
          lead_source_label: row.lead_source_id 
            ? (leadSourceMap.get(row.lead_source_id) || row.extras?.lead_source_label || "Undefined")
            : (row.extras?.lead_source_label || "Undefined"),
          zip: row.extras?.zip_code || null,
          notes: row.extras?.detailed_notes || row.extras?.notes || null,
          custom_fields: row.extras?.custom_fields || {},
          items_quoted: null, // Not applicable for sold
          policies_quoted: null, // Not applicable for sold
          premium_potential_cents: row.premium_amount_cents,
          policy_type: row.policy_type, // Array of policy types
          record_type: "customer"
        }));
        customerCount = cCount || 0;
      }
    }

    // Combine and sort results
    let combinedRows = [...prospects, ...customers];
    
    // Sort combined results by the selected field
    combinedRows.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortField) {
        case "created_at":
        case "work_date":
          aVal = a[sortField] || "";
          bVal = b[sortField] || "";
          break;
        case "household_name":
          aVal = a.prospect_name || "";
          bVal = b.prospect_name || "";
          break;
        case "premium_potential_cents":
          aVal = a.premium_potential_cents || 0;
          bVal = b.premium_potential_cents || 0;
          break;
        default:
          aVal = a[sortField] ?? 0;
          bVal = b[sortField] ?? 0;
      }
      
      if (typeof aVal === "string") {
        return ascending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return ascending ? aVal - bVal : bVal - aVal;
    });

    // Apply pagination to combined results
    const totalCount = prospectCount + customerCount;
    const offset = (page - 1) * pageSize;
    const paginatedRows = combinedRows.slice(offset, offset + pageSize);

    return new Response(
      JSON.stringify({ 
        rows: paginatedRows,
        page,
        pageSize,
        total: totalCount,
        prospectCount,
        customerCount
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, "content-type": "application/json" }
      }
    );

  } catch (error) {
    console.error("Explorer feed error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, "content-type": "application/json" }
      }
    );
  }
});
