// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      ...corsHeaders
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
  console.log("🚀 submit_public_form started", new Date().toISOString());
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("✅ CORS preflight handled");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      console.log("❌ Method not allowed:", req.method);
      return json(405, { error: 'METHOD_NOT_ALLOWED', detail: 'Only POST method allowed' });
    }
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json() as Body;
    console.log('📥 Received submission request:', { 
      agencySlug: body.agencySlug, 
      formSlug: body.formSlug,
      teamMemberId: body.teamMemberId,
      submissionDate: body.submissionDate,
      workDate: body.workDate
    });

    console.log("resolve input", {
      agencySlug: body.agencySlug,
      formSlug: body.formSlug,
      token: (body.token || "").slice(0, 8)
    });
    
    const { agencySlug, formSlug, token } = body;
    if (!agencySlug || !formSlug || !token) {
      console.log('❌ Bad request - missing basic parameters');
      return json(400, { error: 'BAD_REQUEST', detail: 'Missing agencySlug, formSlug, or token' });
    }
    if (!body.teamMemberId || !body.submissionDate) {
      console.log('❌ Missing required fields:', { 
        teamMemberId: !!body.teamMemberId, 
        submissionDate: !!body.submissionDate 
      });
      return json(400, { error: 'MISSING_FIELDS', detail: 'Missing teamMemberId or submissionDate' });
    }

    // resolve link with plain fetches to bypass PostgREST embedding
    console.log("🔗 Resolving form link...");
    console.log("SELECT_V3_FIXED");
    
    // 1) fetch link only
    const { data: link, error: e1 } = await supabase
      .from('form_links')
      .select('id, token, enabled, expires_at, form_template_id, agency_id')
      .eq('token', token)
      .single();
      
    if (e1 || !link) {
      console.log("❌ Database error during link fetch:", e1);
      return json(500, { error: 'DB_ERROR_LINK', details: e1 });
    }

    console.log("✅ Link found:", {
      id: link.id,
      enabled: link.enabled,
      expires_at: link.expires_at,
      form_template_id: link.form_template_id,
      agency_id: link.agency_id
    });

    if (!link.enabled) {
      console.log("❌ Form link is disabled");
      return json(403, { error: 'FORM_DISABLED' });
    }

    const now = new Date();
    if (link.expires_at && new Date(link.expires_at) < now) {
      console.log("❌ Form link expired:", link.expires_at);
      return json(410, { error: 'FORM_EXPIRED' });
    }

    // 2) fetch template by id
    const { data: template, error: e2 } = await supabase
      .from('form_templates')
      .select('id, slug, status, settings_json, agency_id')
      .eq('id', link.form_template_id)
      .single();
      
    if (e2 || !template) {
      console.log("❌ Template fetch error:", e2);
      return json(404, { error: 'NOT_FOUND_TEMPLATE', details: e2 });
    }

    console.log("✅ Template found:", {
      id: template.id,
      slug: template.slug,
      status: template.status,
      agency_id: template.agency_id
    });

    if (template.status !== 'published') {
      console.log("❌ Form template not published:", template.status);
      return json(403, { error: 'FORM_UNPUBLISHED' });
    }

    // 3) fetch agency by id
    const { data: agency, error: e3 } = await supabase
      .from('agencies')
      .select('id, slug')
      .eq('id', link.agency_id)
      .single();
      
    if (e3 || !agency) {
      console.log("❌ Agency fetch error:", e3);
      return json(404, { error: 'NOT_FOUND_AGENCY', details: e3 });
    }

    console.log("✅ Agency found:", {
      id: agency.id,
      slug: agency.slug
    });

    // Validate slugs match
    if (template.slug !== formSlug) {
      console.log("❌ Form slug mismatch:", { expected: formSlug, actual: template.slug });
      return json(404, { error: 'NOT_FOUND', reason: 'template', detail: 'Form slug mismatch' });
    }

    if (agency.slug !== agencySlug) {
      console.log("❌ Agency slug mismatch:", { expected: agencySlug, actual: agency.slug });
      return json(404, { error: 'NOT_FOUND', reason: 'agency', detail: 'Agency slug mismatch' });
    }

    // Compute isLate using DB function
    console.log("⏰ Computing late status...");
    const { data: lateCalc, error: lateErr } = await supabase.rpc("compute_is_late", {
      p_agency_id: template.agency_id,
      p_settings: template.settings_json,
      p_submission_date: body.submissionDate,
      p_work_date: body.workDate ?? null,
      p_submitted_at: new Date().toISOString()
    });
    if (lateErr) {
      console.log("❌ Late calculation error:", lateErr);
      return json(500, { error: 'DB_ERROR', detail: 'Failed to calculate late status' });
    }
    const isLate = lateCalc as boolean;
    const finalDate = (body.workDate ?? body.submissionDate);

    console.log("📊 Submission analysis:", { isLate, finalDate });

    // Context logging
    console.log("submit_public_form", 
      { agency: agency.slug, form: template.slug, tm: body.teamMemberId, d: finalDate });

    // supersede previous final for that rep/day
    console.log("🔄 Checking for previous submissions to supersede...");
    const d = finalDate; // YYYY-MM-DD string

    const { data: prev, error: prevErr } = await supabase
      .from("submissions")
      .select("id")
      .eq("form_template_id", template.id)
      .eq("team_member_id", body.teamMemberId)
      // match rows where work_date == d OR (work_date is null AND submission_date == d)
      .or(`work_date.eq.${d},and(work_date.is.null,submission_date.eq.${d})`)
      .eq("final", true);

    if (prevErr) {
      console.error("❌ Previous submission lookup failed:", prevErr);
      return json(500, { error: 'DB_ERROR', detail: 'Failed to lookup previous submissions' });
    }

    if (prev?.length) {
      console.log("🔄 Superseding", prev.length, "previous submissions");
      const { error: updErr } = await supabase
        .from("submissions")
        .update({ final: false, superseded_at: new Date().toISOString() })
        .in("id", prev.map((r: any) => r.id));
      if (updErr) {
        console.log("❌ Previous supersede error:", updErr);
        return json(500, { error: 'DB_ERROR', detail: 'Failed to supersede previous submissions' });
      }
    } else {
      console.log("ℹ️ No previous submissions to supersede");
    }

    console.log("💾 Inserting new submission...");
    const { data: ins, error: insErr } = await supabase
      .from("submissions")
      .insert({
        form_template_id: template.id,
        team_member_id: body.teamMemberId,
        submission_date: body.submissionDate,
        work_date: body.workDate ?? null,
        late: isLate,
        final: true,
        payload_json: body.values
      })
      .select("id")
      .single();

    if (insErr) {
      console.log("❌ Submission insert failed:", insErr);
      return json(500, { error: 'DB_ERROR', detail: 'Failed to insert submission' });
    }

    console.log("✅ Submission created with ID:", ins.id);

    // Handle quoted details auto-spawning
    const quotedCount = parseInt(String(body.values.quoted_count || '0'));
    const spawnCap = template.settings_json?.spawnCap || 10;
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

    // Queue receipt email to outbox
    const { data: tm } = await supabase.from("team_members")
      .select("id,name,email").eq("id", body.teamMemberId).maybeSingle();

    const { data: owner } = await supabase
      .from("agencies")
      .select("id, timezone, cc_owner_on_reminders")
      .eq("id", template.agency_id).maybeSingle();

    // pick CC owner based on form override or agency default
    const ccOwner = (template.settings_json?.reminders?.ccOwner ??
                     owner?.cc_owner_on_reminders ?? true) as boolean;

    // compose summary plain text
    const wd = body.workDate ?? body.submissionDate;
    const subject = `Submission received: ${template.slug} — ${tm?.name} on ${wd}`;
    const text = [
      `Hi ${tm?.name || "Rep"},`,
      ``,
      `We received your ${template.slug} entry for ${wd}.`,
      `Late: ${isLate ? "Yes" : "No"}`,
      ``,
      `Summary:`,
      `Outbound Calls: ${body.values?.outbound_calls ?? 0}`,
      `Talk Minutes: ${body.values?.talk_minutes ?? 0}`,
      `Quoted Count: ${body.values?.quoted_count ?? 0}`,
      `Items Sold: ${body.values?.sold_items ?? 0}`,
      `Policies Sold: ${body.values?.sold_policies ?? 0}`,
      `Sold Premium: $${Number(body.values?.sold_premium ?? 0).toFixed(2)}`,
      ``,
      `— AgencyBrain`
    ].join("\n");

    // queue to outbox so reminders have a single channel
    await supabase.from("email_outbox").insert({
      agency_id: template.agency_id,
      kind: 'receipt',
      to_email: tm?.email || 'no-reply@invalid.local',
      cc_owner: !!ccOwner,
      subject, 
      body_text: text,
      meta: { 
        submissionId: ins.id, 
        teamMemberId: body.teamMemberId, 
        workDate: wd, 
        formId: template.id 
      },
      scheduled_at: new Date().toISOString()
    });

    console.log("✅ Form submission completed successfully:", {
      submissionId: ins.id,
      quotedDetailsCreated: actualSpawnCount,
      soldDetailsCreated: soldItems,
      isLate,
      finalDate
    });

    return json(200, { 
      ok: true, 
      submissionId: ins.id,
      quotedDetailsCreated: actualSpawnCount,
      soldDetailsCreated: soldItems,
      isLate
    });
  } catch (e) {
    console.error("💥 Server error in submit_public_form:", e);
    return json(500, { error: 'SERVER_ERROR', detail: 'Internal server error' });
  }
});