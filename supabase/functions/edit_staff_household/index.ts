import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-staff-session",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate staff session
    const sessionToken = req.headers.get("x-staff-session");
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: "Missing staff session token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: session, error: sessionError } = await supabase
      .from("staff_sessions")
      .select("staff_user_id, is_valid")
      .eq("session_token", sessionToken)
      .single();

    if (sessionError || !session || !session.is_valid) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get staff user info
    const { data: staffUser, error: staffError } = await supabase
      .from("staff_users")
      .select("agency_id, team_member_id")
      .eq("id", session.staff_user_id)
      .single();

    if (staffError || !staffUser) {
      return new Response(
        JSON.stringify({ error: "Staff user not found" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { household_id, deleted_quote_ids, ...updateFields } = body;

    if (!household_id) {
      return new Response(
        JSON.stringify({ error: "household_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify household belongs to staff user's agency
    const { data: household, error: householdError } = await supabase
      .from("lqs_households")
      .select("id, agency_id, contact_id, first_name, last_name, zip_code, household_key")
      .eq("id", household_id)
      .single();

    if (householdError || !household) {
      return new Response(
        JSON.stringify({ error: "Household not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (household.agency_id !== staffUser.agency_id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: household belongs to a different agency" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete marked quotes first
    if (deleted_quote_ids && deleted_quote_ids.length > 0) {
      const { error: deleteError } = await supabase
        .from("lqs_quotes")
        .delete()
        .in("id", deleted_quote_ids)
        .eq("household_id", household_id);
      if (deleteError) {
        console.error("[edit_staff_household] Failed to delete quotes:", deleteError);
        throw deleteError;
      }
    }

    // Build the household update payload (only include known fields)
    const householdUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const allowedFields = [
      "first_name", "last_name", "phone", "email", "zip_code",
      "team_member_id", "lead_source_id", "objection_id",
      "prior_insurance_company_id", "status", "first_quote_date",
      "household_key",
    ];

    for (const field of allowedFields) {
      if (field in updateFields) {
        householdUpdate[field] = updateFields[field];
      }
    }

    // Regenerate household_key if name or zip changed (must match SQL generate_household_key)
    const newFirst = (updateFields.first_name as string) ?? household.first_name;
    const newLast = (updateFields.last_name as string) ?? household.last_name;
    const newZip = (updateFields.zip_code as string | null) ?? household.zip_code;
    const nameOrZipChanged =
      newFirst !== household.first_name ||
      newLast !== household.last_name ||
      (newZip || "") !== (household.zip_code || "");

    if (nameOrZipChanged) {
      const normLast = (newLast || "UNKNOWN").toUpperCase().replace(/[^A-Z]/g, "");
      const normFirst = (newFirst || "UNKNOWN").toUpperCase().replace(/[^A-Z]/g, "");
      const normZip = newZip ? newZip.substring(0, 5) : "00000";
      householdUpdate.household_key = `${normLast}_${normFirst}_${normZip}`;
    }

    const { error: updateError } = await supabase
      .from("lqs_households")
      .update(householdUpdate)
      .eq("id", household_id);

    if (updateError) {
      console.error("[edit_staff_household] Failed to update household:", updateError);
      throw updateError;
    }

    // Sync changes to linked agency_contacts record
    if (household.contact_id && nameOrZipChanged) {
      const contactUpdate: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if ("first_name" in updateFields) contactUpdate.first_name = updateFields.first_name;
      if ("last_name" in updateFields) contactUpdate.last_name = updateFields.last_name;
      if (householdUpdate.household_key) contactUpdate.household_key = householdUpdate.household_key;

      await supabase
        .from("agency_contacts")
        .update(contactUpdate)
        .eq("id", household.contact_id);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[edit_staff_household] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
