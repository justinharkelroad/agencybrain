import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type DeliverableType = 'sales_process' | 'accountability_metrics' | 'consequence_ladder';

interface SalesProcessContent {
  rapport: string[];
  coverage: string[];
  closing: string[];
}

interface AccountabilityMetricsContent {
  categories: Array<{
    name: string;
    items: string[];
  }>;
}

interface ConsequenceLadderContent {
  steps: Array<{
    incident: number;
    title: string;
    description: string;
  }>;
}

type DeliverableContent = SalesProcessContent | AccountabilityMetricsContent | ConsequenceLadderContent;

interface SaveContentBody {
  deliverable_id: string;
  content: DeliverableContent;
  mark_complete?: boolean;
}

interface GetDeliverablesBody {
  action: 'list';
  assignment_id?: string;
}

type RequestBody = SaveContentBody | GetDeliverablesBody;

// Validate content structure based on deliverable type
function validateContent(type: DeliverableType, content: DeliverableContent): boolean {
  switch (type) {
    case 'sales_process': {
      const sp = content as SalesProcessContent;
      return (
        Array.isArray(sp.rapport) &&
        Array.isArray(sp.coverage) &&
        Array.isArray(sp.closing)
      );
    }
    case 'accountability_metrics': {
      const am = content as AccountabilityMetricsContent;
      return (
        Array.isArray(am.categories) &&
        am.categories.every(
          (c) => typeof c.name === 'string' && Array.isArray(c.items)
        )
      );
    }
    case 'consequence_ladder': {
      const cl = content as ConsequenceLadderContent;
      return (
        Array.isArray(cl.steps) &&
        cl.steps.every(
          (s) =>
            typeof s.incident === 'number' &&
            typeof s.title === 'string' &&
            typeof s.description === 'string'
        )
      );
    }
    default:
      return false;
  }
}

// Check if content is complete enough
function isContentComplete(type: DeliverableType, content: DeliverableContent): boolean {
  switch (type) {
    case 'sales_process': {
      const sp = content as SalesProcessContent;
      return sp.rapport.length > 0 && sp.coverage.length > 0 && sp.closing.length > 0;
    }
    case 'accountability_metrics': {
      const am = content as AccountabilityMetricsContent;
      return am.categories.length > 0 && am.categories.every((c) => c.items.length > 0);
    }
    case 'consequence_ladder': {
      const cl = content as ConsequenceLadderContent;
      return cl.steps.length >= 2; // At least 2 steps
    }
    default:
      return false;
  }
}

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

    // Handle list action
    if ('action' in body && body.action === 'list') {
      let assignmentId = (body as GetDeliverablesBody).assignment_id;

      // If no assignment_id provided, get user's agency assignment
      if (!assignmentId && !isAdmin) {
        const { data: assignment } = await supabase
          .from('sales_experience_assignments')
          .select('id')
          .eq('agency_id', profile.agency_id)
          .in('status', ['active', 'pending', 'completed'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        assignmentId = assignment?.id;
      }

      if (!assignmentId) {
        return new Response(
          JSON.stringify({ deliverables: [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: deliverables, error: listError } = await supabase
        .from('sales_experience_deliverables')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('created_at');

      if (listError) {
        console.error('List deliverables error:', listError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch deliverables' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ deliverables: deliverables || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle save action
    const { deliverable_id, content, mark_complete } = body as SaveContentBody;

    if (!deliverable_id || !content) {
      return new Response(
        JSON.stringify({ error: 'Missing deliverable_id or content' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get deliverable and verify access
    const { data: deliverable, error: deliverableError } = await supabase
      .from('sales_experience_deliverables')
      .select(`
        *,
        sales_experience_assignments(id, agency_id)
      `)
      .eq('id', deliverable_id)
      .single();

    if (deliverableError || !deliverable) {
      return new Response(
        JSON.stringify({ error: 'Deliverable not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const assignment = deliverable.sales_experience_assignments as { id: string; agency_id: string };
    if (!isAdmin && assignment.agency_id !== profile.agency_id) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate content structure
    if (!validateContent(deliverable.deliverable_type as DeliverableType, content)) {
      return new Response(
        JSON.stringify({ error: 'Invalid content structure for deliverable type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine status
    let newStatus = deliverable.status;
    if (mark_complete) {
      newStatus = 'complete';
    } else if (deliverable.status === 'draft') {
      newStatus = 'in_progress';
    }

    // Auto-complete if content is sufficient and explicitly marked
    const contentIsComplete = isContentComplete(deliverable.deliverable_type as DeliverableType, content);
    if (mark_complete && !contentIsComplete) {
      return new Response(
        JSON.stringify({ error: 'Content is not complete enough to mark as complete' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update deliverable
    const { data: updated, error: updateError } = await supabase
      .from('sales_experience_deliverables')
      .update({
        content_json: content,
        status: newStatus,
      })
      .eq('id', deliverable_id)
      .select()
      .single();

    if (updateError) {
      console.error('Update deliverable error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to save content' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, deliverable: updated }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Save deliverable content error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
