import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const staffSessionToken = req.headers.get('x-staff-session');
    if (!staffSessionToken) {
      return new Response(JSON.stringify({ error: 'Missing staff session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create service role client to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate staff session
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id, expires_at')
      .eq('session_token', staffSessionToken)
      .single();

    if (sessionError || !session || new Date(session.expires_at) < new Date()) {
      console.error('Session validation failed:', sessionError?.message || 'expired');
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get staff user's agency
    const { data: staffUser, error: staffError } = await supabase
      .from('staff_users')
      .select('agency_id')
      .eq('id', session.staff_user_id)
      .single();

    if (staffError || !staffUser) {
      console.error('Staff user lookup failed:', staffError?.message);
      return new Response(JSON.stringify({ error: 'Staff user not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { fileName, contentType, agencyId } = await req.json();

    if (!fileName || !agencyId) {
      return new Response(JSON.stringify({ error: 'Missing fileName or agencyId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify staff user belongs to the agency they're uploading to
    if (staffUser.agency_id !== agencyId) {
      console.error('Agency mismatch:', { staffAgency: staffUser.agency_id, requestedAgency: agencyId });
      return new Response(JSON.stringify({ error: 'Agency mismatch' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate unique call ID and storage path
    const callId = crypto.randomUUID();
    const storagePath = `${agencyId}/${callId}/${fileName}`;

    // Create signed upload URL (valid for 5 minutes)
    const { data: signedUrl, error: signError } = await supabase.storage
      .from('call-recordings')
      .createSignedUploadUrl(storagePath);

    if (signError) {
      console.error('Signed URL creation failed:', signError.message);
      return new Response(JSON.stringify({ error: signError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Signed upload URL created for staff user:', session.staff_user_id, 'path:', storagePath);

    return new Response(JSON.stringify({
      signedUrl: signedUrl.signedUrl,
      token: signedUrl.token,
      path: signedUrl.path,
      callId,
      storagePath,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
