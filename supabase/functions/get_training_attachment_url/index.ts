import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_token, attachment_id } = await req.json();

    if (!session_token || !attachment_id) {
      return new Response(
        JSON.stringify({ error: 'Session token and attachment_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify session
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('*, staff_users!inner(*)')
      .eq('session_token', session_token)
      .eq('is_valid', true)
      .gt('expires_at', new Date().toISOString())
      .single() as { data: any; error: any };

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch attachment
    const { data: attachment, error: attachmentError } = await supabase
      .from('training_attachments')
      .select('*')
      .eq('id', attachment_id)
      .single();

    if (attachmentError || !attachment) {
      return new Response(
        JSON.stringify({ error: 'Attachment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify staff belongs to same agency as attachment
    if (attachment.agency_id !== session.staff_users.agency_id) {
      return new Response(
        JSON.stringify({ error: 'Access denied to this attachment' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If external link, return it directly
    if (attachment.is_external_link) {
      return new Response(
        JSON.stringify({
          url: attachment.file_url,
          name: attachment.name,
          is_external: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate signed URL for storage file (expires in 1 hour)
    const { data: signedUrlData, error: urlError } = await supabase
      .storage
      .from('training-files')
      .createSignedUrl(attachment.file_url, 3600);

    if (urlError || !signedUrlData) {
      console.error('Error generating signed URL:', urlError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate access URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generated signed URL for attachment:', attachment_id);

    return new Response(
      JSON.stringify({
        url: signedUrlData.signedUrl,
        name: attachment.name,
        is_external: false
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get_training_attachment_url:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
