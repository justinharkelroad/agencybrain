import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyRequest, isVerifyError } from "../_shared/verifyRequest.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const verified = await verifyRequest(req);
    if (isVerifyError(verified)) {
      return new Response(JSON.stringify({ error: verified.error }), {
        status: verified.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (verified.mode !== "supabase" || !verified.userId) {
      return new Response(JSON.stringify({ error: "Owner/admin authentication required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await admin.rpc("upsert_admin_sale_transaction", {
      p_user_id: verified.userId,
      p_agency_id: verified.agencyId,
      p_payload: body,
    });

    if (error) {
      console.error("[upsert_admin_sale] RPC failed:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Failed to save sale" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const result = data as {
      success?: boolean;
      sale_id?: string;
      is_update?: boolean;
      household_id?: string;
      policy_count?: number;
      linked_lqs_sale_count?: number;
      lead_source_id?: string | null;
      lead_source_name?: string | null;
    } | null;

    console.log("[upsert_admin_sale] Saved sale:", {
      sale_id: result?.sale_id,
      is_update: result?.is_update,
      agency_id: verified.agencyId,
      household_id: result?.household_id,
      policy_count: result?.policy_count,
      linked_lqs_sale_count: result?.linked_lqs_sale_count,
      lead_source_id: result?.lead_source_id,
      lead_source_name: result?.lead_source_name,
    });

    if (result?.sale_id && !result?.is_update) {
      fetch(`${supabaseUrl}/functions/v1/send-sale-notification`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sale_id: result.sale_id,
          agency_id: verified.agencyId,
        }),
      }).catch((notificationError) => {
        console.error("[upsert_admin_sale] Sale notification failed:", notificationError);
      });
    }

    return new Response(JSON.stringify(result || { success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[upsert_admin_sale] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to save sale" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
