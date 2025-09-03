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

    // resolve link with safe joins
    console.log("🔗 Resolving form link...");
    console.log("resolver:SELECT_V2");
    const { data: link, error } = await supabase
      .from("form_links")
      .select(`
        id, token, enabled, expires_at,
        form_templates:form_template_id ( id, slug, status, settings_json, agency_id ),
        agencies:agency_id ( id, slug )
      `)
      .eq("token", token)
      .single();

    console.log("link query", { 
      linkErr: error, 
      hasLink: !!link, 
      enabled: link?.enabled, 
      expires_at: link?.expires_at,
      ft_slug: link?.form_templates?.slug, 
      ft_status: link?.form_templates?.status, 
      ag_slug: link?.agencies?.slug 
    });

    // Handle database errors
    if (error) {
      console.log("❌ Database error during link resolution:", error);
      if (error.code === 'PGRST116') {
        return json(404, { error: 'NOT_FOUND', reason: 'link', detail: 'Token not found' });
      }
      return json(500, { error: 'DB_ERROR', detail: error.message });
    }

    if (!link) {
      console.log("❌ Form link not found for token");
      return json(404, { error: 'NOT_FOUND', reason: 'link', detail: 'Invalid token' });
    }

    // Validate link is enabled
    if (!link.enabled) {
      console.log("❌ Form link disabled");
      return json(404, { error: 'NOT_FOUND', reason: 'disabled', detail: 'Form link is disabled' });
    }

    // Validate expiry
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      console.log("❌ Form link expired:", link.expires_at);
      return json(404, { error: 'NOT_FOUND', reason: 'expired', detail: 'Form link has expired' });
    }

    // Validate form template exists and matches
    if (!link.form_templates) {
      console.log("❌ Form template not found");
      return json(404, { error: 'NOT_FOUND', reason: 'template', detail: 'Form template not found' });
    }

    if (link.form_templates.slug !== formSlug) {
      console.log("❌ Form slug mismatch:", { expected: formSlug, actual: link.form_templates.slug });
      return json(404, { error: 'NOT_FOUND', reason: 'template', detail: 'Form slug mismatch' });
    }

    // Validate agency exists and matches
    if (!link.agencies) {
      console.log("❌ Agency not found");
      return json(404, { error: 'NOT_FOUND', reason: 'agency', detail: 'Agency not found' });
    }

    if (link.agencies.slug !== agencySlug) {
      console.log("❌ Agency slug mismatch:", { expected: agencySlug, actual: link.agencies.slug });
      return json(404, { error: 'NOT_FOUND', reason: 'agency', detail: 'Agency slug mismatch' });
    }
    
    console.log("✅ Form link resolved for:", link.form_templates.slug);
    
    // Check publish status
    if (link.form_templates?.status !== "published") {
      console.log("❌ Form template not published:", link.form_templates.status);
      return json(404, { error: 'NOT_FOUND', reason: 'template', detail: 'Form template not published' });
    }

    // Compute isLate using DB function
    console.log("⏰ Computing late status...");
    const { data: lateCalc, error: lateErr } = await supabase.rpc("compute_is_late", {
      p_agency_id: link.form_templates.agency_id,
      p_settings: link.form_templates.settings_json,
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
      { agency: link.agencies.slug, form: link.form_templates.slug, tm: body.teamMemberId, d: finalDate });

    // supersede previous final for that rep/day
    console.log("🔄 Checking for previous submissions to supersede...");
    const d = finalDate; // YYYY-MM-DD string

    const { data: prev, error: prevErr } = await supabase
      .from("submissions")
      .select("id")
      .eq("form_template_id", link.form_templates.id)
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
        form_template_id: link.form_templates.id,
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
    const spawnCap = link.form_templates.settings_json?.spawnCap || 10;
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
      .eq("id", link.form_templates.agency_id).maybeSingle();

    // pick CC owner based on form override or agency default
    const ccOwner = (link.form_templates.settings_json?.reminders?.ccOwner ??
                     owner?.cc_owner_on_reminders ?? true) as boolean;

    // compose summary plain text
    const wd = body.workDate ?? body.submissionDate;
    const subject = `Submission received: ${link.form_templates.slug} — ${tm?.name} on ${wd}`;
    const text = [
      `Hi ${tm?.name || "Rep"},`,
      ``,
      `We received your ${link.form_templates.slug} entry for ${wd}.`,
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
      agency_id: link.form_templates.agency_id,
      kind: 'receipt',
      to_email: tm?.email || 'no-reply@invalid.local',
      cc_owner: !!ccOwner,
      subject, 
      body_text: text,
      meta: { 
        submissionId: ins.id, 
        teamMemberId: body.teamMemberId, 
        workDate: wd, 
        formId: link.form_templates.id 
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