import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface SearchQuery {
  agencySlug: string;
  q?: string;             // search string: supports quoted phrase, prefix 'jo*'
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

    // Build query
    const limit = Math.max(1, Math.min(body.limit ?? 50, 200));
    let query = supaSrv
      .from("quoted_households")
      .select(`
        id,
        submission_id,
        form_template_id,
        team_member_id,
        work_date,
        household_name,
        lead_source,
        zip,
        notes,
        extras,
        is_final,
        is_late,
        created_at
      `)
      .eq("agency_id", agency.id)
      .order("work_date", { ascending: false })
      .order("id", { ascending: false });

    // Apply filters
    if (body.start) {
      query = query.gte("work_date", body.start);
    }
    if (body.end) {
      query = query.lte("work_date", body.end);
    }
    if (body.staffId) {
      query = query.eq("team_member_id", body.staffId);
    }
    if (body.leadSource) {
      query = query.eq("lead_source", body.leadSource);
    }
    if (body.lateOnly) {
      query = query.eq("is_late", true);
    }

    // Final/superseded logic
    const finalOnly = body.finalOnly ?? true;
    if (finalOnly) {
      query = query.eq("is_final", true);
    } else if (body.includeSuperseded === false) {
      query = query.eq("is_final", true);
    }

    // Pagination cursor
    if (body.cursor) {
      query = query.lt("id", body.cursor);
    }

    // Search functionality
    if (body.q && body.q.trim().length) {
      const searchTerm = body.q.trim();
      
      if (searchTerm.includes("*")) {
        // Prefix search (convert jo* -> ilike 'jo%')
        const prefixTerm = searchTerm.replace("*", "%");
        query = query.ilike("household_name", prefixTerm);
      } else if (searchTerm.startsWith('"') && searchTerm.endsWith('"')) {
        // Exact phrase search
        const exactTerm = searchTerm.slice(1, -1);
        query = query.ilike("household_name", exactTerm);
      } else {
        // Fuzzy search with wildcards
        query = query.ilike("household_name", `%${searchTerm}%`);
      }
    }

    // Execute query with limit + 1 for pagination
    query = query.limit(limit + 1);
    const { data: rows, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return jsonResponse(500, { code: "DATABASE_ERROR", message: error.message });
    }

    // Handle pagination
    let nextCursor: string | undefined = undefined;
    let resultRows = rows ?? [];
    
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