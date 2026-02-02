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
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth token
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const isAdmin = profile.role === 'admin';
    const isOwnerOrManager = ['agency_owner', 'key_employee'].includes(profile.role);

    if (!isAdmin && !isOwnerOrManager) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        if (!isAdmin && assignment.agency_id !== profile.agency_id) {
          return new Response(
            JSON.stringify({ error: 'Access denied to this assignment' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Determine sender type
        const senderType = isAdmin ? 'coach' : 'owner';

        // Insert message
        const { data: message, error: insertError } = await supabase
          .from('sales_experience_messages')
          .insert({
            assignment_id,
            sender_type: senderType,
            sender_user_id: user.id,
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
        } else {
          // Non-admin: get their agency's assignment
          const { data: assignment } = await supabase
            .from('sales_experience_assignments')
            .select('id')
            .eq('agency_id', profile.agency_id)
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
        if (!isAdmin && assignmentAgencyId !== profile.agency_id) {
          return new Response(
            JSON.stringify({ error: 'Access denied' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Only mark as read if it's a message TO the user (not FROM the user)
        // Coach messages should be marked read by owner, owner messages by coach
        const shouldMarkRead =
          (isAdmin && message.sender_type !== 'coach') ||
          (!isAdmin && message.sender_type === 'coach');

        if (shouldMarkRead && !message.read_at) {
          const { error: updateError } = await supabase
            .from('sales_experience_messages')
            .update({
              read_at: new Date().toISOString(),
              read_by: user.id,
            })
            .eq('id', message_id);

          if (updateError) {
            console.error('Mark read error:', updateError);
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
