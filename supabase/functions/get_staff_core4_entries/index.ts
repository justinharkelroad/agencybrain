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

interface MissionItem {
  text: string;
  completed: boolean;
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
    let body: Record<string, unknown> = {};
    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // No body or invalid JSON - that's fine for GET
    }

    const action = (body.action as string) || 'fetch';
    console.log('[get_staff_core4_entries] Action:', action, 'Body:', JSON.stringify(body));

    // ==================== TOGGLE DOMAIN ====================
    if (action === 'toggle') {
      const domain = body.domain as string;
      if (!domain || !['body', 'being', 'balance', 'business'].includes(domain)) {
        return new Response(
          JSON.stringify({ error: 'Invalid domain' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Accept date from request or default to today
      let targetDate = body.date as string;
      const today = new Date().toISOString().split('T')[0];
      
      if (!targetDate) {
        targetDate = today;
      }
      
      // Validate the date is within the current week (Mon-Sun) and not in the future
      const targetDateObj = new Date(targetDate + 'T00:00:00Z');
      const todayObj = new Date(today + 'T00:00:00Z');
      
      // Cannot edit future days
      if (targetDateObj > todayObj) {
        return new Response(
          JSON.stringify({ error: 'Cannot edit future dates' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Get current week's Monday (week starts on Monday)
      const dayOfWeek = todayObj.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const currentWeekMonday = new Date(todayObj);
      currentWeekMonday.setUTCDate(todayObj.getUTCDate() - daysFromMonday);
      
      // Cannot edit days before current week's Monday
      if (targetDateObj < currentWeekMonday) {
        return new Response(
          JSON.stringify({ error: 'Cannot edit dates before current week' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const domainKey = `${domain}_completed`;

      const { data: existingEntry, error: fetchError } = await supabase
        .from('staff_core4_entries')
        .select('*')
        .eq('staff_user_id', staffUserId)
        .eq('date', targetDate)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('[get_staff_core4_entries] Error fetching entry:', fetchError);
        throw fetchError;
      }

      let updatedEntry: Core4Entry;

      if (existingEntry) {
        const newValue = !existingEntry[domainKey];
        const { data, error } = await supabase
          .from('staff_core4_entries')
          .update({ [domainKey]: newValue, updated_at: new Date().toISOString() })
          .eq('id', existingEntry.id)
          .select()
          .single();

        if (error) throw error;
        updatedEntry = data;
      } else {
        const { data, error } = await supabase
          .from('staff_core4_entries')
          .insert({
            staff_user_id: staffUserId,
            date: targetDate,
            [domainKey]: true,
          })
          .select()
          .single();

        if (error) throw error;
        updatedEntry = data;
      }

      return new Response(
        JSON.stringify({ success: true, entry: updatedEntry }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== FETCH MISSIONS ====================
    if (action === 'fetch_missions') {
      const monthYear = body.month_year as string;
      if (!monthYear) {
        return new Response(
          JSON.stringify({ error: 'month_year required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: missions, error } = await supabase
        .from('staff_core4_monthly_missions')
        .select('*')
        .eq('staff_user_id', staffUserId)
        .eq('month_year', monthYear)
        .eq('status', 'active');

      if (error) throw error;

      return new Response(
        JSON.stringify({ missions: missions || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== CREATE MISSION ====================
    if (action === 'create_mission') {
      const { domain, title, items, weekly_measurable, month_year } = body as {
        domain: string;
        title: string;
        items: MissionItem[];
        weekly_measurable: string | null;
        month_year: string;
      };

      if (!domain || !title || !month_year) {
        return new Response(
          JSON.stringify({ error: 'domain, title, and month_year required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[get_staff_core4_entries] Creating mission:', { staffUserId, domain, title, month_year });

      // Check if an active mission already exists for this domain/month
      const { data: existing, error: checkError } = await supabase
        .from('staff_core4_monthly_missions')
        .select('id')
        .eq('staff_user_id', staffUserId)
        .eq('domain', domain)
        .eq('month_year', month_year)
        .eq('status', 'active')
        .maybeSingle();

      if (checkError) {
        console.error('[get_staff_core4_entries] Error checking existing mission:', checkError);
        throw checkError;
      }

      let data;
      let error;

      if (existing) {
        // Update existing mission
        console.log('[get_staff_core4_entries] Updating existing mission:', existing.id);
        const result = await supabase
          .from('staff_core4_monthly_missions')
          .update({
            title,
            items: items || [],
            weekly_measurable,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();
        data = result.data;
        error = result.error;
      } else {
        // Insert new mission
        console.log('[get_staff_core4_entries] Inserting new mission');
        const result = await supabase
          .from('staff_core4_monthly_missions')
          .insert({
            staff_user_id: staffUserId,
            domain,
            title,
            items: items || [],
            weekly_measurable,
            month_year,
            status: 'active',
          })
          .select()
          .single();
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('[get_staff_core4_entries] Error saving mission:', error);
        throw error;
      }

      console.log('[get_staff_core4_entries] Mission saved successfully:', data?.id);

      return new Response(
        JSON.stringify({ success: true, mission: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== UPDATE MISSION ITEM ====================
    if (action === 'update_mission_item') {
      const { mission_id, items } = body as { mission_id: string; items: MissionItem[] };

      if (!mission_id || !items) {
        return new Response(
          JSON.stringify({ error: 'mission_id and items required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify ownership
      const { data: mission, error: fetchError } = await supabase
        .from('staff_core4_monthly_missions')
        .select('staff_user_id')
        .eq('id', mission_id)
        .single();

      if (fetchError || !mission || mission.staff_user_id !== staffUserId) {
        return new Response(
          JSON.stringify({ error: 'Mission not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('staff_core4_monthly_missions')
        .update({ items, updated_at: new Date().toISOString() })
        .eq('id', mission_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== UPDATE MISSION STATUS ====================
    if (action === 'update_mission_status') {
      const { mission_id, status } = body as { mission_id: string; status: string };

      if (!mission_id || !status || !['active', 'completed', 'archived'].includes(status)) {
        return new Response(
          JSON.stringify({ error: 'mission_id and valid status required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify ownership
      const { data: mission, error: fetchError } = await supabase
        .from('staff_core4_monthly_missions')
        .select('staff_user_id')
        .eq('id', mission_id)
        .single();

      if (fetchError || !mission || mission.staff_user_id !== staffUserId) {
        return new Response(
          JSON.stringify({ error: 'Mission not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('staff_core4_monthly_missions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', mission_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== DEFAULT: FETCH ENTRIES ====================
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];

    const { data: entries, error: entriesError } = await supabase
      .from('staff_core4_entries')
      .select('*')
      .eq('staff_user_id', staffUserId)
      .gte('date', ninetyDaysAgoStr)
      .order('date', { ascending: false });

    if (entriesError) throw entriesError;

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
