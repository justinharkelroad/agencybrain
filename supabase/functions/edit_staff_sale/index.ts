import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

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
      console.log("[edit_staff_sale] Missing session token");
      return new Response(
        JSON.stringify({ error: "Missing staff session token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate session - staff_sessions uses is_valid column
    const { data: session, error: sessionError } = await supabase
      .from("staff_sessions")
      .select("staff_user_id, is_valid")
      .eq("session_token", sessionToken)
      .single();

    if (sessionError || !session || !session.is_valid) {
      console.log("[edit_staff_sale] Invalid session:", sessionError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get staff user info
    const { data: staffUser, error: staffError } = await supabase
      .from("staff_users")
      .select("agency_id, team_member_id, username")
      .eq("id", session.staff_user_id)
      .single();

    if (staffError || !staffUser) {
      console.log("[edit_staff_sale] Staff user not found:", staffError?.message);
      return new Response(
        JSON.stringify({ error: "Staff user not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { team_member_id } = staffUser;

    if (!team_member_id) {
      return new Response(
        JSON.stringify({ error: "No team member linked to this staff account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { sale_id, customer_name, customer_email, customer_phone, customer_zip, sale_date } = body;

    if (!sale_id) {
      return new Response(
        JSON.stringify({ error: "Missing sale_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the sale belongs to this staff member
    const { data: existingSale, error: saleError } = await supabase
      .from("sales")
      .select("id, team_member_id")
      .eq("id", sale_id)
      .single();

    if (saleError || !existingSale) {
      console.log("[edit_staff_sale] Sale not found:", saleError?.message);
      return new Response(
        JSON.stringify({ error: "Sale not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existingSale.team_member_id !== team_member_id) {
      console.log("[edit_staff_sale] Unauthorized - sale belongs to different team member");
      return new Response(
        JSON.stringify({ error: "You can only edit your own sales" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build update object with only provided fields
    const updateData: Record<string, any> = {};
    if (customer_name !== undefined) updateData.customer_name = customer_name;
    if (customer_email !== undefined) updateData.customer_email = customer_email;
    if (customer_phone !== undefined) updateData.customer_phone = customer_phone;
    if (customer_zip !== undefined) updateData.customer_zip = customer_zip;
    if (sale_date !== undefined) updateData.sale_date = sale_date;

    if (Object.keys(updateData).length === 0) {
      return new Response(
        JSON.stringify({ error: "No fields to update" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Perform the update
    const { data: updatedSale, error: updateError } = await supabase
      .from("sales")
      .update(updateData)
      .eq("id", sale_id)
      .select()
      .single();

    if (updateError) {
      console.error("[edit_staff_sale] Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update sale" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[edit_staff_sale] Sale ${sale_id} updated by staff ${staffUser.username}`);

    return new Response(
      JSON.stringify({ success: true, sale: updatedSale }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[edit_staff_sale] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
