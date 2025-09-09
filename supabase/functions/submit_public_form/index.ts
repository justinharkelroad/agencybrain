// deno-lint-ignore-file no-explicit-any
// DEPLOYMENT TIMESTAMP: 2025-09-04T12:50:00Z - FORCE REDEPLOY v3.1-FIXED
// POSTGREST EMBEDDING FIX DEPLOYED
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FUNCTION_VERSION = "3.1-POSTGREST-FIXED";
const DEPLOYMENT_ID = "deploy-20250904-1250";

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
  console.log(`🚀 submit_public_form ${FUNCTION_VERSION} started`, new Date().toISOString());
  console.log(`📦 Deployment ID: ${DEPLOYMENT_ID}`);
  
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
    console.log(`🔧 POSTGREST-EMBEDDING-FIX-${FUNCTION_VERSION}-ACTIVE`);
    console.log("SELECT_V3_FIXED_DEPLOYED");
    
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

    // 3) fetch agency by id - handle null agency_id from link
    const agencyId = link.agency_id || template.agency_id;
    const { data: agency, error: e3 } = await supabase
      .from('agencies')
      .select('id, slug')
      .eq('id', agencyId)
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

    // PHASE A: Resolve KPI version for this form and process metrics
    console.log("📊 Resolving KPI version for form...");
    
    // 1) Resolve form_id → forms_kpi_bindings.kpi_version_id
    const { data: kpiBinding, error: kpiBindingError } = await supabase
      .from('forms_kpi_bindings')
      .select(`
        kpi_version_id,
        kpi_versions!inner(
          id,
          label,
          kpi_id,
          kpis!inner(
            id,
            key,
            agency_id
          )
        )
      `)
      .eq('form_template_id', template.id)
      .maybeSingle();

    if (kpiBindingError) {
      console.log("⚠️ KPI binding lookup error:", kpiBindingError);
    }

    let kpiVersionId = null;
    let labelAtSubmit = null;
    let kpiKey = null;

    if (kpiBinding?.kpi_versions) {
      kpiVersionId = kpiBinding.kpi_version_id;
      labelAtSubmit = kpiBinding.kpi_versions.label;
      kpiKey = kpiBinding.kpi_versions.kpis.key;
      console.log("✅ KPI version resolved:", {
        kpiVersionId,
        labelAtSubmit,
        kpiKey
      });
    } else {
      console.log("⚠️ No KPI binding found for form, metrics will use legacy processing");
    }

    // 2) Process metrics with KPI version data
    console.log("📊 Processing metrics with KPI version data...");
    
    // Call the existing metrics processing function with additional version data
    const { error: metricsError } = await supabase.rpc('upsert_metrics_from_submission', {
      p_submission: ins.id
    });
    
    if (metricsError) {
      console.log("❌ Metrics processing error:", metricsError);
      // Don't fail the submission if metrics processing fails
    } else {
      console.log("✅ Metrics processed successfully");
      
      // 3) Update the metrics_daily row with KPI version data if we have it
      if (kpiVersionId && labelAtSubmit) {
        const { error: versionUpdateError } = await supabase
          .from('metrics_daily')
          .update({
            kpi_version_id: kpiVersionId,
            label_at_submit: labelAtSubmit,
            submitted_at: new Date().toISOString()
          })
          .eq('team_member_id', body.teamMemberId)
          .eq('date', finalDate);
          
        if (versionUpdateError) {
          console.log("⚠️ KPI version update error:", versionUpdateError);
        } else {
          console.log("✅ KPI version data added to metrics_daily");
        }
      }
    }

    // Phase 1: Handle multiple prospects from quotedDetails array
    console.log("📋 Processing quoted details from submission...");
    
    // DEBUG: Log the entire body.values to understand the actual structure
    console.log("🔍 DEBUG: Complete body.values structure:", JSON.stringify(body.values, null, 2));
    
    const quotedDetailsArray = body.values.quotedDetails as any[] || [];
    const leadSourceRaw = body.values.leadSource as string || null;
    
    // DEBUG: Log specific extraction attempts
    console.log("🔍 DEBUG: quotedDetailsArray length:", quotedDetailsArray.length);
    console.log("🔍 DEBUG: quotedDetailsArray content:", JSON.stringify(quotedDetailsArray, null, 2));
    console.log("🔍 DEBUG: leadSourceRaw:", leadSourceRaw);
    
    if (quotedDetailsArray.length > 0) {
      console.log(`📊 Found ${quotedDetailsArray.length} prospect(s) in quotedDetails`);
      
      const quotedDetails = [];
      const quotedHouseholds = [];
      
      for (let i = 0; i < quotedDetailsArray.length; i++) {
        const prospect = quotedDetailsArray[i];
        
        // Extract lead source from prospect and map to UUID
        const leadSourceValue = prospect.lead_source_raw || 
                               prospect.leadSource || 
                               prospect.lead_source || 
                               leadSourceRaw ||
                               null;
        
        // If it looks like a UUID, query for the name and use both ID and name
        let leadSourceId = null;
        let leadSourceName = null;
        
        if (leadSourceValue) {
          // Check if it's a UUID format (36 chars with hyphens)
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(leadSourceValue)) {
            leadSourceId = leadSourceValue;
            console.log("🔍 DEBUG: Using lead_source_id (UUID):", leadSourceId);
            
            // Query lead_sources table to get the name
            const { data: leadSourceData, error: leadSourceError } = await supabase
              .from('lead_sources')
              .select('name')
              .eq('id', leadSourceId)
              .single();
            
            if (!leadSourceError && leadSourceData) {
              leadSourceName = leadSourceData.name;
              console.log("🔍 DEBUG: Found lead source name:", leadSourceName);
            } else {
              console.log("⚠️ WARNING: Could not find lead source name for UUID:", leadSourceId);
            }
          } else {
            leadSourceName = leadSourceValue;
            console.log("🔍 DEBUG: Using lead_source_name (text):", leadSourceName);
          }
        }
        
        // Extract prospect name - never use "Household X"
        const prospectName = prospect.prospect_name || 
                           prospect.householdName || 
                           prospect.name ||
                           null; // Allow NULL if no name provided
        
        console.log(`🔍 DEBUG: Prospect ${i+1} name extraction:`, {
          prospect_name: prospect.prospect_name,
          householdName: prospect.householdName,
          name: prospect.name,
          finalName: prospectName
        });
        
        // Extract business metrics from dynamic fields in this prospect
        let itemsQuoted = 0;
        let policiesQuoted = 0;
        let premiumPotentialCents = 0;
        
        // Look for numeric fields that might represent quoted items/policies
        for (const [fieldKey, fieldValue] of Object.entries(prospect)) {
          if (fieldKey.startsWith('field_') && fieldValue) {
            const numValue = parseInt(String(fieldValue));
            if (!isNaN(numValue) && numValue > 0) {
              // This could be items quoted or policies quoted
              console.log(`🔍 DEBUG: Found numeric field ${fieldKey}: ${numValue}`);
              if (itemsQuoted === 0) itemsQuoted = numValue;
              if (policiesQuoted === 0) policiesQuoted = numValue;
            }
          }
        }
        
        console.log(`🔍 DEBUG: Extracted metrics for prospect ${i+1}:`, {
          itemsQuoted,
          policiesQuoted,
          premiumPotentialCents
        });
        
        // Extract custom fields from prospect data
        const customFields = {};
        Object.keys(prospect).forEach(key => {
          if (key.startsWith('field_')) {
            customFields[key] = prospect[key];
          }
        });

        quotedDetails.push({
          submission_id: ins.id,
          household_name: prospectName,
          zip_code: prospect.zipCode || prospect.zip || null,
          policy_type: prospect.policyType || null,
          lead_source_id: leadSourceId,
          items_quoted: itemsQuoted,
          policies_quoted: policiesQuoted,
          premium_potential_cents: premiumPotentialCents,
          extras: customFields,
        });

        // Also populate the quoted_households table for Explorer
        quotedHouseholds.push({
          agency_id: agency.id,
          submission_id: ins.id,
          form_template_id: template.id,
          team_member_id: body.teamMemberId,
          work_date: body.workDate || body.submissionDate,
          household_name: prospectName,
          zip: prospect.zipCode || prospect.zip || null,
          lead_source: leadSourceName || leadSourceValue, // Use resolved name or original value
          notes: prospect.detailed_notes || prospect.notes || null,
          extras: customFields,
          is_final: true,
          is_late: isLate,
        });
      }

      if (quotedDetails.length > 0) {
        console.log(`💾 Inserting ${quotedDetails.length} quoted household detail(s)`);
        await supabase
          .from('quoted_household_details')
          .insert(quotedDetails);
          
        await supabase
          .from('quoted_households')
          .insert(quotedHouseholds);
      }
    } else {
      // Fallback for legacy format - but still avoid "Household X"
      console.log("🔍 DEBUG: quotedDetailsArray is empty, trying legacy format");
      
      // DEBUG: Look for dynamic field IDs that might contain prospect names
      const dynamicFields = Object.keys(body.values).filter(key => key.startsWith('field_'));
      console.log("🔍 DEBUG: Found dynamic fields:", dynamicFields);
      
      // Try to extract prospect names from dynamic fields
      const prospectNames = [];
      for (const fieldKey of dynamicFields) {
        const fieldValue = body.values[fieldKey];
        if (typeof fieldValue === 'string' && fieldValue.length > 0 && fieldValue.length < 100) {
          // This might be a prospect name - log it
          console.log(`🔍 DEBUG: Possible prospect name in ${fieldKey}:`, fieldValue);
          prospectNames.push({ field: fieldKey, value: fieldValue });
        }
      }
      
      const quotedCount = parseInt(String(body.values.quoted_count || '0'));
      console.log("🔍 DEBUG: quotedCount from body.values.quoted_count:", quotedCount);
      
      if (quotedCount > 0) {
        console.log(`📊 Legacy format: creating ${quotedCount} prospect(s)`);
        const quotedDetails = [];
        const quotedHouseholds = [];
        
        // Use the prospect names we found from dynamic fields if available
        console.log(`🔍 DEBUG: Using ${prospectNames.length} prospect names found in dynamic fields`);
        
        for (let i = 0; i < quotedCount; i++) {
          // Try to get actual name from multiple sources
          let prospectName = null;
          
          // First try legacy format field names
          prospectName = body.values[`quoted_household_${i+1}`] as string || null;
          
          // If not found, try to use prospect names from dynamic fields
          if (!prospectName && i < prospectNames.length) {
            prospectName = prospectNames[i].value;
            console.log(`🔍 DEBUG: Using dynamic field ${prospectNames[i].field} for prospect ${i+1}: ${prospectName}`);
          }
          
          // If still no name, extract from any available dynamic field that looks like a name
          if (!prospectName) {
            // Look for field values that might be names (not numbers, not too long, etc.)
            for (const [key, value] of Object.entries(body.values)) {
              if (key.startsWith('field_') && typeof value === 'string' && 
                  value.length > 0 && value.length < 50 && 
                  !value.match(/^\d+$/) && // not just numbers
                  !value.includes('$') && // not currency
                  !value.match(/^\d{5}(-\d{4})?$/)) { // not zip code
                prospectName = value;
                console.log(`🔍 DEBUG: Found possible prospect name in ${key}: ${prospectName}`);
                break;
              }
            }
          }
          
          console.log(`🔍 DEBUG: Final prospect name for ${i+1}: ${prospectName || 'NULL'}`);
          
          const zipCode = body.values[`quoted_zip_${i+1}`] || null;
          const policyType = body.values[`quoted_policy_type_${i+1}`] || null;
          
          quotedDetails.push({
            submission_id: ins.id,
            household_name: prospectName,
            zip_code: zipCode,
            policy_type: policyType,
            items_quoted: null,
            policies_quoted: null, 
            premium_potential_cents: null,
          });

          quotedHouseholds.push({
            agency_id: agency.id,
            submission_id: ins.id,
            form_template_id: template.id,
            team_member_id: body.teamMemberId,
            work_date: body.workDate || body.submissionDate,
            household_name: prospectName,
            zip: zipCode,
            lead_source: leadSourceRaw,
            is_final: true,
            is_late: isLate,
          });
        }

        if (quotedDetails.length > 0) {
          await supabase
            .from('quoted_household_details')
            .insert(quotedDetails);
            
          await supabase
            .from('quoted_households')
            .insert(quotedHouseholds);
        }
      }
    }

    // Phase 1: Handle sold policy details - create Explorer entries for each
    console.log("💰 Processing sold policy details...");
    const soldDetailsArray = body.values.soldDetails as any[] || [];
    
    if (soldDetailsArray.length > 0) {
      console.log(`💰 Found ${soldDetailsArray.length} sold policy detail(s)`);
      
      const soldDetails = [];
      const soldHouseholdDetails = [];
      
      for (const soldItem of soldDetailsArray) {
        // Convert dollar amounts to cents
        const premiumCents = Math.round(parseFloat(String(soldItem.premiumAmount || 0).replace(/[$,]/g, '')) * 100);
        const commissionCents = Math.round(parseFloat(String(soldItem.commissionAmount || 0).replace(/[$,]/g, '')) * 100);
        
        // Create sold policy detail record
        soldDetails.push({
          submission_id: ins.id,
          policy_holder_name: soldItem.policyHolderName || soldItem.name || null,
          policy_type: soldItem.policyType || 'Unknown',
          premium_amount_cents: premiumCents,
          commission_amount_cents: commissionCents,
          quoted_household_detail_id: soldItem.quotedHouseholdDetailId || null,
        });
        
        // Create separate quoted household detail for Explorer (status='Sold')
        soldHouseholdDetails.push({
          submission_id: ins.id,
          household_name: soldItem.policyHolderName || soldItem.name || null,
          zip_code: soldItem.zipCode || soldItem.zip || null,
          policy_type: soldItem.policyType || null,
          items_quoted: null, // Sold items don't have quoted counts
          policies_quoted: 1, // Each sold detail represents 1 policy
          premium_potential_cents: premiumCents, // Actual premium for sold
        });
      }

      if (soldDetails.length > 0) {
        console.log(`💾 Inserting ${soldDetails.length} sold policy detail(s)`);
        await supabase
          .from('sold_policy_details')
          .insert(soldDetails);
          
        // Create Explorer entries for sold policies  
        await supabase
          .from('quoted_household_details')
          .insert(soldHouseholdDetails);
      }
    } else {
      // Fallback for legacy sold items format
      const soldItems = parseInt(String(body.values.sold_items || '0'));
      if (soldItems > 0) {
        console.log(`💰 Legacy format: creating ${soldItems} sold item(s)`);
        const soldDetails = [];
        const soldHouseholdDetails = [];
        
        for (let i = 0; i < soldItems; i++) {
          const premiumStr = String(body.values[`sold_premium_${i+1}`] || '0');
          const commissionStr = String(body.values[`sold_commission_${i+1}`] || '0');
          
          // Convert dollar amounts to cents
          const premiumCents = Math.round(parseFloat(premiumStr.replace(/[$,]/g, '')) * 100);
          const commissionCents = Math.round(parseFloat(commissionStr.replace(/[$,]/g, '')) * 100);
          
          const policyHolderName = body.values[`sold_policy_holder_${i+1}`] as string || null;
          const policyType = body.values[`sold_policy_type_${i+1}`] as string || 'Unknown';
          
          soldDetails.push({
            submission_id: ins.id,
            policy_holder_name: policyHolderName,
            policy_type: policyType,
            premium_amount_cents: premiumCents,
            commission_amount_cents: commissionCents,
            quoted_household_detail_id: body.values[`sold_quoted_ref_${i+1}`] || null,
          });
          
          // Create Explorer entry for sold policy
          soldHouseholdDetails.push({
            submission_id: ins.id,
            household_name: policyHolderName,
            zip_code: null,
            policy_type: policyType,
            items_quoted: null,
            policies_quoted: 1,
            premium_potential_cents: premiumCents,
          });
        }

        if (soldDetails.length > 0) {
          await supabase
            .from('sold_policy_details')
            .insert(soldDetails);
            
          await supabase
            .from('quoted_household_details') 
            .insert(soldHouseholdDetails);
        }
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

    const quotedDetailsCount = (body.values.quotedDetails as any[])?.length || parseInt(String(body.values.quoted_count || '0'));
    const soldDetailsCount = (body.values.soldDetails as any[])?.length || parseInt(String(body.values.sold_items || '0'));

    console.log("✅ Form submission completed successfully:", {
      submissionId: ins.id,
      quotedProspectsProcessed: quotedDetailsCount,
      soldPoliciesProcessed: soldDetailsCount,
      isLate,
      finalDate
    });

    return json(200, { 
      ok: true, 
      submissionId: ins.id,
      quotedProspectsProcessed: quotedDetailsCount,
      soldPoliciesProcessed: soldDetailsCount,
      isLate
    });
  } catch (e) {
    console.error("💥 Server error in submit_public_form:", e);
    return json(500, { error: 'SERVER_ERROR', detail: 'Internal server error' });
  }
});