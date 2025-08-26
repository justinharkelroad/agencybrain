// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer"
    }
  });
}

type Body = {
  agencySlug: string;
  formSlug: string;
  token: string;
  teamMemberId: string;
  submissionDate: string;  // YYYY-MM-DD
  workDate?: string;       // optional
  values: Record<string, unknown>;
};

serve(async (req) => {
  try {
    if (req.method !== "POST") return json(405, {code:"METHOD_NOT_ALLOWED"});
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json() as Body;
    const { agencySlug, formSlug, token } = body;
    if (!agencySlug || !formSlug || !token) return json(400, {code:"BAD_REQUEST"});
    if (!body.teamMemberId || !body.submissionDate) return json(400, {code:"MISSING_FIELDS"});

    // resolve link
    const { data: link, error } = await supabase
      .from("form_links")
      .select(`
        id, enabled, expires_at,
        form_template:form_templates!inner(id, slug, status, settings_json, agency_id),
        agency:agencies!inner(id, slug)
      `)
      .eq("token", token)
      .eq("enabled", true)
      .eq("form_templates.slug", formSlug)
      .eq("agencies.slug", agencySlug)
      .single();

    if (error) return json(404, {code:"NOT_FOUND"});
    const now = new Date();
    if (link.expires_at && new Date(link.expires_at) < now) return json(410, {code:"EXPIRED"});
    if (link.form_template.status !== "published") return json(404, {code:"UNPUBLISHED"});

    // Phase 3 will set accurate 'late' using agency TZ + due-by
    const isLate = false;
    const finalDate = (body.workDate ?? body.submissionDate);

    // supersede previous final for that rep/day
    const { data: prev } = await supabase
      .from("submissions")
      .select("id")
      .eq("form_template_id", link.form_template.id)
      .eq("team_member_id", body.teamMemberId)
      .eq("coalesce(work_date, submission_date)", finalDate) as any;

    if (prev?.length) {
      await supabase
        .from("submissions")
        .update({ final: false, superseded_at: new Date().toISOString() })
        .in("id", prev.map((r:any)=>r.id));
    }

    const { data: ins, error: insErr } = await supabase
      .from("submissions")
      .insert({
        form_template_id: link.form_template.id,
        team_member_id: body.teamMemberId,
        submission_date: body.submissionDate,
        work_date: body.workDate ?? null,
        late: isLate,
        final: true,
        payload_json: body.values
      })
      .select("id")
      .single();

    if (insErr) return json(500, {code:"WRITE_FAIL"});
    return json(200, { ok: true, submissionId: ins.id });
  } catch (e) {
    return json(500, {code:"SERVER_ERROR"});
  }
});