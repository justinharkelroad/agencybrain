import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, handleOptions } from '../_shared/cors.ts';
import { supaFromReq } from '../_shared/client.ts';

serve(async (req) => {
  const opt = handleOptions(req); 
  if (opt) return opt;
  
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }
  
  try {
    const { kpi_id, new_label } = await req.json();
    if (!kpi_id || !new_label) {
      return new Response(JSON.stringify({ error: 'kpi_id and new_label required' }), {
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    
    const supabase = supaFromReq(req);
    const { error } = await supabase
      .from('kpis')
      .update({ label: new_label })
      .eq('id', kpi_id);
      
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }
    
    return new Response(JSON.stringify({ ok: true }), { 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  } catch (e) {
    return new Response(JSON.stringify({ 
      error: e instanceof Error ? e.message : 'unknown error' 
    }), {
      status: 500, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});