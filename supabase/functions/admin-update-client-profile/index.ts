import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateClientProfileRequest {
  client_id: string;  // The profile ID to update
  membership_tier?: string;
  mrr?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header to identify the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract token and validate user
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Use service client to validate the JWT token directly
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');

    // Get the authenticated user using the token directly
    const { data: { user }, error: userError } = await serviceClient.auth.getUser(token);
    if (userError || !user) {
      console.error('[admin-update-client-profile] Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify caller is an admin
    const { data: adminCheck } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!adminCheck) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: UpdateClientProfileRequest = await req.json();

    // Validate required fields
    if (!body.client_id) {
      return new Response(
        JSON.stringify({ error: 'client_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build update object with only allowed fields
    const updates: Record<string, unknown> = {};

    if (body.membership_tier !== undefined) {
      updates.membership_tier = body.membership_tier;
    }

    if (body.mrr !== undefined) {
      if (typeof body.mrr !== 'number' || isNaN(body.mrr)) {
        return new Response(
          JSON.stringify({ error: 'mrr must be a valid number' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      updates.mrr = body.mrr;
    }

    if (Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid fields to update' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Perform the update
    const { error: updateError } = await serviceClient
      .from('profiles')
      .update(updates)
      .eq('id', body.client_id);

    if (updateError) {
      console.error('[admin-update-client-profile] Update failed:', updateError);
      throw updateError;
    }

    console.log('[admin-update-client-profile] Admin', user.id, 'updated client', body.client_id, 'with:', updates);

    return new Response(
      JSON.stringify({ success: true, updated_fields: Object.keys(updates) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[admin-update-client-profile] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to update client profile' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
