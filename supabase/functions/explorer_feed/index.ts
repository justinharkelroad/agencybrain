import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      headers: { 
        "access-control-allow-origin": "*", 
        "access-control-allow-headers": "authorization, apikey, content-type" 
      }
    });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!, 
      Deno.env.get("SUPABASE_ANON_KEY")!, 
      { 
        auth: { persistSession: false },
        global: { 
          headers: { 
            Authorization: req.headers.get('Authorization') ?? '' 
          } 
        }
      }
    );

    const body = await req.json().catch(() => ({}));
    const { 
      agency_slug, start, end, query, staffId, leadSource, 
      page = 1, pageSize = 50,
      sortBy = "created_at", 
      sortOrder = "desc" 
    } = body;

    // Get agency by slug or user's agency
    let agencyId = null;
    if (agency_slug) {
      const { data: ag } = await sb.from("agencies").select("id").eq("slug", agency_slug).single();
      agencyId = ag?.id;
    } else {
      // Get current user's agency
      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        const { data: profile } = await sb.from("profiles").select("agency_id").eq("id", user.id).single();
        agencyId = profile?.agency_id;
      }
    }

    if (!agencyId) {
      return new Response(
        JSON.stringify({ error: "Agency not found" }), 
        { 
          status: 400, 
          headers: { "content-type": "application/json", "access-control-allow-origin": "*" }
        }
      );
    }

    // Build query for quoted household details with joins
    let queryBuilder = sb
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
    if (start) queryBuilder = queryBuilder.gte("created_at", start + "T00:00:00");
    if (end) queryBuilder = queryBuilder.lte("created_at", end + "T23:59:59");
    if (query) queryBuilder = queryBuilder.ilike("household_name", `%${query}%`);

    // Apply sorting with whitelist validation
    const VALID_SORT_FIELDS = [
      "created_at",               // ISO timestamptz
      "work_date",                // date
      "household_name",           // text
      "items_quoted",             // int
      "policies_quoted",          // int  
      "premium_potential_cents"   // bigint
    ];
    
    const sortField = VALID_SORT_FIELDS.includes(sortBy) ? sortBy : "created_at";
    const ascending = sortOrder === "asc";
    
    // Log resolved sortField for debugging (48h cleanup)
    console.log(`Explorer sort: field=${sortField}, order=${sortOrder}, requested=${sortBy}`);
    
    // Apply ORDER BY with deterministic tiebreaker
    queryBuilder = queryBuilder.order(sortField, { ascending });
    if (sortField !== "created_at") {
      queryBuilder = queryBuilder.order("created_at", { ascending: false });
    }

    // Apply pagination
    const offset = (page - 1) * pageSize;
    queryBuilder = queryBuilder.range(offset, offset + pageSize - 1);

    const { data, error, count } = await queryBuilder;

    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: error.message }), 
        { 
          status: 500, 
          headers: { "content-type": "application/json", "access-control-allow-origin": "*" }
        }
      );
    }

      // Transform data to match expected format - preserve numeric types and extract notes
      const transformedRows = (data || []).map(row => ({
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
        notes: row.extras?.detailed_notes || row.extras?.notes || null, // Extract notes from extras JSON
        custom_fields: row.extras?.custom_fields || {}, // Include custom fields with readable labels
        email: null,
        phone: null,
        items_quoted: row.items_quoted,           // Keep as is, allow null
        policies_quoted: row.policies_quoted,     // Keep as is, allow null
        premium_potential_cents: row.premium_potential_cents, // Keep as is, allow null
        status: "final"
      }));

    return new Response(
      JSON.stringify({ 
        rows: transformedRows,
        page,
        pageSize,
        total: count || 0
      }), 
      { 
        status: 200, 
        headers: { "content-type": "application/json", "access-control-allow-origin": "*" }
      }
    );

  } catch (error) {
    console.error("Explorer feed error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }), 
      { 
        status: 500, 
        headers: { "content-type": "application/json", "access-control-allow-origin": "*" }
      }
    );
  }
});