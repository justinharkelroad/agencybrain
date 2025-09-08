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

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  const errorId = crypto.randomUUID();
  let userId: string | null = null;
  let agencyId: string | null = null;

  try {
    // DEPLOYMENT VERIFICATION - NEW VERSION WITH FIXES
    console.log("DEPLOYMENT_SUCCESS: explorer_feed version 2025-01-08-v4 - TEAM MEMBERS AND NOTES FIX ACTIVE");
    console.log("FEED_V1_START", { errorId, timestamp: new Date().toISOString() });

    if (req.method !== "POST") {
      return json(405, { error: "METHOD_NOT_ALLOWED" });
    }

    // Read and validate Bearer token
    const auth = req.headers.get("authorization") || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!bearer) return json(401, { error: "unauthorized" });

    // Parse and validate request body
    let body: SearchQuery;
    try {
      body = await req.json() as SearchQuery;
    } catch (parseError) {
      console.log("FEED_V1_ERR", { errorId, error: "Invalid JSON", message: String(parseError) });
      return json(400, { error: "invalid_json" });
    }

    const page = Math.max(1, body.page || 1);
    const pageSize = Math.max(1, Math.min(body.pageSize || 10, 100));

    // Create Supabase client with user's JWT attached
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,        // anon key, not service role
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${bearer}` } }, // critical
      }
    );

    // Get user from token
    const { data: { user }, error: uerr } = await supabase.auth.getUser();
    if (uerr || !user) {
      console.log("FEED_V1_ERR", { errorId, error: "Invalid token", message: uerr?.message });
      return json(401, { error: "unauthorized" });
    }

    userId = user.id;

    // Get user's agency_id from profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("agency_id, role")
      .eq("id", userId)
      .single();

    if (profileError || !profile?.agency_id) {
      console.log("FEED_V1_ERR", { errorId, userId, error: "No agency found for user", message: profileError?.message });
      return json(400, { error: "missing_agency" });
    }

    agencyId = profile.agency_id;
    console.log("FEED_V1_START", { errorId, userId, agencyId, page, pageSize });

    // Calculate offset for pagination
    const offset = (page - 1) * pageSize;

    // Build query - simplified single query with joins including team_members
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
          form_templates!inner(agency_id),
          quoted_households!inner(
            household_name,
            notes,
            lead_source
          ),
          team_members(
            name
          )
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
      console.log("FEED_V1_ERR", { 
        errorId, 
        userId, 
        agencyId, 
        error: "Database error", 
        message: error.message,
        duration: queryDuration
      });
      return json(500, { error: error.message });
    }

    console.log("Query completed", { 
      errorId,
      userId, 
      agencyId, 
      duration: queryDuration, 
      rowCount: rawRows?.length || 0,
      totalCount: count 
    });

    // DEBUG: Log first raw row structure to understand PostgREST response
    if (rawRows && rawRows.length > 0) {
      console.log("DEBUG_RAW_ROW_STRUCTURE", { 
        errorId,
        firstRow: {
          id: rawRows[0].id,
          household_name: rawRows[0].household_name,
          submissions: rawRows[0].submissions ? {
            team_member_id: rawRows[0].submissions.team_member_id,
            work_date: rawRows[0].submissions.work_date,
            team_members: rawRows[0].submissions.team_members,
            quoted_households: rawRows[0].submissions.quoted_households
          } : null
        }
      });
    }

    // Process and merge the data with COALESCE logic
    let processedRows = (rawRows || []).map((row: any) => {
      // Get data with flexible access pattern for PostgREST response
      const override = row.prospect_overrides?.[0]; // First override if exists
      const originalLeadSource = row.lead_sources?.name;
      const overrideLeadSource = override?.lead_sources?.name;
      
      // Handle team_members - can be object or array depending on PostgREST structure
      const teamMemberData = row.submissions?.team_members;
      const teamMember = Array.isArray(teamMemberData) ? teamMemberData[0] : teamMemberData;
      
      // Handle quoted_households - can be object or array depending on PostgREST structure  
      const quotedHouseholdData = row.submissions?.quoted_households;
      const quotedHousehold = Array.isArray(quotedHouseholdData) ? quotedHouseholdData[0] : quotedHouseholdData;
      
      // DEBUG: Comprehensive logging for team member data
      console.log("DEBUG_TEAM_MEMBER_DATA", {
        errorId,
        household: row.household_name,
        team_member_id: row.submissions?.team_member_id,
        team_members_raw: teamMemberData,
        team_member_processed: teamMember,
        team_member_name: teamMember?.name,
        is_array: Array.isArray(teamMemberData)
      });

      // DEBUG: Comprehensive logging for notes data
      console.log("DEBUG_NOTES_DATA", {
        errorId,
        household: row.household_name,
        quoted_households_raw: quotedHouseholdData,
        quoted_household_processed: quotedHousehold,
        notes_from_quoted_household: quotedHousehold?.notes,
        override_notes: override?.notes,
        is_array: Array.isArray(quotedHouseholdData)
      });
      
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
        lead_source_label: override?.lead_source_raw || overrideLeadSource || originalLeadSource || quotedHousehold?.lead_source || "Undefined",
        notes: override?.notes || quotedHousehold?.notes || "", // Get notes from quoted_households first, then override
        items_quoted: override?.items_quoted ?? row.items_quoted ?? 0,
        policies_quoted: override?.policies_quoted ?? row.policies_quoted ?? 0,
        premium_potential_cents: override?.premium_potential_cents ?? row.premium_potential_cents ?? 0,
        status: row.submissions?.final ? "final" : "draft",
        email: override?.email || "",
        phone: override?.phone || "",
        staff_member_name: teamMember?.name || "Unknown",
        team_member_id: row.submissions?.team_member_id,
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

    console.log("FEED_V1_OK", { 
      errorId, 
      userId, 
      agencyId, 
      page, 
      pageSize, 
      total, 
      row_count: processedRows.length 
    });

    return json(200, {
      rows: processedRows,
      page,
      pageSize,
      total
    });

  } catch (error) {
    console.log("FEED_V1_ERR", { 
      errorId, 
      userId, 
      agencyId, 
      error: "Unhandled exception", 
      message: String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Never leak stack traces or internal details
    return json(500, { 
      error: "internal_server_error",
      error_id: errorId
    });
  }
});