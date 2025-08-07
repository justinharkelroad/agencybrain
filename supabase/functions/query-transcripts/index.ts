import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { corsHeaders } from "../_shared/cors.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Verify admin
    const { data: { user }, error: userErr } = await authClient.auth.getUser();
    if (userErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || profile.role !== 'admin') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { clientId, prompt, filePaths } = await req.json();
    if (!clientId || !prompt) return new Response(JSON.stringify({ error: 'Missing clientId or prompt' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Get selected uploads metadata
    let uploads = [] as Array<{ id: string; original_name: string; file_path: string; category: string }>;
    if (Array.isArray(filePaths) && filePaths.length > 0) {
      const { data } = await adminClient.from('uploads').select('id, original_name, file_path, category').in('file_path', filePaths);
      uploads = data || [];
    } else {
      const { data } = await adminClient.from('uploads').select('id, original_name, file_path, category').eq('user_id', clientId);
      uploads = data || [];
    }

    if (!uploads.length) {
      return new Response(JSON.stringify({ error: 'No files found to query.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Build context by downloading files
    let context = '';
    for (const u of uploads) {
      const { data: fileData, error: fileErr } = await adminClient.storage.from('uploads').download(u.file_path);
      if (fileErr || !fileData) {
        context += `\n--- File: ${u.original_name} (${u.category}) ---\n[Error downloading file]\n`;
        continue;
      }
      try {
        const text = await fileData.text();
        context += `\n--- File: ${u.original_name} (${u.category}) ---\n` + text + `\n--- End ---\n`;
      } catch (_) {
        context += `\n--- File: ${u.original_name} (${u.category}) ---\n[Binary or unsupported format]\n`;
      }
    }

    const messages = [
      { role: 'system', content: 'You are a precise assistant that answers questions about documents. Cite quotes verbatim when relevant.' },
      { role: 'user', content: `Context documents:\n${context}\n\nUser prompt: ${prompt}` }
    ];

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openAIApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.3, max_tokens: 1200 })
    });
    const aiJson = await aiRes.json();
    if (!aiRes.ok) throw new Error(aiJson?.error?.message || 'OpenAI error');
    const analysis = aiJson.choices?.[0]?.message?.content || '';

    // Store to ai_analysis
    await adminClient.from('ai_analysis').insert({
      analysis_result: analysis,
      selected_uploads: uploads.map(u => ({ id: u.id, name: u.original_name, file_path: u.file_path, category: u.category })),
      period_id: null,
      prompt_id: null,
      shared_with_client: false,
      analysis_type: 'file_query',
      prompt_used: prompt,
    });

    return new Response(JSON.stringify({ analysis }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('query-transcripts error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});