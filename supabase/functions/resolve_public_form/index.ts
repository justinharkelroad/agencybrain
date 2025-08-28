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
  console.log("🔍 resolve_public_form started", new Date().toISOString());
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("✅ CORS preflight handled");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse body for parameters (consistent with supabase.functions.invoke)
    const body = await req.json().catch(() => ({}));
    const agencySlug = body.agencySlug || "";
    const formSlug = body.formSlug || "";
    const token = body.token || "";

    console.log("📥 Request params:", { agencySlug, formSlug, token: token.substring(0, 8) + "..." });

    if (!agencySlug || !formSlug || !token) {
      console.log("❌ Bad request - missing parameters");
      return json(400, {code:"BAD_REQUEST"});
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Step 1: Get form template by agency slug and form slug
    console.log("🏢 Looking up agency:", agencySlug);
    const { data: agencyData, error: agencyError } = await supabase
      .from("agencies")
      .select("id")
      .eq("slug", agencySlug)
      .single();

    if (agencyError) {
      console.log("❌ Agency not found:", agencyError);
      return json(404, {code:"NOT_FOUND"});
    }

    console.log("📋 Looking up form template:", formSlug, "for agency:", agencyData.id);
    const { data: formTemplate, error: formError } = await supabase
      .from("form_templates")
      .select("id, slug, status, settings_json, schema_json")
      .eq("slug", formSlug)
      .eq("agency_id", agencyData.id)
      .single();

    if (formError) {
      console.log("❌ Form template not found:", formError);
      return json(404, {code:"NOT_FOUND"});
    }

    // Step 2: Get form link by form template ID and token
    console.log("🔗 Looking up form link with token:", token.substring(0, 8) + "...");
    const { data: formLink, error: linkError } = await supabase
      .from("form_links")
      .select("id, enabled, token, expires_at")
      .eq("token", token)
      .eq("enabled", true)
      .eq("form_template_id", formTemplate.id)
      .single();

    if (linkError) {
      console.log("❌ Form link not found or disabled:", linkError);
      return json(404, {code:"NOT_FOUND"});
    }

    const now = new Date();
    if (formLink.expires_at && new Date(formLink.expires_at) < now) {
      console.log("❌ Form link expired:", formLink.expires_at);
      return json(410, {code:"EXPIRED"});
    }
    if (formTemplate.status !== "published") {
      console.log("❌ Form template not published:", formTemplate.status);
      return json(404, {code:"UNPUBLISHED"});
    }

    // Get team members for the agency
    console.log("👥 Fetching team members for agency:", agencyData.id);
    const { data: teamMembers, error: teamMembersError } = await supabase
      .from("team_members")
      .select("id, name")
      .eq("agency_id", agencyData.id)
      .eq("status", "active")
      .order("name", { ascending: true });

    if (teamMembersError) {
      console.log("❌ Team members fetch error:", teamMembersError);
      return json(500, {code:"TEAM_MEMBERS_FETCH_ERROR"});
    }

    console.log("✅ Form resolution successful:", {
      formId: formTemplate.id,
      slug: formTemplate.slug,
      teamMembersCount: teamMembers?.length || 0
    });

    return json(200, {
      form: {
        id: formTemplate.id,
        slug: formTemplate.slug,
        settings: formTemplate.settings_json ?? {},
        schema: formTemplate.schema_json ?? {},
        team_members: teamMembers ?? []
      }
    });
  } catch (e) {
    console.error("💥 Server error in resolve_public_form:", e);
    return json(500, {code:"SERVER_ERROR"});
  }
});