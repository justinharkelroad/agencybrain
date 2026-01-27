import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth check - user must be logged in
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user client for auth
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's agency_id from profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("agency_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.agency_id) {
      return new Response(JSON.stringify({ error: "No agency found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get RingCentral config from environment
    const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID");
    const redirectUrl = Deno.env.get("RINGCENTRAL_REDIRECT_URL");

    if (!clientId || !redirectUrl) {
      console.error("[ringcentral-oauth-init] Missing RINGCENTRAL_CLIENT_ID or RINGCENTRAL_REDIRECT_URL");
      return new Response(JSON.stringify({ error: "RingCentral integration not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Encode agency_id and user_id in state parameter (base64)
    const state = btoa(JSON.stringify({
      agency_id: profile.agency_id,
      user_id: user.id
    }));

    // Build RingCentral OAuth URL
    const authUrl = new URL("https://platform.ringcentral.com/restapi/oauth/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUrl);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", "ReadCallLog");

    console.log(`[ringcentral-oauth-init] Generated OAuth URL for user ${user.id}, agency ${profile.agency_id}`);

    return new Response(JSON.stringify({ auth_url: authUrl.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[ringcentral-oauth-init] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
