import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-staff-session",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sessionToken = req.headers.get("x-staff-session");
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: "Missing staff session token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate session (must be valid + not expired)
    const nowISO = new Date().toISOString();
    const { data: session, error: sessionError } = await supabase
      .from("staff_sessions")
      .select("staff_user_id, expires_at, is_valid")
      .eq("session_token", sessionToken)
      .eq("is_valid", true)
      .gt("expires_at", nowISO)
      .maybeSingle();

    if (sessionError || !session) {
      console.error("[get_staff_sale_details] Invalid session:", sessionError);
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: staffUser, error: staffError } = await supabase
      .from("staff_users")
      .select("id, agency_id, team_member_id")
      .eq("id", session.staff_user_id)
      .single();

    if (staffError || !staffUser?.team_member_id) {
      console.error("[get_staff_sale_details] Staff user not found:", staffError);
      return new Response(JSON.stringify({ error: "Staff user not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { sale_id } = body;

    if (!sale_id) {
      return new Response(JSON.stringify({ error: "Missing sale_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Query sale scoped to the staff user's agency (allows viewing all agency sales)
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select(
        `
        id,
        sale_date,
        customer_name,
        customer_email,
        customer_phone,
        customer_zip,
        total_premium,
        total_items,
        total_points,
        team_member_id,
        lead_source_id,
        is_vc_qualifying,
        is_bundle,
        bundle_type,
        team_member:team_members(name),
        sale_policies(
          id,
          policy_type_name,
          policy_number,
          effective_date,
          total_premium,
          total_items,
          total_points,
          is_vc_qualifying,
          sale_items(
            id,
            product_type_name,
            item_count,
            premium,
            points,
            is_vc_qualifying
          )
        )
      `
      )
      .eq("id", sale_id)
      .eq("agency_id", staffUser.agency_id)
      .single();

    if (saleError || !sale) {
      console.error("[get_staff_sale_details] Sale not found:", saleError);
      return new Response(JSON.stringify({ error: "Sale not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine if user can edit (only their own sales)
    const canEdit = sale.team_member_id === staffUser.team_member_id;

    return new Response(JSON.stringify({ success: true, sale, can_edit: canEdit }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[get_staff_sale_details] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
