import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify staff session
    const staffSessionToken = req.headers.get('x-staff-session');
    if (!staffSessionToken) {
      return new Response(
        JSON.stringify({ error: 'Staff session token required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the session and get user data
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select(`
        id,
        staff_user_id,
        expires_at,
        staff_users (
          id,
          username,
          agency_id,
          team_member_id
        )
      `)
      .eq('session_token', staffSessionToken)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      console.error('Session verification failed:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const staffUser = session.staff_users as any;
    const agencyId = staffUser?.agency_id;
    const teamMemberId = staffUser?.team_member_id;

    if (!teamMemberId) {
      return new Response(
        JSON.stringify({ error: 'Staff user not linked to team member' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the team member's role from team_members table
    let isManager = false;
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('role')
      .eq('id', teamMemberId)
      .single();
    
    isManager = teamMember?.role === 'Manager';

    const body = await req.json();
    const { type } = body;
    console.log('Request type:', type, 'Agency:', agencyId, 'TeamMember:', teamMemberId, 'isManager:', isManager);

    let responseData: any = {};

    switch (type) {
      case 'focus_items': {
        // Focus items - get items for this team member
        const { data: focusItems, error } = await supabase
          .from('focus_items')
          .select('id, title, description, priority_level, column_status, created_at, completed_at, column_order')
          .eq('team_member_id', teamMemberId)
          .order('column_order', { ascending: true });

        if (error) {
          console.error('Error fetching focus items:', error);
          throw error;
        }

        responseData = { focus_items: focusItems || [] };
        break;
      }

      case 'create_focus_item': {
        // Create a new focus item
        const { title, description, priority_level, column_status = 'backlog', column_order = 0 } = body;
        
        if (!title || !priority_level) {
          return new Response(
            JSON.stringify({ error: 'Title and priority_level are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: newItem, error } = await supabase
          .from('focus_items')
          .insert({
            title,
            description: description || null,
            priority_level,
            column_status,
            column_order,
            team_member_id: teamMemberId,
            // user_id left null for staff-created items (they don't have Supabase auth)
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating focus item:', error);
          throw error;
        }

        responseData = { focus_item: newItem };
        break;
      }

      case 'update_focus_item': {
        // Update an existing focus item
        const { id, title, description, priority_level, column_status, column_order } = body;
        
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'Item ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Build update object with only provided fields
        const updateData: any = { updated_at: new Date().toISOString() };
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (priority_level !== undefined) updateData.priority_level = priority_level;
        if (column_status !== undefined) {
          updateData.column_status = column_status;
          if (column_status === 'completed') {
            updateData.completed_at = new Date().toISOString();
          }
        }
        if (column_order !== undefined) updateData.column_order = column_order;

        const { data: updatedItem, error } = await supabase
          .from('focus_items')
          .update(updateData)
          .eq('id', id)
          .eq('team_member_id', teamMemberId) // Security: only update own items
          .select()
          .single();

        if (error) {
          console.error('Error updating focus item:', error);
          throw error;
        }

        responseData = { focus_item: updatedItem };
        break;
      }

      case 'delete_focus_item': {
        // Delete a focus item
        const { id } = body;
        
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'Item ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase
          .from('focus_items')
          .delete()
          .eq('id', id)
          .eq('team_member_id', teamMemberId); // Security: only delete own items

        if (error) {
          console.error('Error deleting focus item:', error);
          throw error;
        }

        responseData = { success: true };
        break;
      }

      case 'move_focus_item': {
        // Move a focus item to different column/position
        const { id, column_status, column_order } = body;
        
        if (!id || column_status === undefined || column_order === undefined) {
          return new Response(
            JSON.stringify({ error: 'Item ID, column_status, and column_order are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updateData: any = {
          column_status,
          column_order,
          updated_at: new Date().toISOString(),
        };

        // Mark as completed if moving to completed column
        if (column_status === 'completed') {
          updateData.completed_at = new Date().toISOString();
        } else {
          updateData.completed_at = null;
        }

        const { data: movedItem, error } = await supabase
          .from('focus_items')
          .update(updateData)
          .eq('id', id)
          .eq('team_member_id', teamMemberId) // Security: only move own items
          .select()
          .single();

        if (error) {
          console.error('Error moving focus item:', error);
          throw error;
        }

        responseData = { focus_item: movedItem };
        break;
      }

      case 'team_members': {
        // Manager-only: Fetch all team members for the agency
        if (!isManager) {
          return new Response(
            JSON.stringify({ error: 'Manager access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: members, error } = await supabase
          .from('team_members')
          .select('id, name, email, role, status')
          .eq('agency_id', agencyId)
          .order('name');

        if (error) {
          console.error('Error fetching team members:', error);
          throw error;
        }

        responseData = { team_members: members || [] };
        break;
      }

      case 'performance': {
        // Manager-only: Fetch recent metrics for all team members in the agency (last 7 days)
        if (!isManager) {
          return new Response(
            JSON.stringify({ error: 'Manager access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: metrics, error: metricsError } = await supabase
          .from('metrics_daily')
          .select('team_member_id, date, hits, pass, sold_items, quoted_count, talk_minutes')
          .eq('agency_id', agencyId)
          .gte('date', sevenDaysAgo.toISOString().split('T')[0])
          .order('date', { ascending: false });

        if (metricsError) {
          console.error('Error fetching metrics:', metricsError);
          throw metricsError;
        }

        // Get team member names
        const memberIds = [...new Set(metrics?.map(m => m.team_member_id) || [])];
        const { data: members } = await supabase
          .from('team_members')
          .select('id, name')
          .in('id', memberIds.length > 0 ? memberIds : ['00000000-0000-0000-0000-000000000000']);

        const memberMap = new Map(members?.map(m => [m.id, m.name]) || []);

        const enrichedMetrics = (metrics || []).map(m => ({
          ...m,
          team_member_name: memberMap.get(m.team_member_id) || 'Unknown'
        }));

        responseData = { performance: enrichedMetrics };
        break;
      }

      case 'roleplay': {
        // Manager-only: Fetch roleplay sessions for the agency
        if (!isManager) {
          return new Response(
            JSON.stringify({ error: 'Manager access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: sessions, error: sessionsError } = await supabase
          .from('roleplay_sessions')
          .select('id, staff_name, staff_email, overall_score, completed_at, pdf_file_path')
          .eq('agency_id', agencyId)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(20);

        if (sessionsError) {
          console.error('Error fetching roleplay sessions:', sessionsError);
          throw sessionsError;
        }

        responseData = { roleplay_sessions: sessions || [] };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid request type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get_staff_team_data:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
