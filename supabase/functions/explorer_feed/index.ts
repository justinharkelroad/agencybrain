import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface SearchQuery {
  agencySlug: string;
  q?: string;             // search string: supports quoted phrase, prefix 'jo*', also searches "Undefined"
  start?: string;         // YYYY-MM-DD
  end?: string;           // YYYY-MM-DD
  staffId?: string;
  leadSource?: string;
  finalOnly?: boolean;    // default true
  includeSuperseded?: boolean; // default false
  lateOnly?: boolean;     // default false
  limit?: number;         // default 50
  cursor?: string;        // pagination cursor: last row id
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

  try {
    if (req.method !== "POST") {
      return jsonResponse(405, { code: "METHOD_NOT_ALLOWED" });
    }

    const body = await req.json() as SearchQuery;
    const agencySlug = body.agencySlug;
    
    if (!agencySlug) {
      return jsonResponse(400, { code: "BAD_REQUEST", message: "agencySlug is required" });
    }

    const supaAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { 
        global: { 
          headers: { 
            Authorization: req.headers.get("Authorization") ?? "" 
          } 
        } 
      }
    );

    const supaSrv = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Authentication check: owner/admin only
    const { data: user } = await supaAnon.auth.getUser();
    if (!user?.user) {
      return jsonResponse(401, { code: "UNAUTHORIZED" });
    }

    // Get agency by slug
    const { data: agency, error: agencyError } = await supaSrv
      .from("agencies")
      .select("id, slug")
      .eq("slug", agencySlug)
      .single();

    if (agencyError || !agency) {
      return jsonResponse(404, { code: "AGENCY_NOT_FOUND" });
    }

    // Verify user has access (owner/admin of agency)
    const { data: profile } = await supaSrv
      .from("profiles")
      .select("id, agency_id, role")
      .eq("id", user.user.id)
      .single();

    if (!profile || profile.agency_id !== agency.id || !["user", "admin"].includes(profile.role)) {
      return jsonResponse(403, { code: "FORBIDDEN" });
    }

    // Build query using Supabase client methods
    const limit = Math.max(1, Math.min(body.limit ?? 50, 200));
    
    // Get quoted household details with joins
    let query = supaSrv
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
          is_final,
          is_late,
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
      `)
      .eq("submissions.form_templates.agency_id", agency.id);

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
      query = query.eq("submissions.is_late", true);
    }

    // Final/superseded logic
    const finalOnly = body.finalOnly ?? true;
    if (finalOnly) {
      query = query.eq("submissions.is_final", true);
    } else if (body.includeSuperseded === false) {
      query = query.eq("submissions.is_final", true);
    }

    // Basic search on household name (we'll handle lead source filtering in post-processing)
    if (body.q && body.q.trim().length && body.q.trim().toLowerCase() !== 'undefined') {
      const searchTerm = body.q.trim();
      
      if (searchTerm.includes("*")) {
        const prefixTerm = searchTerm.replace("*", "%");
        query = query.ilike("household_name", prefixTerm);
      } else if (searchTerm.startsWith('"') && searchTerm.endsWith('"')) {
        const exactTerm = searchTerm.slice(1, -1);
        query = query.ilike("household_name", exactTerm);
      } else {
        query = query.ilike("household_name", `%${searchTerm}%`);
      }
    }

    // Pagination cursor
    if (body.cursor) {
      query = query.lt("id", body.cursor);
    }

    // Order and limit
    query = query
      .order("submissions(work_date)", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    const { data: rawRows, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return jsonResponse(500, { code: "DATABASE_ERROR", message: error.message });
    }

    // Process and merge the data with COALESCE logic
    let processedRows = (rawRows || []).map((row: any) => {
      const override = row.prospect_overrides?.[0]; // First override if exists
      const leadSource = override?.lead_sources?.name || row.lead_sources?.name;
      
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
        submission_id: row.submission_id,
        form_template_id: row.submissions.form_template_id,
        team_member_id: row.submissions.team_member_id,
        work_date: row.submissions.work_date,
        is_final: row.submissions.is_final,
        is_late: row.submissions.is_late,
        created_at: row.created_at,
        
        // Merged data (override takes precedence)
        household_name: override?.prospect_name || row.household_name,
        email: override?.email || "",
        phone: override?.phone || "",
        zip: override?.zip || row.zip_code || "",
        notes: override?.notes || "",
        items_quoted: override?.items_quoted ?? row.items_quoted ?? 0,
        policies_quoted: override?.policies_quoted ?? row.policies_quoted ?? 0,
        premium_potential_cents: override?.premium_potential_cents ?? row.premium_potential_cents ?? 0,
        
        // Lead source handling
        lead_source: override?.lead_source_raw || leadSource || "Undefined",
        
        // Custom fields
        custom_fields: customFields
      };
    });

    // Apply advanced search filtering post-processing
    if (body.q && body.q.trim().length) {
      const searchTerm = body.q.trim();
      
      if (searchTerm.toLowerCase() === 'undefined') {
        // Filter for "Undefined" lead sources
        processedRows = processedRows.filter(row => row.lead_source === "Undefined");
      } else if (!searchTerm.includes("*") && !searchTerm.startsWith('"')) {
        // For non-prefix searches, also search other fields
        const fuzzyTerm = searchTerm.toLowerCase();
        processedRows = processedRows.filter(row => 
          row.household_name.toLowerCase().includes(fuzzyTerm) ||
          row.email.toLowerCase().includes(fuzzyTerm) ||
          row.phone.toLowerCase().includes(fuzzyTerm) ||
          row.zip.toLowerCase().includes(fuzzyTerm) ||
          row.notes.toLowerCase().includes(fuzzyTerm) ||
          row.lead_source.toLowerCase().includes(fuzzyTerm)
        );
      }
    }

    // Apply lead source filter
    if (body.leadSource) {
      processedRows = processedRows.filter(row => row.lead_source === body.leadSource);
    }

    // Handle pagination
    let nextCursor: string | undefined = undefined;
    let resultRows = processedRows;
    
    if (resultRows.length > limit) {
      nextCursor = resultRows[limit].id;
      resultRows = resultRows.slice(0, limit);
    }

    return jsonResponse(200, {
      rows: resultRows,
      nextCursor,
      hasMore: !!nextCursor
    });

  } catch (error) {
    console.error('Server error:', error);
    return jsonResponse(500, { 
      code: "SERVER_ERROR", 
      message: String(error) 
    });
  }
});