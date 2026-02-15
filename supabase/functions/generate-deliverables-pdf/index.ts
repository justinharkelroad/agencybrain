import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

interface RequestBody {
  assignment_id?: string;
}

// Generate HTML for PDF (will be converted by client)
function generatePdfHtml(
  agencyName: string,
  agencyLogoUrl: string | null,
  salesProcess: SalesProcessContent,
  accountabilityMetrics: AccountabilityMetricsContent,
  consequenceLadder: ConsequenceLadderContent,
  generatedDate: string
): string {
  const logoHtml = agencyLogoUrl
    ? `<img src="${agencyLogoUrl}" alt="${agencyName}" style="max-width: 150px; max-height: 60px; margin-bottom: 10px;" />`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${agencyName} - Sales Experience Deliverables</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #2563eb;
    }
    .header h1 {
      font-size: 28px;
      color: #1a1a1a;
      margin-bottom: 5px;
    }
    .header .subtitle {
      color: #666;
      font-size: 14px;
    }
    .section {
      margin-bottom: 40px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 20px;
      color: #2563eb;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e5e5;
    }
    .columns {
      display: flex;
      gap: 20px;
    }
    .column {
      flex: 1;
      background: #f8fafc;
      border-radius: 8px;
      padding: 15px;
    }
    .column-title {
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 10px;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .column ul {
      list-style: none;
      padding: 0;
    }
    .column li {
      padding: 6px 0;
      border-bottom: 1px solid #e5e5e5;
      font-size: 13px;
    }
    .column li:last-child {
      border-bottom: none;
    }
    .category {
      margin-bottom: 20px;
    }
    .category-name {
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 8px;
      font-size: 15px;
    }
    .category ul {
      list-style-type: disc;
      padding-left: 25px;
    }
    .category li {
      padding: 3px 0;
      font-size: 13px;
    }
    .step {
      display: flex;
      gap: 15px;
      margin-bottom: 15px;
      padding: 15px;
      background: #f8fafc;
      border-radius: 8px;
      border-left: 4px solid #2563eb;
    }
    .step-number {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      background: #2563eb;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
    }
    .step-content {
      flex: 1;
    }
    .step-title {
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 4px;
    }
    .step-description {
      font-size: 13px;
      color: #666;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #e5e5e5;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    @media print {
      body {
        padding: 20px;
      }
      .section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    ${logoHtml}
    <h1>${agencyName}</h1>
    <div class="subtitle">8-Week Sales Experience Deliverables</div>
    <div class="subtitle">Generated: ${generatedDate}</div>
  </div>

  <div class="section">
    <h2 class="section-title">Sales Process Framework</h2>
    <div class="columns">
      <div class="column">
        <div class="column-title">Rapport</div>
        <ul>
          ${salesProcess.rapport.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
          ${salesProcess.rapport.length === 0 ? '<li style="color: #999; font-style: italic;">No items defined</li>' : ''}
        </ul>
      </div>
      <div class="column">
        <div class="column-title">Coverage</div>
        <ul>
          ${salesProcess.coverage.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
          ${salesProcess.coverage.length === 0 ? '<li style="color: #999; font-style: italic;">No items defined</li>' : ''}
        </ul>
      </div>
      <div class="column">
        <div class="column-title">Closing</div>
        <ul>
          ${salesProcess.closing.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
          ${salesProcess.closing.length === 0 ? '<li style="color: #999; font-style: italic;">No items defined</li>' : ''}
        </ul>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Accountability Metrics</h2>
    ${accountabilityMetrics.categories.length === 0
      ? '<p style="color: #999; font-style: italic;">No categories defined</p>'
      : accountabilityMetrics.categories.map(cat => `
        <div class="category">
          <div class="category-name">${escapeHtml(cat.name)}</div>
          <ul>
            ${cat.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>
      `).join('')}
  </div>

  <div class="section">
    <h2 class="section-title">Consequence Ladder</h2>
    ${consequenceLadder.steps.length === 0
      ? '<p style="color: #999; font-style: italic;">No steps defined</p>'
      : consequenceLadder.steps.map(step => `
        <div class="step">
          <div class="step-number">${step.incident}</div>
          <div class="step-content">
            <div class="step-title">${escapeHtml(step.title)}</div>
            <div class="step-description">${escapeHtml(step.description)}</div>
          </div>
        </div>
      `).join('')}
  </div>

  <div class="footer">
    Generated via AgencyBrain 8-Week Sales Experience
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

    // Check if user is agency owner (has agency_id) or key employee
    let isOwnerOrManager = !!profile.agency_id;

    if (!isOwnerOrManager) {
      // Check key_employees table
      const { data: keyEmployee } = await supabase
        .from('key_employees')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (keyEmployee?.agency_id) {
        isOwnerOrManager = true;
        profile.agency_id = keyEmployee.agency_id;
      }
    }

    if (!isAdmin && !isOwnerOrManager) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: RequestBody = await req.json().catch(() => ({}));
    let assignmentId = body.assignment_id;

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
        JSON.stringify({ error: 'No assignment found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify access to assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from('sales_experience_assignments')
      .select(`
        id,
        agency_id,
        agencies(name, logo_url)
      `)
      .eq('id', assignmentId)
      .single();

    if (assignmentError || !assignment) {
      return new Response(
        JSON.stringify({ error: 'Assignment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isAdmin && assignment.agency_id !== profile.agency_id) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all deliverables
    const { data: deliverables, error: deliverablesError } = await supabase
      .from('sales_experience_deliverables')
      .select('*')
      .eq('assignment_id', assignmentId);

    if (deliverablesError) {
      console.error('Fetch deliverables error:', deliverablesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch deliverables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract content for each deliverable type
    const salesProcess: SalesProcessContent = { rapport: [], coverage: [], closing: [] };
    const accountabilityMetrics: AccountabilityMetricsContent = { categories: [] };
    const consequenceLadder: ConsequenceLadderContent = { steps: [] };

    for (const deliverable of deliverables || []) {
      const content = deliverable.content_json;
      switch (deliverable.deliverable_type) {
        case 'sales_process':
          if (content) {
            salesProcess.rapport = content.rapport || [];
            salesProcess.coverage = content.coverage || [];
            salesProcess.closing = content.closing || [];
          }
          break;
        case 'accountability_metrics':
          if (content) {
            accountabilityMetrics.categories = content.categories || [];
          }
          break;
        case 'consequence_ladder':
          if (content) {
            consequenceLadder.steps = content.steps || [];
          }
          break;
      }
    }

    const agency = (assignment.agencies as unknown as Array<{ name: string; logo_url: string | null }> | null)?.[0] ?? null;
    const agencyName = agency?.name || 'Agency';
    const agencyLogoUrl = agency?.logo_url || null;
    const generatedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Generate HTML
    const html = generatePdfHtml(
      agencyName,
      agencyLogoUrl,
      salesProcess,
      accountabilityMetrics,
      consequenceLadder,
      generatedDate
    );

    return new Response(
      JSON.stringify({
        html,
        agency_name: agencyName,
        generated_date: generatedDate,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Generate deliverables PDF error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate PDF' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
