import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, handleOptions } from '../_shared/cors.ts';
import { supaFromReq } from '../_shared/client.ts';

function bad(msg: string, code = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status: code, 
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

serve(async (req) => {
  const opt = handleOptions(req); 
  if (opt) return opt;
  
  try {
    const body = await req.json();
    const memberId = body.member_id; // UUID
    const role = body.role; // optional, else from member
    
    if (!memberId) return bad('member_id required');

    const supabase = supaFromReq(req);

    // Member → agency + role
    const { data: member, error: mErr } = await supabase
      .from('team_members')
      .select('id, agency_id, role')
      .eq('id', memberId)
      .maybeSingle();
      
    if (mErr) return bad(mErr.message, 500);
    if (!member) return bad('member not found', 404);

    const effRole = role ?? member.role;

    // Rules for ordering and required count
    const { data: rule } = await supabase
      .from('scorecard_rules')
      .select('selected_metrics, n_required')
      .eq('agency_id', member.agency_id)
      .eq('role', effRole)
      .maybeSingle();

    // Active KPIs
    const { data: kpis, error: kErr } = await supabase
      .from('vw_active_kpis')
      .select('id, key, label, type, color, is_active')
      .eq('agency_id', member.agency_id)
      .eq('role', effRole);
      
    if (kErr) return bad(kErr.message, 500);

    // Order: selected_metrics first, then others alpha
    const selected = new Set<string>((rule?.selected_metrics ?? []) as string[]);
    const ordered = [...(kpis || [])].sort((a, b) => {
      const aSel = selected.has(a.key) ? 0 : 1;
      const bSel = selected.has(b.key) ? 0 : 1;
      if (aSel !== bSel) return aSel - bSel;
      return a.label.localeCompare(b.label);
    });

    return new Response(JSON.stringify({
      role: effRole,
      n_required: rule?.n_required ?? 0,
      kpis: ordered,
    }), { 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'unknown error', 500);
  }
});