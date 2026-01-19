import { serve } from "https://deno.land/std/http/server.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const { token, staff_name, staff_email, session_id } = await req.json();

    if (!token || !staff_name || !staff_email || !session_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(staff_email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create supabase client without auth (public access)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    // Update token with staff info - only if not already used
    const { data, error } = await supabase
      .from('roleplay_access_tokens')
      .update({
        staff_name,
        staff_email,
        used: true,
        used_at: new Date().toISOString(),
        session_id
      })
      .eq('token', token)
      .eq('used', false)
      .eq('invalidated', false)
      .select()
      .single();

    if (error) {
      console.error('Error updating token:', error);
      return new Response(
        JSON.stringify({ error: 'Token already used or invalid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Staff identity submitted: ${staff_name} (${staff_email}) for token ${token}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in submit-staff-identity:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
