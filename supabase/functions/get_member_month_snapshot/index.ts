// supabase/functions/get_member_month_snapshot/index.ts
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
function badRequest(msg: string, code = 400) { return json({ error: msg }, code); }

function startEnd(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const s = start.toISOString().slice(0, 10);
  const e = end.toISOString().slice(0, 10);
  return { s, e };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const memberId = url.searchParams.get("member_id");
    const month = url.searchParams.get("month"); // YYYY-MM
    if (!memberId || !/^[0-9a-f-]{36}$/i.test(memberId)) return badRequest("member_id must be a UUID");
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return badRequest("month must be YYYY-MM");

    const { s: startDate, e: endDate } = startEnd(month);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );

    // Marker for logs
    console.log("SNAPSHOT_V1", { memberId, month, startDate, endDate });

    // Member with agency and role
    const { data: member, error: memberErr } = await supabase
      .from("team_members")
      .select("id,name,role,agency_id")
      .eq("id", memberId)
      .maybeSingle();
    if (memberErr) return badRequest(memberErr.message, 500);
    if (!member) return badRequest("member not found or no access", 404);

    // Required count for that agency+role
    const { data: rule, error: ruleErr } = await supabase
      .from("scorecard_rules")
      .select("n_required")
      .eq("agency_id", member.agency_id)
      .eq("role", member.role)
      .maybeSingle();
    if (ruleErr) return badRequest(ruleErr.message, 500);
    const requiredCount = rule?.n_required ?? 0;

    // Daily rows
    const { data: rows, error: rowsErr } = await supabase
      .from("metrics_daily")
      .select("date,pass,hits")
      .eq("team_member_id", memberId)
      .gte("date", startDate)
      .lt("date", endDate)
      .order("date", { ascending: true });
    if (rowsErr) return badRequest(rowsErr.message, 500);

    const days = (rows ?? []).map((r: any) => ({
      date: String(r.date).slice(0, 10),
      pass: Boolean(r.pass),
      met_count: Number(r.hits ?? 0),
      required_count: Number(requiredCount),
    }));

    return json({
      member: { id: member.id, name: member.name, role: member.role, avatar_url: null },
      month,
      days,
    });
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "unknown error", 500);
  }
});