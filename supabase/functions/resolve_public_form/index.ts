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

    // single secure join
    const { data, error } = await supabase
      .from("form_links")
      .select(`
        id, enabled, token, expires_at,
        form_template:form_templates!inner(id, slug, status, settings_json, agency_id),
        agency:agencies!inner(id, slug)
      `)
      .eq("token", token)
      .eq("enabled", true)
      .eq("form_template.slug", formSlug)
      .eq("agency.slug", agencySlug)
      .single();

    if (error) return json(404, {code:"NOT_FOUND"});

    const now = new Date();
    if (data.expires_at && new Date(data.expires_at) < now) return json(410, {code:"EXPIRED"});
    if (data.form_template.status !== "published") return json(404, {code:"UNPUBLISHED"});

    // get fields
    const { data: fields, error: ferr } = await supabase
      .from("form_fields")
      .select("*")
      .eq("form_template_id", data.form_template.id)
      .order("position", { ascending: true });

    if (ferr) return json(500, {code:"FIELDS_FETCH_ERROR"});

    return json(200, {
      form: {
        id: data.form_template.id,
        slug: data.form_template.slug,
        settings: data.form_template.settings_json ?? {},
        fields: fields ?? []
      }
    });
  } catch (e) {
    return json(500, {code:"SERVER_ERROR"});
  }
});