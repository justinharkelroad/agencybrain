# RingCentral Call Sync Integration Spec

## Overview

Build a complete RingCentral integration for Agency Brain that:
1. Allows agency owners to connect their RingCentral account via OAuth
2. Syncs call logs every 15 minutes automatically
3. Displays call metrics on dashboards (total calls, talk time, inbound/outbound)
4. Matches phone numbers to prospects and logs calls in activity timelines
5. Works for ALL user types: owners, key employees, managers, and staff portal users

## Critical Architecture Notes

- **Staff Portal users authenticate via session tokens, NOT Supabase Auth**
- Staff need RPC functions (SECURITY DEFINER) to access call data
- Only agency owners can connect/disconnect RingCentral
- All agency users can VIEW the call data once connected

---

## Phase 1: Database Migration

**File:** `supabase/migrations/20260126_voip_integration.sql`

```sql
-- VOIP Integration Tables for RingCentral (and future Ricochet)

-- Agency-level VOIP provider configurations
CREATE TABLE IF NOT EXISTS voip_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('ringcentral', 'ricochet')),
  
  -- OAuth tokens (encrypted at rest by Supabase)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- RingCentral-specific
  rc_account_id TEXT,
  
  -- Ricochet-specific (for future)
  external_account_id TEXT,
  webhook_secret TEXT,
  
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(agency_id, provider)
);

-- Incoming call events from any provider
CREATE TABLE IF NOT EXISTS call_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  voip_integration_id UUID REFERENCES voip_integrations(id) ON DELETE SET NULL,
  
  external_call_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('ringcentral', 'ricochet')),
  
  direction TEXT CHECK (direction IN ('Inbound', 'Outbound')),
  call_type TEXT,
  
  from_number TEXT,
  to_number TEXT,
  
  call_started_at TIMESTAMPTZ,
  call_ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  
  result TEXT,
  
  extension_id TEXT,
  extension_name TEXT,
  
  matched_team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  matched_prospect_id UUID REFERENCES quoted_household_details(id) ON DELETE SET NULL,
  
  raw_payload JSONB,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(provider, external_call_id)
);

-- Daily aggregated call metrics per team member
CREATE TABLE IF NOT EXISTS call_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  total_calls INTEGER DEFAULT 0,
  inbound_calls INTEGER DEFAULT 0,
  outbound_calls INTEGER DEFAULT 0,
  answered_calls INTEGER DEFAULT 0,
  missed_calls INTEGER DEFAULT 0,
  total_talk_seconds INTEGER DEFAULT 0,
  
  last_calculated_at TIMESTAMPTZ DEFAULT now(),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(agency_id, team_member_id, date)
);

-- Contact activity timeline
CREATE TABLE IF NOT EXISTS contact_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  
  contact_type TEXT NOT NULL CHECK (contact_type IN ('prospect', 'customer', 'lead')),
  prospect_id UUID REFERENCES quoted_household_details(id) ON DELETE CASCADE,
  
  activity_type TEXT NOT NULL,
  activity_source TEXT,
  
  call_event_id UUID REFERENCES call_events(id) ON DELETE SET NULL,
  
  title TEXT,
  description TEXT,
  metadata JSONB,
  
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_voip_integrations_agency ON voip_integrations(agency_id);
CREATE INDEX idx_call_events_agency ON call_events(agency_id);
CREATE INDEX idx_call_events_started ON call_events(call_started_at DESC);
CREATE INDEX idx_call_events_from ON call_events(from_number);
CREATE INDEX idx_call_events_to ON call_events(to_number);
CREATE INDEX idx_call_metrics_daily_lookup ON call_metrics_daily(agency_id, date DESC);
CREATE INDEX idx_call_metrics_daily_member ON call_metrics_daily(team_member_id, date DESC);
CREATE INDEX idx_contact_activities_prospect ON contact_activities(prospect_id, occurred_at DESC);
CREATE INDEX idx_contact_activities_agency ON contact_activities(agency_id, occurred_at DESC);

-- RLS Policies
ALTER TABLE voip_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members view voip_integrations"
  ON voip_integrations FOR SELECT
  USING (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Agency owners manage voip_integrations"
  ON voip_integrations FOR ALL
  USING (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Agency members view call_events"
  ON call_events FOR SELECT
  USING (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Agency members view call_metrics_daily"
  ON call_metrics_daily FOR SELECT
  USING (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Agency members view contact_activities"
  ON contact_activities FOR SELECT
  USING (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()));
```

---

## Phase 2: Staff Portal RPC Functions

**Add to the same migration file:**

```sql
-- =============================================
-- RPC FUNCTIONS FOR STAFF PORTAL ACCESS
-- Staff authenticate via session tokens, not Supabase Auth
-- =============================================

CREATE OR REPLACE FUNCTION get_staff_call_metrics(
  p_team_member_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_calls INTEGER,
  inbound_calls INTEGER,
  outbound_calls INTEGER,
  answered_calls INTEGER,
  missed_calls INTEGER,
  total_talk_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agency_id UUID;
BEGIN
  SELECT agency_id INTO v_agency_id
  FROM team_members
  WHERE id = p_team_member_id;

  IF v_agency_id IS NULL THEN
    RAISE EXCEPTION 'Team member not found';
  END IF;

  RETURN QUERY
  SELECT 
    COALESCE(cmd.total_calls, 0)::INTEGER,
    COALESCE(cmd.inbound_calls, 0)::INTEGER,
    COALESCE(cmd.outbound_calls, 0)::INTEGER,
    COALESCE(cmd.answered_calls, 0)::INTEGER,
    COALESCE(cmd.missed_calls, 0)::INTEGER,
    COALESCE(cmd.total_talk_seconds, 0)::INTEGER
  FROM call_metrics_daily cmd
  WHERE cmd.team_member_id = p_team_member_id
    AND cmd.date = p_date;
END;
$$;

CREATE OR REPLACE FUNCTION get_agency_call_metrics(
  p_team_member_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  team_member_id UUID,
  team_member_name TEXT,
  total_calls INTEGER,
  inbound_calls INTEGER,
  outbound_calls INTEGER,
  answered_calls INTEGER,
  missed_calls INTEGER,
  total_talk_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agency_id UUID;
BEGIN
  SELECT agency_id INTO v_agency_id
  FROM team_members
  WHERE id = p_team_member_id;

  IF v_agency_id IS NULL THEN
    RAISE EXCEPTION 'Team member not found';
  END IF;

  RETURN QUERY
  SELECT 
    tm.id AS team_member_id,
    tm.name AS team_member_name,
    COALESCE(cmd.total_calls, 0)::INTEGER,
    COALESCE(cmd.inbound_calls, 0)::INTEGER,
    COALESCE(cmd.outbound_calls, 0)::INTEGER,
    COALESCE(cmd.answered_calls, 0)::INTEGER,
    COALESCE(cmd.missed_calls, 0)::INTEGER,
    COALESCE(cmd.total_talk_seconds, 0)::INTEGER
  FROM team_members tm
  LEFT JOIN call_metrics_daily cmd 
    ON cmd.team_member_id = tm.id 
    AND cmd.date = p_date
  WHERE tm.agency_id = v_agency_id
    AND tm.status = 'active'
  ORDER BY COALESCE(cmd.total_calls, 0) DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_contact_activities(
  p_team_member_id UUID,
  p_prospect_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  contact_type TEXT,
  prospect_id UUID,
  activity_type TEXT,
  activity_source TEXT,
  title TEXT,
  description TEXT,
  metadata JSONB,
  occurred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agency_id UUID;
BEGIN
  SELECT agency_id INTO v_agency_id
  FROM team_members
  WHERE id = p_team_member_id;

  IF v_agency_id IS NULL THEN
    RAISE EXCEPTION 'Team member not found';
  END IF;

  RETURN QUERY
  SELECT 
    ca.id,
    ca.contact_type,
    ca.prospect_id,
    ca.activity_type,
    ca.activity_source,
    ca.title,
    ca.description,
    ca.metadata,
    ca.occurred_at,
    ca.created_at
  FROM contact_activities ca
  WHERE ca.agency_id = v_agency_id
    AND (p_prospect_id IS NULL OR ca.prospect_id = p_prospect_id)
  ORDER BY ca.occurred_at DESC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION get_call_events(
  p_team_member_id UUID,
  p_date DATE DEFAULT CURRENT_DATE,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  direction TEXT,
  call_type TEXT,
  from_number TEXT,
  to_number TEXT,
  call_started_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  result TEXT,
  extension_name TEXT,
  matched_team_member_id UUID,
  matched_prospect_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agency_id UUID;
BEGIN
  SELECT agency_id INTO v_agency_id
  FROM team_members
  WHERE id = p_team_member_id;

  IF v_agency_id IS NULL THEN
    RAISE EXCEPTION 'Team member not found';
  END IF;

  RETURN QUERY
  SELECT 
    ce.id,
    ce.direction,
    ce.call_type,
    ce.from_number,
    ce.to_number,
    ce.call_started_at,
    ce.duration_seconds,
    ce.result,
    ce.extension_name,
    ce.matched_team_member_id,
    ce.matched_prospect_id
  FROM call_events ce
  WHERE ce.agency_id = v_agency_id
    AND ce.call_started_at::DATE = p_date
  ORDER BY ce.call_started_at DESC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION get_agency_voip_status(
  p_team_member_id UUID
)
RETURNS TABLE (
  provider TEXT,
  is_active BOOLEAN,
  last_sync_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agency_id UUID;
BEGIN
  SELECT agency_id INTO v_agency_id
  FROM team_members
  WHERE id = p_team_member_id;

  IF v_agency_id IS NULL THEN
    RAISE EXCEPTION 'Team member not found';
  END IF;

  RETURN QUERY
  SELECT 
    vi.provider,
    vi.is_active,
    vi.last_sync_at
  FROM voip_integrations vi
  WHERE vi.agency_id = v_agency_id;
END;
$$;
```

---

## Phase 3: Edge Function - OAuth Initiation

**File:** `supabase/functions/ringcentral-oauth-init/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("agency_id")
      .eq("id", user.id)
      .single();

    if (!profile?.agency_id) {
      return new Response(JSON.stringify({ error: "No agency found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID");
    const redirectUrl = Deno.env.get("RINGCENTRAL_REDIRECT_URL");
    
    const state = btoa(JSON.stringify({ agency_id: profile.agency_id, user_id: user.id }));

    const authUrl = new URL("https://platform.ringcentral.com/restapi/oauth/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId!);
    authUrl.searchParams.set("redirect_uri", redirectUrl!);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", "ReadCallLog");

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
```

---

## Phase 4: Edge Function - OAuth Callback

**File:** `supabase/functions/ringcentral-oauth-callback/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("[ringcentral-oauth-callback] OAuth error:", error);
      return Response.redirect(`${Deno.env.get("APP_URL")}/agency?rc_error=${error}`);
    }

    if (!code || !state) {
      return Response.redirect(`${Deno.env.get("APP_URL")}/agency?rc_error=missing_params`);
    }

    const { agency_id, user_id } = JSON.parse(atob(state));

    const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID");
    const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET");
    const redirectUrl = Deno.env.get("RINGCENTRAL_REDIRECT_URL");

    const tokenResponse = await fetch("https://platform.ringcentral.com/restapi/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUrl!,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[ringcentral-oauth-callback] Token exchange failed:", errorText);
      return Response.redirect(`${Deno.env.get("APP_URL")}/agency?rc_error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();
    console.log("[ringcentral-oauth-callback] Token exchange successful");

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const accountResponse = await fetch("https://platform.ringcentral.com/restapi/v1.0/account/~", {
      headers: { "Authorization": `Bearer ${tokens.access_token}` },
    });
    
    const accountInfo = accountResponse.ok ? await accountResponse.json() : null;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { error: upsertError } = await supabaseAdmin
      .from("voip_integrations")
      .upsert({
        agency_id: agency_id,
        provider: "ringcentral",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        rc_account_id: accountInfo?.id || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "agency_id,provider",
      });

    if (upsertError) {
      console.error("[ringcentral-oauth-callback] Database error:", upsertError);
      return Response.redirect(`${Deno.env.get("APP_URL")}/agency?rc_error=database_error`);
    }

    console.log("[ringcentral-oauth-callback] Integration saved for agency:", agency_id);

    return Response.redirect(`${Deno.env.get("APP_URL")}/agency?rc_connected=true`);

  } catch (error) {
    console.error("[ringcentral-oauth-callback] Error:", error);
    return Response.redirect(`${Deno.env.get("APP_URL")}/agency?rc_error=unexpected`);
  }
});
```

---

## Phase 5: Edge Function - Sync Call Logs

**File:** `supabase/functions/ringcentral-sync-calls/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.substring(1) : digits;
}

async function refreshTokenIfNeeded(
  supabase: any,
  integration: any
): Promise<string | null> {
  const now = new Date();
  const expiresAt = new Date(integration.token_expires_at);
  
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return integration.access_token;
  }

  console.log("[ringcentral-sync] Refreshing token for agency:", integration.agency_id);

  const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID");
  const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET");

  const response = await fetch("https://platform.ringcentral.com/restapi/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: integration.refresh_token,
    }),
  });

  if (!response.ok) {
    console.error("[ringcentral-sync] Token refresh failed");
    await supabase
      .from("voip_integrations")
      .update({ is_active: false, last_sync_error: "Token refresh failed" })
      .eq("id", integration.id);
    return null;
  }

  const tokens = await response.json();
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabase
    .from("voip_integrations")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id);

  return tokens.access_token;
}

async function syncAgencyCalls(supabase: any, integration: any) {
  const accessToken = await refreshTokenIfNeeded(supabase, integration);
  if (!accessToken) return;

  const since = integration.last_sync_at 
    ? new Date(integration.last_sync_at)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);

  console.log("[ringcentral-sync] Fetching calls since:", since.toISOString());

  let page = 1;
  let hasMore = true;
  let totalSynced = 0;

  while (hasMore) {
    const callLogUrl = new URL("https://platform.ringcentral.com/restapi/v1.0/account/~/call-log");
    callLogUrl.searchParams.set("dateFrom", since.toISOString());
    callLogUrl.searchParams.set("perPage", "250");
    callLogUrl.searchParams.set("page", page.toString());
    callLogUrl.searchParams.set("view", "Detailed");

    const response = await fetch(callLogUrl.toString(), {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ringcentral-sync] API error:", errorText);
      await supabase
        .from("voip_integrations")
        .update({ last_sync_error: `API error: ${response.status}` })
        .eq("id", integration.id);
      return;
    }

    const data = await response.json();
    const calls = data.records || [];

    for (const call of calls) {
      const fromNumber = call.from?.phoneNumber ? normalizePhone(call.from.phoneNumber) : null;
      const toNumber = call.to?.phoneNumber ? normalizePhone(call.to.phoneNumber) : null;
      
      const { error: insertError } = await supabase
        .from("call_events")
        .upsert({
          agency_id: integration.agency_id,
          voip_integration_id: integration.id,
          external_call_id: call.id,
          provider: "ringcentral",
          direction: call.direction,
          call_type: call.type,
          from_number: fromNumber,
          to_number: toNumber,
          call_started_at: call.startTime,
          call_ended_at: call.endTime,
          duration_seconds: call.duration || 0,
          result: call.result,
          extension_id: call.extension?.id,
          extension_name: call.extension?.name,
          raw_payload: call,
        }, {
          onConflict: "provider,external_call_id",
          ignoreDuplicates: true,
        });

      if (!insertError) {
        totalSynced++;
      }
    }

    hasMore = data.paging?.page < data.paging?.totalPages;
    page++;

    if (hasMore) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  await supabase
    .from("voip_integrations")
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_error: null,
    })
    .eq("id", integration.id);

  console.log(`[ringcentral-sync] Synced ${totalSynced} calls for agency:`, integration.agency_id);
}

async function aggregateDailyMetrics(supabase: any, agencyId: string) {
  const today = new Date().toISOString().split("T")[0];
  
  const { data: calls } = await supabase
    .from("call_events")
    .select("direction, duration_seconds, result, extension_name, matched_team_member_id")
    .eq("agency_id", agencyId)
    .gte("call_started_at", `${today}T00:00:00Z`)
    .lt("call_started_at", `${today}T23:59:59Z`);

  if (!calls?.length) return;

  const metrics: Record<string, any> = {};
  
  for (const call of calls) {
    const key = call.matched_team_member_id || `ext_${call.extension_name}` || "unknown";
    
    if (!metrics[key]) {
      metrics[key] = {
        team_member_id: call.matched_team_member_id,
        total_calls: 0,
        inbound_calls: 0,
        outbound_calls: 0,
        answered_calls: 0,
        missed_calls: 0,
        total_talk_seconds: 0,
      };
    }
    
    metrics[key].total_calls++;
    if (call.direction === "Inbound") metrics[key].inbound_calls++;
    if (call.direction === "Outbound") metrics[key].outbound_calls++;
    if (call.result === "Accepted" || call.result === "Call connected") metrics[key].answered_calls++;
    if (call.result === "Missed") metrics[key].missed_calls++;
    metrics[key].total_talk_seconds += call.duration_seconds || 0;
  }

  for (const [key, data] of Object.entries(metrics)) {
    if (data.team_member_id) {
      await supabase
        .from("call_metrics_daily")
        .upsert({
          agency_id: agencyId,
          team_member_id: data.team_member_id,
          date: today,
          ...data,
          last_calculated_at: new Date().toISOString(),
        }, {
          onConflict: "agency_id,team_member_id,date",
        });
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: integrations, error } = await supabaseAdmin
      .from("voip_integrations")
      .select("*")
      .eq("provider", "ringcentral")
      .eq("is_active", true);

    if (error) throw error;

    console.log(`[ringcentral-sync] Processing ${integrations?.length || 0} integrations`);

    for (const integration of integrations || []) {
      try {
        await syncAgencyCalls(supabaseAdmin, integration);
        await aggregateDailyMetrics(supabaseAdmin, integration.agency_id);
      } catch (err) {
        console.error(`[ringcentral-sync] Error for agency ${integration.agency_id}:`, err);
      }
    }

    return new Response(JSON.stringify({ success: true, processed: integrations?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[ringcentral-sync] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

---

## Phase 6: Supabase Secrets

Run these commands:

```bash
supabase secrets set RINGCENTRAL_CLIENT_ID=dNoiuVPp99CeIr3hRx1Qp3
supabase secrets set RINGCENTRAL_CLIENT_SECRET=<your-secret-here>
supabase secrets set RINGCENTRAL_REDIRECT_URL=https://zsjbgpkxhsqbpwmsjyet.supabase.co/functions/v1/ringcentral-oauth-callback
supabase secrets set APP_URL=https://agencybrain.io
```

---

## Phase 7: UI Component - RingCentral Connect (Owner Only)

**File:** `src/components/RingCentralConnect.tsx`

```tsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';

interface VoipIntegration {
  id: string;
  provider: string;
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_error: string | null;
  created_at: string;
}

export function RingCentralConnect() {
  const [integration, setIntegration] = useState<VoipIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchIntegration();
    
    if (searchParams.get('rc_connected') === 'true') {
      toast.success('RingCentral connected successfully!');
      searchParams.delete('rc_connected');
      setSearchParams(searchParams);
      fetchIntegration();
    }
    if (searchParams.get('rc_error')) {
      toast.error(`RingCentral connection failed: ${searchParams.get('rc_error')}`);
      searchParams.delete('rc_error');
      setSearchParams(searchParams);
    }
  }, []);

  const fetchIntegration = async () => {
    try {
      const { data, error } = await supabase
        .from('voip_integrations')
        .select('*')
        .eq('provider', 'ringcentral')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setIntegration(data);
    } catch (error) {
      console.error('Error fetching integration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('ringcentral-oauth-init');
      if (error) throw error;
      window.location.href = data.auth_url;
    } catch (error: any) {
      toast.error(error.message || 'Failed to initiate connection');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect RingCentral? Call syncing will stop.')) return;
    
    try {
      const { error } = await supabase
        .from('voip_integrations')
        .update({ is_active: false })
        .eq('provider', 'ringcentral');

      if (error) throw error;
      
      toast.success('RingCentral disconnected');
      fetchIntegration();
    } catch (error: any) {
      toast.error(error.message || 'Failed to disconnect');
    }
  };

  const handleManualSync = async () => {
    try {
      toast.info('Starting sync...');
      const { error } = await supabase.functions.invoke('ringcentral-sync-calls');
      if (error) throw error;
      toast.success('Sync completed!');
      fetchIntegration();
    } catch (error: any) {
      toast.error(error.message || 'Sync failed');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Phone className="h-6 w-6 text-orange-500" />
            <div>
              <CardTitle>RingCentral</CardTitle>
              <CardDescription>Sync call logs for performance tracking</CardDescription>
            </div>
          </div>
          {integration?.is_active && (
            <Badge variant="default" className="bg-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {integration?.is_active ? (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {integration.last_sync_at ? (
                <p>Last synced: {new Date(integration.last_sync_at).toLocaleString()}</p>
              ) : (
                <p>Never synced</p>
              )}
              {integration.last_sync_error && (
                <p className="text-red-500 mt-1">Error: {integration.last_sync_error}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleManualSync}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Now
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={handleConnect} disabled={connecting}>
            {connecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Phone className="h-4 w-4 mr-2" />
                Connect RingCentral
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## Phase 8: Call Metrics Summary Component (Works for ALL users)

**File:** `src/components/CallMetricsSummary.tsx`

```tsx
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, PhoneIncoming, PhoneOutgoing, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

interface CallMetricsSummaryProps {
  teamMemberId?: string;
  date?: string;
  isStaffUser?: boolean;
  staffTeamMemberId?: string;
}

export function CallMetricsSummary({ 
  teamMemberId, 
  date,
  isStaffUser = false,
  staffTeamMemberId
}: CallMetricsSummaryProps) {
  const targetDate = date || new Date().toISOString().split('T')[0];

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['call-metrics', teamMemberId, targetDate, isStaffUser, staffTeamMemberId],
    queryFn: async () => {
      if (isStaffUser && staffTeamMemberId) {
        if (teamMemberId) {
          const { data, error } = await supabase.rpc('get_staff_call_metrics', {
            p_team_member_id: teamMemberId,
            p_date: targetDate
          });
          if (error) throw error;
          return data?.[0] || null;
        } else {
          const { data, error } = await supabase.rpc('get_agency_call_metrics', {
            p_team_member_id: staffTeamMemberId,
            p_date: targetDate
          });
          if (error) throw error;
          
          if (data && data.length > 0) {
            return data.reduce((acc: any, row: any) => ({
              total_calls: acc.total_calls + row.total_calls,
              inbound_calls: acc.inbound_calls + row.inbound_calls,
              outbound_calls: acc.outbound_calls + row.outbound_calls,
              answered_calls: acc.answered_calls + row.answered_calls,
              total_talk_seconds: acc.total_talk_seconds + row.total_talk_seconds,
            }), {
              total_calls: 0,
              inbound_calls: 0,
              outbound_calls: 0,
              answered_calls: 0,
              total_talk_seconds: 0,
            });
          }
          return null;
        }
      } else {
        let query = supabase
          .from('call_metrics_daily')
          .select('*')
          .eq('date', targetDate);
        
        if (teamMemberId) {
          query = query.eq('team_member_id', teamMemberId);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (!teamMemberId && data) {
          return data.reduce((acc, row) => ({
            total_calls: acc.total_calls + row.total_calls,
            inbound_calls: acc.inbound_calls + row.inbound_calls,
            outbound_calls: acc.outbound_calls + row.outbound_calls,
            answered_calls: acc.answered_calls + row.answered_calls,
            total_talk_seconds: acc.total_talk_seconds + row.total_talk_seconds,
          }), {
            total_calls: 0,
            inbound_calls: 0,
            outbound_calls: 0,
            answered_calls: 0,
            total_talk_seconds: 0,
          });
        }

        return data?.[0] || null;
      }
    },
  });

  if (isLoading) {
    return <div className="animate-pulse h-24 bg-muted rounded-lg" />;
  }

  if (!metrics || metrics.total_calls === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          No call data for {targetDate}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Total Calls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.total_calls}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <PhoneIncoming className="h-4 w-4 text-green-500" />
            Inbound
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.inbound_calls}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <PhoneOutgoing className="h-4 w-4 text-blue-500" />
            Outbound
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.outbound_calls}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-500" />
            Talk Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatDuration(metrics.total_talk_seconds)}</div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Phase 9: Prospect Activity Timeline Component (Works for ALL users)

**File:** `src/components/ProspectActivityTimeline.tsx`

```tsx
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface ProspectActivityTimelineProps {
  prospectId: string;
  isStaffUser?: boolean;
  staffTeamMemberId?: string;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'call_inbound':
      return <PhoneIncoming className="h-4 w-4 text-green-500" />;
    case 'call_outbound':
      return <PhoneOutgoing className="h-4 w-4 text-blue-500" />;
    case 'call_missed':
      return <PhoneMissed className="h-4 w-4 text-red-500" />;
    default:
      return <Phone className="h-4 w-4 text-muted-foreground" />;
  }
}

export function ProspectActivityTimeline({ 
  prospectId,
  isStaffUser = false,
  staffTeamMemberId
}: ProspectActivityTimelineProps) {
  const { data: activities, isLoading } = useQuery({
    queryKey: ['prospect-activities', prospectId, isStaffUser, staffTeamMemberId],
    queryFn: async () => {
      if (isStaffUser && staffTeamMemberId) {
        const { data, error } = await supabase.rpc('get_contact_activities', {
          p_team_member_id: staffTeamMemberId,
          p_prospect_id: prospectId,
          p_limit: 50
        });
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('contact_activities')
          .select('*')
          .eq('prospect_id', prospectId)
          .order('occurred_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        return data;
      }
    },
    enabled: !!prospectId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No activity recorded yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Activity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity: any) => (
            <div 
              key={activity.id} 
              className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0"
            >
              <div className="mt-1">
                {getActivityIcon(activity.activity_type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{activity.title}</span>
                  {activity.activity_source && (
                    <Badge variant="outline" className="text-xs">
                      {activity.activity_source}
                    </Badge>
                  )}
                </div>
                {activity.description && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {activity.description}
                  </p>
                )}
                {activity.metadata?.duration_seconds && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Duration: {formatDuration(activity.metadata.duration_seconds)}
                  </p>
                )}
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(activity.occurred_at), { addSuffix: true })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Phase 10: Add to Agency Settings Page

In the Agency settings page, add an Integrations section:

```tsx
import { RingCentralConnect } from '@/components/RingCentralConnect';

// In the Agency page component:
<div className="space-y-4">
  <h3 className="text-lg font-semibold">Phone System Integrations</h3>
  <RingCentralConnect />
</div>
```

---

## Phase 11: Cron Job for Auto-Sync

In Supabase Dashboard, enable pg_cron and run:

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'ringcentral-sync',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zsjbgpkxhsqbpwmsjyet.supabase.co/functions/v1/ringcentral-sync-calls',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
  );
  $$
);
```

---

## Phase 12: Integration Examples

### Owner Dashboard:
```tsx
<CallMetricsSummary />
<CallMetricsSummary teamMemberId={selectedTeamMemberId} />
```

### Staff Portal Dashboard:
```tsx
<CallMetricsSummary 
  teamMemberId={staffTeamMemberId}
  isStaffUser={true}
  staffTeamMemberId={staffTeamMemberId}
/>
```

### Prospect Detail View (Owner):
```tsx
<ProspectActivityTimeline prospectId={prospect.id} />
```

### Prospect Detail View (Staff):
```tsx
<ProspectActivityTimeline 
  prospectId={prospect.id}
  isStaffUser={true}
  staffTeamMemberId={staffTeamMemberId}
/>
```

---

## Access Control Summary

| Feature | Owner | Key Employee | Manager | Staff |
|---------|-------|--------------|---------|-------|
| Connect RingCentral | ✅ | ❌ | ❌ | ❌ |
| Disconnect RingCentral | ✅ | ❌ | ❌ | ❌ |
| Manual Sync | ✅ | ❌ | ❌ | ❌ |
| View Call Metrics | ✅ | ✅ | ✅ | ✅ |
| View Activity Timeline | ✅ | ✅ | ✅ | ✅ |

---

## Verification Checklist

- [ ] Migration applied: `supabase db push`
- [ ] Functions deployed: `supabase functions deploy`
- [ ] Secrets set (4 total)
- [ ] OAuth flow works (owner connects)
- [ ] Tokens stored in `voip_integrations`
- [ ] Manual sync populates `call_events`
- [ ] `call_metrics_daily` shows aggregated data
- [ ] Staff portal can view metrics via RPC
- [ ] Cron job scheduled: `SELECT * FROM cron.job;`
