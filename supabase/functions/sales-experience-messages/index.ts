import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface SendMessageBody {
  action: 'send';
  assignment_id: string;
  content: string;
}

interface GetMessagesBody {
  action: 'list';
  assignment_id?: string;
}

interface MarkReadBody {
  action: 'mark_read';
  message_id: string;
}

type RequestBody = SendMessageBody | GetMessagesBody | MarkReadBody;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- Auth resolution ---
    let userId: string | null = null;
    let staffSenderId: string | null = null;
    let agencyId: string | null = null;
    let isAdmin = false;
    let isStaffDelegate = false;

    const staffSessionToken = req.headers.get('x-staff-session');
    const authHeader = req.headers.get('Authorization');

    if (staffSessionToken) {
      // Staff delegate auth
      const { data: staffSession, error: staffSessionError } = await supabase
        .from('staff_sessions')
        .select(`
          staff_user_id,
          expires_at,
          staff_users (
            id,
            team_member_id
          )
        `)
        .eq('session_token', staffSessionToken)
        .eq('is_valid', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (staffSessionError || !staffSession) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired staff session' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const staffUser = staffSession.staff_users as unknown as { id: string; team_member_id: string | null };
      const tmId = staffUser?.team_member_id;

      if (tmId) {
        const { data: delegateAssignment } = await supabase
          .from('sales_experience_assignments')
          .select('id, agency_id')
          .eq('delegate_team_member_id', tmId)
          .in('status', ['active', 'pending', 'completed'])
          .limit(1)
          .maybeSingle();

        if (delegateAssignment) {
          agencyId = delegateAssignment.agency_id;
          isStaffDelegate = true;
          staffSenderId = staffUser.id;
        }
      }

      if (!isStaffDelegate) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (authHeader) {
      // JWT auth
      const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });

      const jwt = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseUser.auth.getUser(jwt);
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired session' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = user.id;

      // Get user's profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, agency_id, role')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        return new Response(
          JSON.stringify({ error: 'Profile not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      isAdmin = profile.role === 'admin';
      const isAgencyOwner = !!profile.agency_id;

      // Check if user is key employee
      const { data: keyEmployee } = await supabase
        .from('key_employees')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const isKeyEmployee = !!keyEmployee;

      // Use key employee's agency_id if they don't have one directly
      if (isKeyEmployee && keyEmployee?.agency_id && !profile.agency_id) {
        profile.agency_id = keyEmployee.agency_id;
      }

      // Delegate fallback: match user email to delegate team member
      let isDelegate = false;
      if (!isAdmin && !isAgencyOwner && !isKeyEmployee && user.email) {
        const { data: myTeamMembers } = await supabase
          .from('team_members')
          .select('id')
          .ilike('email', user.email);

        if (myTeamMembers && myTeamMembers.length > 0) {
          const tmIds = myTeamMembers.map((tm: { id: string }) => tm.id);
          const { data: delegateAssignment } = await supabase
            .from('sales_experience_assignments')
            .select('id, agency_id')
            .in('delegate_team_member_id', tmIds)
            .in('status', ['active', 'pending', 'completed'])
            .limit(1)
            .maybeSingle();
          if (delegateAssignment) {
            isDelegate = true;
            profile.agency_id = delegateAssignment.agency_id;
          }
        }
      }

      if (!isAdmin && !isAgencyOwner && !isKeyEmployee && !isDelegate) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      agencyId = profile.agency_id;
    } else {
      return new Response(
        JSON.stringify({ error: 'Missing authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: RequestBody = await req.json();

    switch (body.action) {
      case 'send': {
        const { assignment_id, content } = body as SendMessageBody;

        if (!assignment_id || !content?.trim()) {
          return new Response(
            JSON.stringify({ error: 'Missing assignment_id or content' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify assignment access
        const { data: assignment, error: assignmentError } = await supabase
          .from('sales_experience_assignments')
          .select('id, agency_id')
          .eq('id', assignment_id)
          .single();

        if (assignmentError || !assignment) {
          return new Response(
            JSON.stringify({ error: 'Assignment not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Non-admins can only message their own agency's assignment
        if (!isAdmin && assignment.agency_id !== agencyId) {
          return new Response(
            JSON.stringify({ error: 'Access denied to this assignment' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Determine sender type
        const senderType = isAdmin ? 'coach' : isStaffDelegate ? 'manager' : 'owner';

        // Insert message (sender_user_id is nullable for staff delegates)
        const { data: message, error: insertError } = await supabase
          .from('sales_experience_messages')
          .insert({
            assignment_id,
            sender_type: senderType,
            sender_user_id: userId || null,
            staff_sender_id: staffSenderId || null,
            content: content.trim(),
          })
          .select()
          .single();

        if (insertError) {
          console.error('Insert message error:', insertError);
          return new Response(
            JSON.stringify({ error: 'Failed to send message' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list': {
        const { assignment_id } = body as GetMessagesBody;

        let query = supabase
          .from('sales_experience_messages')
          .select(`
            *,
            sender:profiles!sender_user_id(full_name, avatar_url),
            sales_experience_assignments(agency_id, agencies(name))
          `)
          .order('created_at', { ascending: false });

        if (isAdmin) {
          // Admin can see all messages, optionally filtered by assignment
          if (assignment_id) {
            query = query.eq('assignment_id', assignment_id);
          }
          query = query.limit(200);
        } else if (isStaffDelegate) {
          // Staff delegate: get the assignment for their agency
          const { data: assignment } = await supabase
            .from('sales_experience_assignments')
            .select('id')
            .eq('agency_id', agencyId)
            .in('status', ['active', 'pending', 'completed'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!assignment) {
            return new Response(
              JSON.stringify({ messages: [] }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Staff delegates see all messages for the assignment (no user-level filtering)
          query = query.eq('assignment_id', assignment.id);
        } else {
          // Non-admin JWT user: get their agency's assignment
          const { data: assignment } = await supabase
            .from('sales_experience_assignments')
            .select('id')
            .eq('agency_id', agencyId)
            .in('status', ['active', 'pending', 'completed'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!assignment) {
            return new Response(
              JSON.stringify({ messages: [] }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          query = query.eq('assignment_id', assignment.id);

          // Filter messages for JWT users based on their role
          if (userId) {
            query = query.or(
              `sender_user_id.eq.${userId},` +
              `recipient_user_id.is.null,` +
              `recipient_user_id.eq.${userId}`
            );
          }
        }

        const { data: messages, error: listError } = await query;

        if (listError) {
          console.error('List messages error:', listError);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch messages' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ messages: messages || [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'mark_read': {
        const { message_id } = body as MarkReadBody;

        if (!message_id) {
          return new Response(
            JSON.stringify({ error: 'Missing message_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get the message to verify access
        const { data: message, error: messageError } = await supabase
          .from('sales_experience_messages')
          .select('*, sales_experience_assignments(agency_id)')
          .eq('id', message_id)
          .single();

        if (messageError || !message) {
          return new Response(
            JSON.stringify({ error: 'Message not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify access
        const assignmentAgencyId = (message.sales_experience_assignments as any)?.agency_id;
        if (!isAdmin && assignmentAgencyId !== agencyId) {
          return new Response(
            JSON.stringify({ error: 'Access denied' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // For staff delegates, just mark coach messages as read
        if (isStaffDelegate) {
          if (message.sender_type === 'coach' && !message.read_at) {
            await supabase
              .from('sales_experience_messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', message_id);
          }
        } else if (userId) {
          // JWT user: mark as read based on role
          const shouldMarkRead =
            (isAdmin && message.sender_type !== 'coach') ||
            (!isAdmin && message.sender_type === 'coach');

          if (shouldMarkRead && !message.read_at) {
            await supabase
              .from('sales_experience_messages')
              .update({
                read_at: new Date().toISOString(),
                read_by: userId,
              })
              .eq('id', message_id);
          }
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Must be: send, list, or mark_read' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Sales experience messages error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
