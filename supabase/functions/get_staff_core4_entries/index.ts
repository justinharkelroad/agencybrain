import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

interface Core4Entry {
  id: string;
  staff_user_id: string;
  date: string;
  body_completed: boolean;
  being_completed: boolean;
  balance_completed: boolean;
  business_completed: boolean;
  body_note: string | null;
  being_note: string | null;
  balance_note: string | null;
  business_note: string | null;
  created_at: string;
  updated_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sessionToken = req.headers.get('x-staff-session');
    if (!sessionToken) {
      console.error('[get_staff_core4_entries] Missing session token');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate session
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id, expires_at')
      .eq('session_token', sessionToken)
      .single();

    if (sessionError || !session) {
      console.error('[get_staff_core4_entries] Invalid session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (new Date(session.expires_at) < new Date()) {
      console.error('[get_staff_core4_entries] Session expired');
      return new Response(
        JSON.stringify({ error: 'Session expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const staffUserId = session.staff_user_id;
    console.log('[get_staff_core4_entries] Validated staff user:', staffUserId);

    // Parse request body for action
    let body: { action?: string; domain?: string; date?: string } = {};
    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // No body or invalid JSON - that's fine for GET
    }

    const action = body.action || 'fetch';

    if (action === 'toggle') {
      // Toggle a domain for today
      const domain = body.domain;
      if (!domain || !['body', 'being', 'balance', 'business'].includes(domain)) {
        return new Response(
          JSON.stringify({ error: 'Invalid domain' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const today = new Date().toISOString().split('T')[0];
      const domainKey = `${domain}_completed`;

      // Check for existing entry
      const { data: existingEntry, error: fetchError } = await supabase
        .from('staff_core4_entries')
        .select('*')
        .eq('staff_user_id', staffUserId)
        .eq('date', today)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('[get_staff_core4_entries] Error fetching entry:', fetchError);
        throw fetchError;
      }

      let updatedEntry: Core4Entry;

      if (existingEntry) {
        // Toggle the domain
        const newValue = !existingEntry[domainKey];
        const { data, error } = await supabase
          .from('staff_core4_entries')
          .update({ [domainKey]: newValue, updated_at: new Date().toISOString() })
          .eq('id', existingEntry.id)
          .select()
          .single();

        if (error) {
          console.error('[get_staff_core4_entries] Error updating entry:', error);
          throw error;
        }
        updatedEntry = data;
        console.log('[get_staff_core4_entries] Updated entry:', updatedEntry.id);
      } else {
        // Create new entry
        const { data, error } = await supabase
          .from('staff_core4_entries')
          .insert({
            staff_user_id: staffUserId,
            date: today,
            [domainKey]: true,
          })
          .select()
          .single();

        if (error) {
          console.error('[get_staff_core4_entries] Error creating entry:', error);
          throw error;
        }
        updatedEntry = data;
        console.log('[get_staff_core4_entries] Created new entry:', updatedEntry.id);
      }

      return new Response(
        JSON.stringify({ success: true, entry: updatedEntry }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default: fetch entries for last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];

    const { data: entries, error: entriesError } = await supabase
      .from('staff_core4_entries')
      .select('*')
      .eq('staff_user_id', staffUserId)
      .gte('date', ninetyDaysAgoStr)
      .order('date', { ascending: false });

    if (entriesError) {
      console.error('[get_staff_core4_entries] Error fetching entries:', entriesError);
      throw entriesError;
    }

    console.log('[get_staff_core4_entries] Fetched', entries?.length || 0, 'entries');

    return new Response(
      JSON.stringify({ entries: entries || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get_staff_core4_entries] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
