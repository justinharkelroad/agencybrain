import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tokenRow, error } = await supabaseAdmin
      .from("onboarding_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (error || !tokenRow) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid token" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if already used
    if (tokenRow.status === "used") {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "This onboarding link has already been used",
          used_at: tokenRow.used_at,
        }),
        {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check expiration
    if (new Date(tokenRow.expires_at) < new Date()) {
      // Mark as expired
      await supabaseAdmin
        .from("onboarding_tokens")
        .update({ status: "expired" })
        .eq("id", tokenRow.id);

      return new Response(
        JSON.stringify({ valid: false, error: "This onboarding link has expired" }),
        {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        valid: true,
        email: tokenRow.email,
        agency_name: tokenRow.agency_name,
        tier: tokenRow.tier,
        metadata: tokenRow.metadata,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("validate-onboarding-token error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
