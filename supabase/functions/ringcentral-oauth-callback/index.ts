import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);

    // Extract query params
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    const appUrl = Deno.env.get("APP_URL") || "https://agencybrain.io";

    // Handle OAuth errors from RingCentral
    if (error) {
      console.error("[ringcentral-oauth-callback] OAuth error:", error);
      return Response.redirect(`${appUrl}/agency?rc_error=${encodeURIComponent(error)}`);
    }

    // Validate required params
    if (!code || !state) {
      console.error("[ringcentral-oauth-callback] Missing code or state");
      return Response.redirect(`${appUrl}/agency?rc_error=missing_params`);
    }

    // Decode state to get agency_id and user_id
    let stateData: { agency_id: string; user_id: string };
    try {
      stateData = JSON.parse(atob(state));
    } catch (e) {
      console.error("[ringcentral-oauth-callback] Invalid state:", e);
      return Response.redirect(`${appUrl}/agency?rc_error=invalid_state`);
    }

    const { agency_id, user_id } = stateData;

    if (!agency_id || !user_id) {
      console.error("[ringcentral-oauth-callback] Missing agency_id or user_id in state");
      return Response.redirect(`${appUrl}/agency?rc_error=invalid_state`);
    }

    // Get RingCentral credentials
    const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID");
    const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET");
    const redirectUrl = Deno.env.get("RINGCENTRAL_REDIRECT_URL");

    if (!clientId || !clientSecret || !redirectUrl) {
      console.error("[ringcentral-oauth-callback] Missing RingCentral credentials");
      return Response.redirect(`${appUrl}/agency?rc_error=config_error`);
    }

    // Exchange code for tokens
    const tokenResponse = await fetch("https://platform.ringcentral.com/restapi/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUrl,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[ringcentral-oauth-callback] Token exchange failed:", errorText);
      return Response.redirect(`${appUrl}/agency?rc_error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();
    console.log("[ringcentral-oauth-callback] Token exchange successful");

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Fetch RingCentral account info
    let accountId: string | null = null;
    try {
      const accountResponse = await fetch("https://platform.ringcentral.com/restapi/v1.0/account/~", {
        headers: { "Authorization": `Bearer ${tokens.access_token}` },
      });

      if (accountResponse.ok) {
        const accountInfo = await accountResponse.json();
        accountId = accountInfo.id || null;
        console.log("[ringcentral-oauth-callback] Got account ID:", accountId);
      }
    } catch (e) {
      console.error("[ringcentral-oauth-callback] Failed to fetch account info:", e);
      // Continue without account ID - not critical
    }

    // Create service role client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Upsert integration record
    const { error: upsertError } = await supabaseAdmin
      .from("voip_integrations")
      .upsert({
        agency_id: agency_id,
        provider: "ringcentral",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        rc_account_id: accountId,
        is_active: true,
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "agency_id,provider",
      });

    if (upsertError) {
      console.error("[ringcentral-oauth-callback] Database error:", upsertError);
      return Response.redirect(`${appUrl}/agency?rc_error=database_error`);
    }

    console.log(`[ringcentral-oauth-callback] Integration saved for agency: ${agency_id}, user: ${user_id}`);

    // Redirect to success
    return Response.redirect(`${appUrl}/agency?rc_connected=true`);

  } catch (error) {
    console.error("[ringcentral-oauth-callback] Unexpected error:", error);
    const appUrl = Deno.env.get("APP_URL") || "https://agencybrain.io";
    return Response.redirect(`${appUrl}/agency?rc_error=unexpected`);
  }
});
