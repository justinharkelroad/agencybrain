import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

function getPolicyTermMonths(productName: string | null): number {
  if (!productName) return 12;
  
  const upper = productName.toUpperCase();
  const sixMonthAutoProducts = [
    'AUTO PRIVATE PASS',
    'AUTO-INDEM',
    'AFCIC-AUTO PRIV PASS',
    'STANDARD AUTO',
  ];
  
  for (const product of sixMonthAutoProducts) {
    if (upper.includes(product)) {
      return 6;
    }
  }
  return 12;
}

function calculateWinbackDate(
  terminationDate: Date,
  policyTermMonths: number,
  contactDaysBefore: number
): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let competitorRenewal = new Date(terminationDate);
  competitorRenewal.setMonth(competitorRenewal.getMonth() + policyTermMonths);

  let winbackDate = new Date(competitorRenewal);
  winbackDate.setDate(winbackDate.getDate() - contactDaysBefore);

  while (winbackDate <= today) {
    competitorRenewal.setMonth(competitorRenewal.getMonth() + policyTermMonths);
    winbackDate = new Date(competitorRenewal);
    winbackDate.setDate(winbackDate.getDate() - contactDaysBefore);
  }

  return winbackDate;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Accept both header names for compatibility
    const staffToken = req.headers.get("x-staff-session") || req.headers.get("x-staff-session-token");
    if (!staffToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing staff session token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate staff session
    const { data: session, error: sessionError } = await supabase
      .from("staff_sessions")
      .select("staff_user_id, expires_at")
      .eq("session_token", staffToken)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (sessionError || !session) {
      console.error("Session validation failed:", sessionError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get staff user details
    const { data: staffUser, error: staffError } = await supabase
      .from("staff_users")
      .select("id, agency_id, team_member_id, username")
      .eq("id", session.staff_user_id)
      .eq("is_active", true)
      .single();

    if (staffError || !staffUser) {
      console.error("Staff user not found:", staffError);
      return new Response(
        JSON.stringify({ success: false, error: "Staff user not found or inactive" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { recordId, contactDaysBefore = 45 } = await req.json();

    if (!recordId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing recordId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch cancel audit record
    const { data: record, error: recordError } = await supabase
      .from("cancel_audit_records")
      .select("*")
      .eq("id", recordId)
      .eq("agency_id", staffUser.agency_id)
      .single();

    if (recordError || !record) {
      console.error("Record not found:", recordError);
      return new Response(
        JSON.stringify({ success: false, error: "Record not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    if (!record.insured_first_name || !record.insured_last_name) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing customer name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const terminationDateStr = record.cancel_date || record.pending_cancel_date;
    if (!terminationDateStr) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing cancel date or pending cancel date" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!record.policy_number) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing policy number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const terminationDate = new Date(terminationDateStr);
    const policyTermMonths = getPolicyTermMonths(record.product_name);
    const winbackDate = calculateWinbackDate(terminationDate, policyTermMonths, contactDaysBefore);

    // Extract zip code
    let zipCode = "00000";
    if (record.household_key) {
      const zipMatch = record.household_key.match(/\d{5}/);
      if (zipMatch) zipCode = zipMatch[0];
    }

    // Check for existing household
    const { data: existingHousehold } = await supabase
      .from("winback_households")
      .select("id")
      .eq("agency_id", record.agency_id)
      .ilike("first_name", record.insured_first_name.trim())
      .ilike("last_name", record.insured_last_name.trim())
      .maybeSingle();

    let householdId: string;

    if (existingHousehold) {
      householdId = existingHousehold.id;
      // Update contact_id if the existing household doesn't have one but the cancel record does
      if (record.contact_id) {
        await supabase
          .from("winback_households")
          .update({ contact_id: record.contact_id })
          .eq("id", householdId)
          .is("contact_id", null);
      }
    } else {
      const { data: newHousehold, error: householdError } = await supabase
        .from("winback_households")
        .insert({
          agency_id: record.agency_id,
          first_name: record.insured_first_name.trim().toUpperCase(),
          last_name: record.insured_last_name.trim().toUpperCase(),
          zip_code: zipCode,
          email: record.insured_email || null,
          phone: record.insured_phone || null,
          status: "untouched",
          contact_id: record.contact_id || null,
        })
        .select("id")
        .single();

      if (householdError) {
        console.error("Household creation failed:", householdError);
        return new Response(
          JSON.stringify({ success: false, error: `Failed to create household: ${householdError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      householdId = newHousehold.id;
    }

    // Check for existing policy
    const { data: existingPolicy } = await supabase
      .from("winback_policies")
      .select("id")
      .eq("agency_id", record.agency_id)
      .eq("policy_number", record.policy_number)
      .maybeSingle();

    if (!existingPolicy) {
      // Create policy
      const premiumNewCents = record.premium_cents || null;

      const { error: policyError } = await supabase
        .from("winback_policies")
        .insert({
          household_id: householdId,
          agency_id: record.agency_id,
          policy_number: record.policy_number,
          agent_number: record.agent_number || null,
          product_name: record.product_name || "Unknown",
          policy_term_months: policyTermMonths,
          termination_effective_date: terminationDateStr,
          termination_reason: "Lost from Cancel Audit",
          premium_new_cents: premiumNewCents,
          premium_old_cents: null,
          premium_change_cents: null,
          premium_change_percent: null,
          calculated_winback_date: winbackDate.toISOString().split("T")[0],
          is_cancel_rewrite: false,
        });

      if (policyError) {
        console.error("Policy creation failed:", policyError);
        return new Response(
          JSON.stringify({ success: false, error: `Failed to create policy: ${policyError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Recalculate aggregates - try RPC first
      const { error: rpcError } = await supabase.rpc("recalculate_winback_household_aggregates", {
        p_household_id: householdId,
      });

      if (rpcError) {
        console.error("Failed to recalc aggregates:", rpcError);
        // Fallback: set earliest_winback_date directly
        await supabase
          .from("winback_households")
          .update({
            earliest_winback_date: winbackDate.toISOString().split("T")[0],
            policy_count: 1,
            total_premium_potential_cents: premiumNewCents || 0,
          })
          .eq("id", householdId);
        console.log("Set earliest_winback_date directly:", winbackDate.toISOString().split("T")[0]);
      }
    } else {
      // Policy exists - still recalculate to ensure earliest_winback_date is set
      await supabase.rpc("recalculate_winback_household_aggregates", {
        p_household_id: householdId,
      }).catch(e => console.error("Failed to recalc for existing policy:", e));
    }

    // Update cancel audit record
    const { error: updateError } = await supabase
      .from("cancel_audit_records")
      .update({
        winback_household_id: householdId,
        sent_to_winback_at: new Date().toISOString(),
      })
      .eq("id", record.id);

    if (updateError) {
      console.error("Record update failed:", updateError);
    }

    // Get staff display name for activity log
    let displayName = staffUser.username;
    if (staffUser.team_member_id) {
      const { data: teamMember } = await supabase
        .from("team_members")
        .select("name")
        .eq("id", staffUser.team_member_id)
        .single();
      if (teamMember?.name) {
        displayName = teamMember.name;
      }
    }

    // Log activity
    const { error: activityError } = await supabase
      .from("cancel_audit_activities")
      .insert({
        record_id: record.id,
        agency_id: record.agency_id,
        household_key: record.household_key,
        activity_type: "note",
        notes: `Sent to Win-Back (householdId: ${householdId})`,
        user_display_name: displayName,
        staff_member_id: staffUser.team_member_id,
      });

    if (activityError) {
      console.error("Activity log failed:", activityError);
    }

    console.log(`Successfully sent cancel audit ${recordId} to winback household ${householdId}`);

    return new Response(
      JSON.stringify({ success: true, householdId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
