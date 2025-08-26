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

    // Handle quoted details auto-spawning
    const quotedCount = parseInt(String(body.values.quoted_count || '0'));
    const spawnCap = link.form_template.settings_json?.spawnCap || 10;
    const actualSpawnCount = Math.min(quotedCount, spawnCap);

    if (actualSpawnCount > 0) {
      // Create quoted household details
      const quotedDetails = [];
      for (let i = 0; i < actualSpawnCount; i++) {
        quotedDetails.push({
          submission_id: ins.id,
          household_name: body.values[`quoted_household_${i+1}`] || `Household ${i+1}`,
          zip_code: body.values[`quoted_zip_${i+1}`] || null,
          policy_type: body.values[`quoted_policy_type_${i+1}`] || null,
        });
      }

      if (quotedDetails.length > 0) {
        await supabase
          .from('quoted_household_details')
          .insert(quotedDetails);
      }
    }

    // Handle sold policy details if provided
    const soldItems = parseInt(String(body.values.sold_items || '0'));
    if (soldItems > 0) {
      const soldDetails = [];
      for (let i = 0; i < soldItems; i++) {
        const premiumStr = String(body.values[`sold_premium_${i+1}`] || '0');
        const commissionStr = String(body.values[`sold_commission_${i+1}`] || '0');
        
        // Convert dollar amounts to cents
        const premiumCents = Math.round(parseFloat(premiumStr.replace(/[$,]/g, '')) * 100);
        const commissionCents = Math.round(parseFloat(commissionStr.replace(/[$,]/g, '')) * 100);
        
        soldDetails.push({
          submission_id: ins.id,
          policy_holder_name: body.values[`sold_policy_holder_${i+1}`] || `Policy ${i+1}`,
          policy_type: body.values[`sold_policy_type_${i+1}`] || 'Unknown',
          premium_amount_cents: premiumCents,
          commission_amount_cents: commissionCents,
          quoted_household_detail_id: body.values[`sold_quoted_ref_${i+1}`] || null,
        });
      }

      if (soldDetails.length > 0) {
        await supabase
          .from('sold_policy_details')
          .insert(soldDetails);
      }
    }

    return json(200, { 
      ok: true, 
      submissionId: ins.id,
      quotedDetailsCreated: actualSpawnCount,
      soldDetailsCreated: soldItems
    });
  } catch (e) {
    return json(500, {code:"SERVER_ERROR"});
  }
});