import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface SearchQuery {
  page?: number;
  pageSize?: number;
  query?: string;
  start?: string;         // YYYY-MM-DD
  end?: string;           // YYYY-MM-DD
  staffId?: string;
  leadSource?: string;
  finalOnly?: boolean;    // default true
  includeSuperseded?: boolean; // default false
  lateOnly?: boolean;     // default false
}

function jsonResponse(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const errorId = crypto.randomUUID();
  let userId: string | null = null;
  let agencyId: string | null = null;

  try {
    // Log request start
    console.log("EXPLORER_FEED_V1_START", { errorId, timestamp: new Date().toISOString() });

    if (req.method !== "POST") {
      return jsonResponse(405, { error: "METHOD_NOT_ALLOWED" });
    }

    // Parse and validate request body
    let body: SearchQuery;
    try {
      body = await req.json() as SearchQuery;
    } catch (parseError) {
      console.log("EXPLORER_FEED_V1_ERR", { errorId, error: "Invalid JSON", message: String(parseError) });
      return jsonResponse(400, { error: "invalid_json" });
    }

    const page = Math.max(1, body.page || 1);
    const pageSize = Math.max(1, Math.min(body.pageSize || 10, 100));

    // Extract JWT token and validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("EXPLORER_FEED_V1_ERR", { errorId, error: "Missing or invalid auth header" });
      return jsonResponse(401, { error: "unauthorized" });
    }

    const token = authHeader.slice(7);
    
    // Create authenticated Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    // Set auth token
    await supabase.auth.setSession({ access_token: token, refresh_token: "" });

    // Get user from token
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      console.log("EXPLORER_FEED_V1_ERR", { errorId, error: "Invalid token", message: userError?.message });
      return jsonResponse(401, { error: "unauthorized" });
    }

    userId = userData.user.id;

    // Get user's agency_id from profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("agency_id, role")
      .eq("id", userId)
      .single();

    if (profileError || !profile?.agency_id) {
      console.log("EXPLORER_FEED_V1_ERR", { errorId, userId, error: "No agency found for user", message: profileError?.message });
      return jsonResponse(400, { error: "missing_agency" });
    }

    agencyId = profile.agency_id;
    console.log("EXPLORER_FEED_V1_START", { errorId, userId, agencyId, page, pageSize });

    // Calculate offset for pagination
    const offset = (page - 1) * pageSize;

    // Build query - simplified single query with joins
    const queryStartTime = Date.now();
    let query = supabase
      .from("quoted_household_details")
      .select(`
        id,
        submission_id,
        created_at,
        household_name,
        zip_code,
        items_quoted,
        policies_quoted,
        premium_potential_cents,
        lead_source_id,
        submissions!inner(
          work_date,
          team_member_id,
          form_template_id,
          final,
          late,
          form_templates!inner(agency_id)
        ),
        lead_sources(name),
        prospect_overrides(
          prospect_name,
          email,
          phone,
          zip,
          notes,
          items_quoted,
          policies_quoted,
          premium_potential_cents,
          lead_source_id,
          lead_source_raw,
          lead_sources(name)
        ),
        prospect_custom_field_values(
          field_id,
          value_text,
          prospect_custom_fields(
            field_key,
            field_label,
            field_type
          )
        )
      `, { count: 'exact' })
      .eq("submissions.form_templates.agency_id", agencyId);

    // Apply filters
    if (body.start) {
      query = query.gte("submissions.work_date", body.start);
    }
    if (body.end) {
      query = query.lte("submissions.work_date", body.end);
    }
    if (body.staffId) {
      query = query.eq("submissions.team_member_id", body.staffId);
    }
    if (body.lateOnly) {
      query = query.eq("submissions.late", true);
    }

    // Final/superseded logic
    const finalOnly = body.finalOnly ?? true;
    if (finalOnly) {
      query = query.eq("submissions.final", true);
    } else if (body.includeSuperseded === false) {
      query = query.eq("submissions.final", true);
    }

    // Order, limit and pagination
    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data: rawRows, error, count } = await query;

    const queryDuration = Date.now() - queryStartTime;
    
    if (error) {
      console.log("EXPLORER_FEED_V1_ERR", { 
        errorId, 
        userId, 
        agencyId, 
        error: "Database error", 
        message: error.message,
        duration: queryDuration
      });
      return jsonResponse(500, { error: error.message });
    }

    console.log("Query completed", { 
      errorId,
      userId, 
      agencyId, 
      duration: queryDuration, 
      rowCount: rawRows?.length || 0,
      totalCount: count 
    });

    // Process and merge the data with COALESCE logic
    let processedRows = (rawRows || []).map((row: any) => {
      const override = row.prospect_overrides?.[0]; // First override if exists
      const originalLeadSource = row.lead_sources?.name;
      const overrideLeadSource = override?.lead_sources?.name;
      
      // Process custom fields
      const customFields = (row.prospect_custom_field_values || []).reduce((acc: any, cfv: any) => {
        if (cfv.prospect_custom_fields) {
          acc[cfv.prospect_custom_fields.field_key] = {
            label: cfv.prospect_custom_fields.field_label,
            type: cfv.prospect_custom_fields.field_type,
            value: cfv.value_text
          };
        }
        return acc;
      }, {});
      
      return {
        id: row.id,
        created_at: row.created_at,
        prospect_name: override?.prospect_name || row.household_name,
        zip: override?.zip || row.zip_code || "",
        lead_source_label: override?.lead_source_raw || overrideLeadSource || originalLeadSource || "Undefined",
        notes: override?.notes || "",
        items_quoted: override?.items_quoted ?? row.items_quoted ?? 0,
        policies_quoted: override?.policies_quoted ?? row.policies_quoted ?? 0,
        premium_potential_cents: override?.premium_potential_cents ?? row.premium_potential_cents ?? 0,
        status: row.submissions?.final ? "final" : "draft",
        email: override?.email || "",
        phone: override?.phone || "",
        custom_fields: customFields
      };
    });

    // Apply search filtering post-processing
    if (body.query && body.query.trim().length) {
      const searchTerm = body.query.trim();
      
      if (searchTerm.toLowerCase() === 'undefined') {
        // Filter for "Undefined" lead sources
        processedRows = processedRows.filter(row => row.lead_source_label === "Undefined");
      } else {
        // General search across multiple fields
        const fuzzyTerm = searchTerm.toLowerCase();
        processedRows = processedRows.filter(row => 
          (row.prospect_name || "").toLowerCase().includes(fuzzyTerm) ||
          (row.email || "").toLowerCase().includes(fuzzyTerm) ||
          (row.phone || "").toLowerCase().includes(fuzzyTerm) ||
          (row.zip || "").toLowerCase().includes(fuzzyTerm) ||
          (row.notes || "").toLowerCase().includes(fuzzyTerm) ||
          (row.lead_source_label || "").toLowerCase().includes(fuzzyTerm)
        );
      }
    }

    // Apply lead source filter
    if (body.leadSource) {
      processedRows = processedRows.filter(row => row.lead_source_label === body.leadSource);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    console.log("EXPLORER_FEED_V1_SUCCESS", { 
      errorId, 
      userId, 
      agencyId, 
      page, 
      pageSize, 
      total, 
      returned: processedRows.length 
    });

    return jsonResponse(200, {
      rows: processedRows,
      page,
      pageSize,
      total
    });

  } catch (error) {
    console.log("EXPLORER_FEED_V1_ERR", { 
      errorId, 
      userId, 
      agencyId, 
      error: "Unhandled exception", 
      message: String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Never leak stack traces or internal details
    return jsonResponse(500, { 
      error: "internal_server_error",
      error_id: errorId
    });
  }
});