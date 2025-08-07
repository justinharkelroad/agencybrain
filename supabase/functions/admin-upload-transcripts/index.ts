import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { corsHeaders } from "../_shared/cors.ts";

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

    // Verify user is admin
    const { data: { user }, error: userErr } = await authClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: profile } = await authClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { clientId, files, category = 'transcripts' } = body as {
      clientId: string;
      files: Array<{ name: string; type: string; size: number; data: string }>;
      category?: string;
    };

    if (!clientId || !Array.isArray(files) || files.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing clientId or files' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results: any[] = [];

    for (const file of files) {
      // Decode base64 to Uint8Array
      const binaryString = atob(file.data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'txt';
      const path = `${clientId}/${category}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadErr } = await adminClient.storage
        .from('uploads')
        .upload(path, bytes, { contentType: file.type || 'text/plain', upsert: false });
      if (uploadErr) {
        results.push({ name: file.name, error: uploadErr.message });
        continue;
      }

      const { data: inserted, error: dbErr } = await adminClient
        .from('uploads')
        .insert({
          user_id: clientId,
          original_name: file.name,
          file_path: path,
          file_size: file.size,
          mime_type: file.type,
          category,
        })
        .select('*')
        .single();

      if (dbErr) {
        results.push({ name: file.name, error: dbErr.message });
        continue;
      }

      results.push({ success: true, upload: inserted });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('admin-upload-transcripts error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});