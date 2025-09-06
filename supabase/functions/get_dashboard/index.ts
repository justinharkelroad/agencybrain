// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function j(status: number, body: any, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...corsHeaders,
      ...extra
    }
  });
}

type QueryParams = {
  agencySlug: string;
  role: "Sales" | "Service";
  start?: string; // YYYY-MM-DD
  end?: string;   // YYYY-MM-DD
  quotedLabel?: "households" | "policies" | "items" | "quotes";
  soldMetric?: "items" | "policies" | "premium";
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") return j(405, { code: "METHOD_NOT_ALLOWED" });
    
    const body = await req.json() as QueryParams;
    const { agencySlug, role } = body;
    if (!agencySlug || !role) return j(400, { code: "BAD_REQUEST", message: "Missing agencySlug or role" });

    // Two clients: one for auth (anon key + headers), one service for data
    const supaAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );
    const supaSrv = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth: require signed-in user and owner/admin on this agency
    const { data: user } = await supaAnon.auth.getUser();
    if (!user?.user) return j(401, { code: "UNAUTHORIZED" });
    
    const { data: prof } = await supaSrv
      .from("profiles").select("id, agency_id, role")
      .eq("id", user.user.id).single();
    if (!prof) return j(403, { code: "FORBIDDEN" });
    
    const { data: agency } = await supaSrv
      .from("agencies").select("id, name, slug, contest_board_enabled, timezone")
      .eq("slug", agencySlug).single();
    if (!agency) return j(404, { code: "AGENCY_NOT_FOUND" });
    
    if (prof.role !== 'admin' && prof.agency_id !== agency.id) {
      return j(403, { code: "FORBIDDEN" });
    }

    // Date range default: today..today (current snapshot) and week = last 7 days
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const start = body.start ?? weekAgo;
    const end = body.end ?? today;
    const quotedLabel = body.quotedLabel ?? "households";
    const soldMetric = body.soldMetric ?? "items";

    // Pull rows within range
    const { data: rows, error } = await supaSrv
      .from("vw_metrics_with_team")
      .select("*")
      .eq("agency_id", agency.id)
      .eq("role", role)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true });
    
    if (error) {
      console.error("DB Error:", error);
      return j(500, { code: "DB_ERROR", detail: error.message });
    }

    // Tiles - aggregate all data in date range
    const sum = (arr: any[], key: string) => arr.reduce((a, b) => a + (Number(b[key] || 0)), 0);
    const tiles = {
      outbound_calls: sum(rows, "outbound_calls"),
      talk_minutes: sum(rows, "talk_minutes"),
      quoted: sum(rows, "quoted_count"),
      sold_items: sum(rows, "sold_items"),
      sold_policies: sum(rows, "sold_policies"),
      sold_premium_cents: sum(rows, "sold_premium_cents"),
      cross_sells_uncovered: sum(rows, "cross_sells_uncovered"),
      mini_reviews: sum(rows, "mini_reviews"),
      pass_rate: rows.length ? (rows.filter(r => r.pass).length / rows.length) : 0
    };

    // Group by member for table display
    const byMember: Record<string, any[]> = {};
    for (const r of rows) {
      (byMember[r.team_member_id] ||= []).push(r);
    }

    // Table rows - aggregate per rep with current streak
    const perRep = Object.keys(byMember).map(mid => {
      const arr = byMember[mid];
      const last = arr.sort((a, b) => b.date.localeCompare(a.date))[0];
      return {
        team_member_id: mid,
        team_member_name: last.team_member_name,
        role: last.role,
        date: last.date,
        outbound_calls: sum(arr, "outbound_calls"),
        talk_minutes: sum(arr, "talk_minutes"),
        quoted_count: sum(arr, "quoted_count"),
        sold_items: sum(arr, "sold_items"),
        sold_policies: sum(arr, "sold_policies"),
        sold_premium_cents: sum(arr, "sold_premium_cents"),
        cross_sells_uncovered: sum(arr, "cross_sells_uncovered"),
        mini_reviews: sum(arr, "mini_reviews"),
        pass_days: arr.filter(r => r.pass).length,
        score_sum: sum(arr, "daily_score"),
        streak: last.streak_count || 0,
      };
    }).sort((a, b) => a.team_member_name.localeCompare(b.team_member_name));

    // Charts: daily series per KPI
    const uniqDates = [...new Set(rows.map(r => r.date))].sort();
    const dailySeries = uniqDates.map(d => {
      const subset = rows.filter(r => r.date === d);
      return {
        date: d,
        outbound_calls: sum(subset, "outbound_calls"),
        talk_minutes: sum(subset, "talk_minutes"),
        quoted_count: sum(subset, "quoted_count"),
        sold_items: sum(subset, "sold_items"),
        sold_policies: sum(subset, "sold_policies"),
        sold_premium_cents: sum(subset, "sold_premium_cents"),
        pass_count: subset.filter(r => r.pass).length,
      };
    });

    // Contest board
    let contest: any[] = [];
    if (agency.contest_board_enabled) {
      // If scoring enabled (weights exist), rank by weekly score; else by pass days
      const hasScores = perRep.some(r => r.score_sum > 0);
      contest = [...perRep].sort((a, b) => {
        if (hasScores) {
          if (b.score_sum !== a.score_sum) return b.score_sum - a.score_sum;
          return (b.streak || 0) - (a.streak || 0);
        } else {
          if (b.pass_days !== a.pass_days) return b.pass_days - a.pass_days;
          return (b.streak || 0) - (a.streak || 0);
        }
      });
    }

    return j(200, {
      meta: { 
        agencySlug, 
        agencyName: agency.name,
        role, 
        start, 
        end, 
        quotedLabel, 
        soldMetric, 
        timezone: agency.timezone, 
        contest_board_enabled: agency.contest_board_enabled 
      },
      tiles,
      table: perRep,
      dailySeries,
      contest
    });
  } catch (e) {
    console.error("Server error:", e);
    return j(500, { code: "SERVER_ERROR", detail: String(e) });
  }
});