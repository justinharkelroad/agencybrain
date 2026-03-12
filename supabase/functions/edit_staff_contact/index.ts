import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { generateHouseholdKey } from "../_shared/householdKey.ts";

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
      .select("agency_id")
      .eq("id", session.staff_user_id)
      .single();

    if (staffError || !staffUser) {
      return new Response(
        JSON.stringify({ error: "Staff user not found" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { contact_id, first_name, last_name, phones, emails, zip_code } = body;

    if (!contact_id) {
      return new Response(
        JSON.stringify({ error: "contact_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify contact belongs to staff user's agency
    const { data: contact, error: contactError } = await supabase
      .from("agency_contacts")
      .select("id, agency_id, first_name, last_name, zip_code")
      .eq("id", contact_id)
      .single();

    if (contactError || !contact) {
      return new Response(
        JSON.stringify({ error: "Contact not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (contact.agency_id !== staffUser.agency_id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: contact belongs to a different agency" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Regenerate household_key if name or zip changed (must match SQL generate_household_key)
    const newFirst = first_name ?? contact.first_name;
    const newLast = last_name ?? contact.last_name;
    const newZip = zip_code !== undefined ? zip_code : contact.zip_code;
    const nameOrZipChanged =
      newFirst !== contact.first_name ||
      newLast !== contact.last_name ||
      (newZip || "") !== (contact.zip_code || "");

    let newHouseholdKey: string | undefined;
    if (nameOrZipChanged) {
      newHouseholdKey = generateHouseholdKey(newFirst, newLast, newZip);
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (first_name !== undefined) updatePayload.first_name = first_name;
    if (last_name !== undefined) updatePayload.last_name = last_name;
    if (phones !== undefined) updatePayload.phones = phones;
    if (emails !== undefined) updatePayload.emails = emails;
    if (zip_code !== undefined) updatePayload.zip_code = zip_code;
    if (newHouseholdKey) updatePayload.household_key = newHouseholdKey;

    const { error: updateError } = await supabase
      .from("agency_contacts")
      .update(updatePayload)
      .eq("id", contact_id);

    if (updateError) {
      console.error("[edit_staff_contact] Failed to update contact:", updateError);
      throw updateError;
    }

    // Sync name/key changes to any linked lqs_households
    if (nameOrZipChanged) {
      const householdUpdate: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (first_name !== undefined) householdUpdate.first_name = first_name;
      if (last_name !== undefined) householdUpdate.last_name = last_name;
      if (newHouseholdKey) householdUpdate.household_key = newHouseholdKey;

      await supabase
        .from("lqs_households")
        .update(householdUpdate)
        .eq("contact_id", contact_id);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[edit_staff_contact] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
