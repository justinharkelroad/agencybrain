// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(status: number, body: any, extra: Record<string,string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "permissions-policy": "interest-cohort=()",
      "vary": "Host",
      ...corsHeaders,
      ...extra
    }
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const agencySlug = url.searchParams.get("agencySlug") || "";
    const formSlug = url.searchParams.get("formSlug") || "";
    const token = url.searchParams.get("t") || "";

    if (!agencySlug || !formSlug || !token) return json(400, {code:"BAD_REQUEST"});

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Step 1: Get form template by agency slug and form slug
    const { data: agencyData, error: agencyError } = await supabase
      .from("agencies")
      .select("id")
      .eq("slug", agencySlug)
      .single();

    if (agencyError) return json(404, {code:"NOT_FOUND"});

    const { data: formTemplate, error: formError } = await supabase
      .from("form_templates")
      .select("id, slug, status, settings_json")
      .eq("slug", formSlug)
      .eq("agency_id", agencyData.id)
      .single();

    if (formError) return json(404, {code:"NOT_FOUND"});

    // Step 2: Get form link by form template ID and token
    const { data: formLink, error: linkError } = await supabase
      .from("form_links")
      .select("id, enabled, token, expires_at")
      .eq("token", token)
      .eq("enabled", true)
      .eq("form_template_id", formTemplate.id)
      .single();

    if (linkError) return json(404, {code:"NOT_FOUND"});

    const now = new Date();
    if (formLink.expires_at && new Date(formLink.expires_at) < now) return json(410, {code:"EXPIRED"});
    if (formTemplate.status !== "published") return json(404, {code:"UNPUBLISHED"});

    // Get form fields
    const { data: fields, error: fieldsError } = await supabase
      .from("form_fields")
      .select("*")
      .eq("form_template_id", formTemplate.id)
      .order("position", { ascending: true });

    if (fieldsError) return json(500, {code:"FIELDS_FETCH_ERROR"});

    // Get team members for the agency
    const { data: teamMembers, error: teamMembersError } = await supabase
      .from("team_members")
      .select("id, name")
      .eq("agency_id", agencyData.id)
      .eq("status", "active")
      .order("name", { ascending: true });

    if (teamMembersError) return json(500, {code:"TEAM_MEMBERS_FETCH_ERROR"});

    return json(200, {
      form: {
        id: formTemplate.id,
        slug: formTemplate.slug,
        settings: formTemplate.settings_json ?? {},
        fields: fields ?? [],
        team_members: teamMembers ?? []
      }
    });
  } catch (e) {
    return json(500, {code:"SERVER_ERROR"});
  }
});