import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { BRAND, buildEmailHtml, EmailComponents } from "../_shared/email-template.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CallScoreNotificationRequest {
  call_id: string;
  agency_id: string;
}

// Format duration from seconds to MM:SS
function formatDuration(seconds: number | null): string {
  if (!seconds) return 'N/A';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format snake_case or double underscore to readable label
function formatSnakeCase(key: string): string {
  return key
    .replace(/__/g, ' / ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Render progress bar HTML
function renderProgressBar(score: number, max: number = 100): string {
  const percentage = Math.round((score / max) * 100);
  const filled = Math.round(percentage / 10);
  const empty = 10 - filled;
  return `<span style="font-family: monospace; letter-spacing: 2px;">${'█'.repeat(filled)}${'░'.repeat(empty)}</span>`;
}

// Score range configuration (matches frontend)
const SCORE_RANGES = [
  { label: 'Excellent', min: 80, max: 100, color: '#22c55e', emoji: '🌟' },
  { label: 'Good', min: 60, max: 79, color: '#facc15', emoji: '⭐' },
  { label: 'Needs Work', min: 40, max: 59, color: '#f97316', emoji: '📈' },
  { label: 'Poor', min: 0, max: 39, color: '#ef4444', emoji: '⚠️' },
];

function getScoreRange(score: number) {
  return SCORE_RANGES.find(r => score >= r.min && score <= r.max) || SCORE_RANGES[SCORE_RANGES.length - 1];
}

// Legacy: Get star visualization for rank (historical calls)
function getStarsForRank(rank: string | null): string {
  const starMap: Record<string, number> = {
    'GREAT': 5,
    'GOOD': 4,
    'AVERAGE': 3,
    'BELOW AVERAGE': 2,
    'POOR': 1,
  };
  const count = starMap[rank?.toUpperCase() || ''] || 3;
  return '⭐'.repeat(count);
}

function getStarsForScore(score: number, max: number = 10): string {
  const normalized = Math.round((score / max) * 5);
  return '⭐'.repeat(Math.max(1, normalized));
}

// Dynamic section renderers
function renderSkillScores(skillScores: any): string {
  if (!skillScores) return '';
  
  // Check if we have detailed array format with feedback
  if (Array.isArray(skillScores)) {
    const hasDetailedData = skillScores.some((item: any) => item?.feedback || item?.tip);
    
    if (hasDetailedData) {
      // Render detailed skill breakdown with feedback and tips
      const cards = skillScores
        .filter((item: any) => item && (item.skill_name || item.name))
        .map((item: any) => {
          const name = item.skill_name || item.name || 'Unknown';
          const score = typeof item.score === 'number' ? item.score : 0;
          const maxScore = item.max_score || 10;
          const feedback = item.feedback;
          const tip = item.tip;
          
          return `
            <div style="background: #1e283a; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="color: #ffffff; font-size: 14px;">${name}</strong>
                <span style="background: #374151; color: #9ca3af; padding: 4px 10px; border-radius: 9999px; font-size: 12px;">${score}/${maxScore}</span>
              </div>
              ${feedback ? `<p style="margin: 8px 0; color: #d1d5db; font-size: 13px; line-height: 1.5;">${feedback}</p>` : ''}
              ${tip ? `
                <div style="margin-top: 8px; background: rgba(250, 204, 21, 0.1); padding: 8px 12px; border-radius: 6px;">
                  <span style="color: #facc15; font-size: 12px;">💡 ${tip}</span>
                </div>
              ` : ''}
            </div>
          `;
        }).join('');

      return `
        <div style="margin-bottom: 24px;">
          <h3 style="color: #1e283a; margin-bottom: 12px; font-size: 16px;">📊 SKILL BREAKDOWN</h3>
          ${cards}
        </div>
      `;
    }
  }
  
  // Fallback: Simple table format for scores only
  let entries: [string, number][] = [];
  
  // Handle array format: [{ skill_name: "Rapport", score: 7 }, ...]
  if (Array.isArray(skillScores)) {
    entries = skillScores
      .filter((item: any) => item && (item.skill_name || item.name) && typeof item.score === 'number')
      .map((item: any) => {
        const name = item.skill_name || item.name || 'Unknown';
        // Scale 0-10 scores to 0-100 if needed
        const score = typeof item.score === 'number' 
          ? (item.score <= 10 ? Math.round(item.score * 10) : item.score) 
          : 0;
        return [name, score] as [string, number];
      });
  } 
  // Handle object format: { rapport: 70, coverage: 80, ... }
  else if (typeof skillScores === 'object' && Object.keys(skillScores).length > 0) {
    entries = Object.entries(skillScores)
      .filter(([_, value]) => typeof value === 'number')
      .map(([key, value]) => {
        const score = typeof value === 'number' ? value : 0;
        return [formatSnakeCase(key), score] as [string, number];
      });
  }
  
  if (entries.length === 0) return '';
  
  const rows = entries.map(([name, score]) => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${name}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${renderProgressBar(score)}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${score}/100</td>
    </tr>
  `).join('');

  return `
    <div style="margin-bottom: 24px;">
      <h3 style="color: #1e283a; margin-bottom: 12px; font-size: 16px;">📊 SKILL SCORES</h3>
      <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 8px;">
        ${rows}
      </table>
    </div>
  `;
}

function renderTalkMetrics(
  agentPercentRaw: number | null,
  customerPercentRaw: number | null,
  deadAirPercentRaw: number | null,
  agentSeconds: number | null,
  customerSeconds: number | null,
  deadAirSeconds: number | null,
): string {
  const totalSeconds = (agentSeconds || 0) + (customerSeconds || 0) + (deadAirSeconds || 0);
  const hasUsableSeconds = totalSeconds > 0;

  const agentPercent = hasUsableSeconds
    ? ((agentSeconds || 0) / totalSeconds) * 100
    : agentPercentRaw;
  const customerPercent = hasUsableSeconds
    ? ((customerSeconds || 0) / totalSeconds) * 100
    : customerPercentRaw;
  const deadAirPercent = hasUsableSeconds
    ? ((deadAirSeconds || 0) / totalSeconds) * 100
    : deadAirPercentRaw;

  if (agentPercent === null) return '';

  const getInsight = (): string => {
    if (agentPercent && agentPercent > 70) return '💡 Consider letting the customer talk more to uncover their needs.';
    if (agentPercent && agentPercent < 40) return '💡 Great listening! Ensure you\'re also providing enough guidance.';
    return '💡 Good balance of talking and listening.';
  };

  return `
    <div style="margin-bottom: 24px;">
      <h3 style="color: #1e283a; margin-bottom: 12px; font-size: 16px;">🎙️ TALK-TO-LISTEN RATIO</h3>
      <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 8px; padding: 12px;">
        <tr>
          <td style="padding: 8px 12px;">Agent</td>
          <td style="padding: 8px 12px;">${renderProgressBar(agentPercent || 0)}</td>
          <td style="padding: 8px 12px; text-align: right;">${agentPercent}%</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px;">Customer</td>
          <td style="padding: 8px 12px;">${renderProgressBar(customerPercent || 0)}</td>
          <td style="padding: 8px 12px; text-align: right;">${customerPercent}%</td>
        </tr>
        ${deadAirPercent !== null ? `
        <tr>
          <td style="padding: 8px 12px;">Dead Air</td>
          <td style="padding: 8px 12px;">${renderProgressBar(deadAirPercent)}</td>
          <td style="padding: 8px 12px; text-align: right;">${deadAirPercent}%</td>
        </tr>
        ` : ''}
      </table>
      <p style="color: #64748b; font-size: 13px; margin-top: 8px;">${getInsight()}</p>
    </div>
  `;
}

function renderClientProfile(clientProfile: Record<string, any> | null): string {
  if (!clientProfile || Object.keys(clientProfile).length === 0) return '';
  
  const rows = Object.entries(clientProfile)
    .filter(([_, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => {
      let displayValue = value;
      if (Array.isArray(value)) {
        displayValue = value.join(', ');
      } else if (typeof value === 'object') {
        displayValue = JSON.stringify(value);
      }
      return `
        <tr>
          <td style="padding: 6px 12px; color: #6b7280; width: 140px;">${formatSnakeCase(key)}:</td>
          <td style="padding: 6px 12px; font-weight: 500;">${displayValue}</td>
        </tr>
      `;
    }).join('');

  if (!rows) return '';

  return `
    <div style="margin-bottom: 24px;">
      <h3 style="color: #1e283a; margin-bottom: 12px; font-size: 16px;">📋 EXTRACTED DATA</h3>
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px;">
        <table style="width: 100%;">
          ${rows}
        </table>
      </div>
    </div>
  `;
}

function renderCriticalAssessment(criticalGaps: any, summary: string | null): string {
  const assessment = criticalGaps?.assessment || criticalGaps?.critical_assessment;
  const content = assessment || summary;
  if (!content) return '';

  return `
    <div style="margin-bottom: 24px;">
      <h3 style="color: #1e283a; margin-bottom: 12px; font-size: 16px;">🎯 CRITICAL ASSESSMENT</h3>
      <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px;">
        <p style="margin: 0; color: #92400e;">${content}</p>
      </div>
    </div>
  `;
}

function renderSectionScoresSales(sectionScores: Record<string, any> | null): string {
  if (!sectionScores || Object.keys(sectionScores).length === 0) return '';

  const sections = Object.entries(sectionScores).map(([key, section]) => {
    const score = section?.score ?? 'N/A';
    const wins = section?.wins || [];
    const failures = section?.failures || [];
    const coaching = section?.coaching;

    return `
      <div style="border-bottom: 1px solid #e5e7eb; padding: 16px 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <strong style="color: #1e283a;">${formatSnakeCase(key)}</strong>
          <span style="background: #e0e7ff; color: #3730a3; padding: 4px 12px; border-radius: 9999px; font-weight: 600;">${score}/100</span>
        </div>
        ${wins.length > 0 ? `
          <div style="margin-top: 8px;">
            <span style="color: #22c55e; font-weight: 600;">✓ Wins:</span>
            <ul style="margin: 4px 0 0 20px; padding: 0; color: #374151;">
              ${wins.map((w: string) => `<li style="margin: 2px 0;">${w}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        ${failures.length > 0 ? `
          <div style="margin-top: 8px;">
            <span style="color: #ef4444; font-weight: 600;">✗ Missed:</span>
            <ul style="margin: 4px 0 0 20px; padding: 0; color: #374151;">
              ${failures.map((f: string) => `<li style="margin: 2px 0;">${f}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        ${coaching ? `
          <div style="margin-top: 8px; background: #f0f9ff; padding: 8px 12px; border-radius: 6px;">
            <span style="color: #0369a1;">💡 ${coaching}</span>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
    <div style="margin-bottom: 24px;">
      <h3 style="color: #1e283a; margin-bottom: 12px; font-size: 16px;">📝 SECTION SCORES</h3>
      <div style="background: #f9fafb; border-radius: 8px; padding: 0 16px;">
        ${sections}
      </div>
    </div>
  `;
}

function renderSectionScoresService(sectionScores: any[] | null): string {
  if (!sectionScores || !Array.isArray(sectionScores) || sectionScores.length === 0) return '';

  const sections = sectionScores.map((section: any) => {
    const name = section?.section_name || 'Section';
    const score = section?.score ?? 'N/A';
    const maxScore = section?.max_score || 10;
    const feedback = section?.feedback;
    const tip = section?.tip;

    return `
      <div style="border-bottom: 1px solid #e5e7eb; padding: 16px 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <strong style="color: #1e283a;">${name}</strong>
          <span style="background: #e0e7ff; color: #3730a3; padding: 4px 12px; border-radius: 9999px; font-weight: 600;">${score}/${maxScore}</span>
        </div>
        ${feedback ? `<p style="margin: 4px 0; color: #374151;">${feedback}</p>` : ''}
        ${tip ? `
          <div style="margin-top: 8px; background: #f0f9ff; padding: 8px 12px; border-radius: 6px;">
            <span style="color: #0369a1;">💡 ${tip}</span>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
    <div style="margin-bottom: 24px;">
      <h3 style="color: #1e283a; margin-bottom: 12px; font-size: 16px;">📝 SECTION SCORES</h3>
      <div style="background: #f9fafb; border-radius: 8px; padding: 0 16px;">
        ${sections}
      </div>
    </div>
  `;
}

function renderExecutionChecklist(discoveryWins: any): string {
  if (!discoveryWins) return '';

  let items: Array<{ label: string; checked: boolean; evidence?: string }> = [];

  // Handle object format: { key: boolean }
  if (typeof discoveryWins === 'object' && !Array.isArray(discoveryWins)) {
    items = Object.entries(discoveryWins).map(([key, value]) => ({
      label: formatSnakeCase(key),
      checked: Boolean(value),
    }));
  }
  // Handle array format: [{ label, checked, evidence }]
  else if (Array.isArray(discoveryWins)) {
    items = discoveryWins.map((item: any) => ({
      label: item?.label || String(item),
      checked: Boolean(item?.checked),
      evidence: item?.evidence,
    }));
  }

  if (items.length === 0) return '';

  const checkedCount = items.filter(i => i.checked).length;
  const rows = items.map(item => `
    <tr>
      <td style="padding: 6px 12px; width: 30px; text-align: center;">
        ${item.checked ? '<span style="color: #22c55e;">✓</span>' : '<span style="color: #ef4444;">✗</span>'}
      </td>
      <td style="padding: 6px 12px;">
        ${item.label}
        ${item.evidence ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">"${item.evidence}"</div>` : ''}
      </td>
    </tr>
  `).join('');

  return `
    <div style="margin-bottom: 24px;">
      <h3 style="color: #1e283a; margin-bottom: 12px; font-size: 16px;">✅ EXECUTION CHECKLIST</h3>
      <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 8px;">
        ${rows}
      </table>
      <p style="color: #64748b; font-size: 13px; margin-top: 8px; text-align: right;">
        Score: <strong>${checkedCount} / ${items.length}</strong> executed
      </p>
    </div>
  `;
}

function renderActionPlan(criticalGaps: any): string {
  const plan = criticalGaps?.corrective_plan || criticalGaps?.corrective_action_plan;
  if (!plan || (typeof plan === 'object' && Object.keys(plan).length === 0)) return '';

  let content = '';
  if (typeof plan === 'string') {
    content = `<p style="margin: 0; color: #374151;">${plan}</p>`;
  } else if (typeof plan === 'object') {
    content = Object.entries(plan).map(([key, value]) => `
      <div style="margin-bottom: 12px;">
        <strong style="color: #1e283a;">${formatSnakeCase(key)}:</strong>
        <p style="margin: 4px 0 0 0; color: #374151;">${value}</p>
      </div>
    `).join('');
  }

  return `
    <div style="margin-bottom: 24px;">
      <h3 style="color: #1e283a; margin-bottom: 12px; font-size: 16px;">🎯 ACTION PLAN</h3>
      <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px;">
        ${content}
      </div>
    </div>
  `;
}

function renderCoachingRecommendations(recommendations: string[] | null): string {
  if (!recommendations || !Array.isArray(recommendations) || recommendations.length === 0) return '';

  const items = recommendations.map((rec, idx) => `
    <li style="margin: 8px 0; color: #374151;">${rec}</li>
  `).join('');

  return `
    <div style="margin-bottom: 24px;">
      <h3 style="color: #1e283a; margin-bottom: 12px; font-size: 16px;">💡 SUGGESTIONS</h3>
      <ol style="margin: 0; padding-left: 20px; background: #f0f9ff; border-radius: 8px; padding: 16px 16px 16px 36px;">
        ${items}
      </ol>
    </div>
  `;
}

function renderSummary(summary: string | null): string {
  if (!summary) return '';

  return `
    <div style="margin-bottom: 24px;">
      <h3 style="color: #1e283a; margin-bottom: 12px; font-size: 16px;">📄 CALL SUMMARY</h3>
      <div style="background: ${BRAND.colors.lightBg}; padding: 16px; border-radius: 8px; border-left: 4px solid ${BRAND.colors.primary};">
        <p style="margin: 0; color: #374151;">${summary}</p>
      </div>
    </div>
  `;
}

function renderNotableQuotes(notableQuotes: any[] | null): string {
  if (!notableQuotes || !Array.isArray(notableQuotes) || notableQuotes.length === 0) return '';

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const quotes = notableQuotes.map((quote: any) => {
    const isAgent = quote.speaker === 'agent';
    const bgColor = isAgent ? '#dbeafe' : '#dcfce7';
    const borderColor = isAgent ? '#3b82f6' : '#22c55e';
    const badgeColor = isAgent ? '#1d4ed8' : '#16a34a';
    const speakerLabel = isAgent ? 'Agent' : 'Customer';
    
    return `
      <div style="background: ${bgColor}; border: 1px solid ${borderColor}40; border-radius: 8px; padding: 12px; margin-bottom: 8px;">
        <table style="width: 100%;">
          <tr>
            ${quote.timestamp_seconds !== undefined ? `
              <td style="width: 50px; vertical-align: top; padding-right: 8px;">
                <span style="font-family: monospace; font-size: 12px; background: #f9fafb; border: 1px solid #e5e7eb; padding: 4px 8px; border-radius: 4px;">${formatTime(quote.timestamp_seconds)}</span>
              </td>
            ` : ''}
            <td style="vertical-align: top;">
              <p style="margin: 0; font-style: italic; color: #1f2937;">"${quote.text}"</p>
              ${quote.context ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">→ ${quote.context}</p>` : ''}
            </td>
            <td style="width: 70px; vertical-align: top; text-align: right;">
              <span style="display: inline-block; font-size: 11px; color: ${badgeColor}; border: 1px solid ${badgeColor}50; padding: 2px 8px; border-radius: 9999px;">${speakerLabel}</span>
            </td>
          </tr>
        </table>
      </div>
    `;
  }).join('');

  return `
    <div style="margin-bottom: 24px;">
      <h3 style="color: #1e283a; margin-bottom: 12px; font-size: 16px;">💬 KEY MOMENTS</h3>
      <div style="border-left: 4px solid #a855f7; padding-left: 16px;">
        ${quotes}
      </div>
    </div>
  `;
}

// Get recipients (team member, agency owner, key employees)
async function getRecipients(supabase: any, agencyId: string, teamMemberId: string): Promise<string[]> {
  const recipients = new Set<string>();
  
  // 1. Team member's staff user email
  const { data: staffUser } = await supabase
    .from('staff_users')
    .select('email')
    .eq('team_member_id', teamMemberId)
    .eq('is_active', true)
    .not('email', 'is', null)
    .maybeSingle();
  
  if (staffUser?.email) {
    recipients.add(staffUser.email.toLowerCase());
  }
  
  // 2. All profiles with this agency (agency owner + any linked users)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('email')
    .eq('agency_id', agencyId)
    .not('email', 'is', null);
  
  for (const profile of profiles || []) {
    if (profile.email) {
      recipients.add(profile.email.toLowerCase());
    }
  }
  
  // 3. Key employees (managers with elevated access)
  const { data: keyEmployees } = await supabase
    .from('key_employees')
    .select('user_id')
    .eq('agency_id', agencyId);
  
  if (keyEmployees && keyEmployees.length > 0) {
    const userIds = keyEmployees.map((ke: any) => ke.user_id);
    const { data: keProfiles } = await supabase
      .from('profiles')
      .select('email')
      .in('id', userIds)
      .not('email', 'is', null);
    
    for (const profile of keProfiles || []) {
      if (profile.email) {
        recipients.add(profile.email.toLowerCase());
      }
    }
  }
  
  // 4. All Managers in the agency (team_members with role 'Manager')
  const { data: managers } = await supabase
    .from('team_members')
    .select('id, email')
    .eq('agency_id', agencyId)
    .eq('role', 'Manager');
  
  if (managers && managers.length > 0) {
    console.log(`[getRecipients] Found ${managers.length} managers in agency`);
    for (const manager of managers) {
      // Use team_members.email as source of truth (controlled by agency owner)
      if (manager.email) {
        recipients.add(manager.email.toLowerCase());
        console.log(`[getRecipients] Added manager email: ${manager.email}`);
      }
    }
  }
  
  return Array.from(recipients);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SITE_URL = Deno.env.get('SITE_URL') || 'https://myagencybrain.com';

    if (!RESEND_API_KEY) {
      console.error('[send-call-score-notification] RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: CallScoreNotificationRequest = await req.json();
    
    console.log('[send-call-score-notification] Processing call:', body.call_id);

    // 1. Check if agency has call scoring notifications enabled
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('id, name, call_scoring_email_enabled, timezone')
      .eq('id', body.agency_id)
      .single();

    if (agencyError || !agency) {
      console.error('[send-call-score-notification] Agency lookup failed:', agencyError);
      return new Response(
        JSON.stringify({ error: 'Agency not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!agency.call_scoring_email_enabled) {
      console.log('[send-call-score-notification] Call scoring emails disabled for agency:', agency.name);
      return new Response(
        JSON.stringify({ success: true, message: 'Call scoring emails disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fetch the call record with team member info
    const { data: call, error: callError } = await supabase
      .from('agency_calls')
      .select(`
        id,
        original_filename,
        call_duration_seconds,
        call_type,
        overall_score,
        potential_rank,
        skill_scores,
        section_scores,
        discovery_wins,
        critical_gaps,
        coaching_recommendations,
        client_profile,
        summary,
        notable_quotes,
        agent_talk_percent,
        customer_talk_percent,
        dead_air_percent,
        agent_talk_seconds,
        customer_talk_seconds,
        dead_air_seconds,
        analyzed_at,
        team_member:team_members!agency_calls_team_member_id_fkey(id, name)
      `)
      .eq('id', body.call_id)
      .single();

    if (callError || !call) {
      console.error('[send-call-score-notification] Call lookup failed:', callError);
      return new Response(
        JSON.stringify({ error: 'Call not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Get recipients
    // Note: team_member is typed as array by Supabase but returned as single object at runtime
    const teamMemberId = (call.team_member as any)?.id;
    if (!teamMemberId) {
      console.log('[send-call-score-notification] No team member associated with call');
      return new Response(
        JSON.stringify({ success: true, message: 'No team member' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const recipients = await getRecipients(supabase, body.agency_id, teamMemberId);

    if (recipients.length === 0) {
      console.log('[send-call-score-notification] No recipients found');
      return new Response(
        JSON.stringify({ success: true, message: 'No recipients' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Determine call type and build email content
    const callType = call.call_type || 'sales';
    const teamMemberName = (call.team_member as any)?.name || 'Unknown';
    const filename = call.original_filename || 'Call Recording';
    const timezone = agency.timezone || 'America/New_York';
    
    const analyzedAt = call.analyzed_at 
      ? new Date(call.analyzed_at).toLocaleString('en-US', { 
          timeZone: timezone, 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true 
        })
      : 'Just now';

    // Build dynamic email body
    let emailBody = '';

    // Call metadata header
    emailBody += `
      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <table style="width: 100%;">
          <tr><td style="padding: 4px 0; color: #6b7280; width: 120px;">Team Member:</td><td style="font-weight: 600;">${teamMemberName}</td></tr>
          <tr><td style="padding: 4px 0; color: #6b7280;">File:</td><td>${filename}</td></tr>
          <tr><td style="padding: 4px 0; color: #6b7280;">Duration:</td><td>${formatDuration(call.call_duration_seconds)}</td></tr>
          <tr><td style="padding: 4px 0; color: #6b7280;">Scored:</td><td>${analyzedAt}</td></tr>
        </table>
      </div>
    `;

    // Performance score section - now score-based for all call types
    if (callType === 'sales') {
      const score = call.overall_score ?? 0;
      const scoreRange = getScoreRange(score);
      emailBody += `
        <div style="text-align: center; margin-bottom: 24px; padding: 24px; background: linear-gradient(135deg, #1e283a, #020817); border-radius: 8px; color: white;">
          <div style="font-size: 48px; font-weight: 700; color: ${scoreRange.color};">${score}%</div>
          <div style="margin-top: 8px; font-size: 18px; color: ${scoreRange.color}; font-weight: 600;">${scoreRange.emoji} ${scoreRange.label}</div>
        </div>
      `;
    } else {
      // Service call
      const score = call.overall_score ?? 0;
      emailBody += `
        <div style="text-align: center; margin-bottom: 24px; padding: 24px; background: linear-gradient(135deg, #1e283a, #020817); border-radius: 8px; color: white;">
          <div style="font-size: 32px; margin-bottom: 8px;">${getStarsForScore(score, 10)}</div>
          <div style="font-size: 36px; font-weight: 700;">${score}/10</div>
        </div>
      `;
    }

    // Dynamic sections based on call type and available data
    if (callType === 'sales') {
      emailBody += renderSkillScores(call.skill_scores as Record<string, number>);
      emailBody += renderTalkMetrics(
        call.agent_talk_percent,
        call.customer_talk_percent,
        call.dead_air_percent,
        call.agent_talk_seconds,
        call.customer_talk_seconds,
        call.dead_air_seconds,
      );
      emailBody += renderClientProfile(call.client_profile as Record<string, any>);
      emailBody += renderCriticalAssessment(call.critical_gaps, call.summary);
      emailBody += renderSectionScoresSales(call.section_scores as Record<string, any>);
      emailBody += renderExecutionChecklist(call.discovery_wins);
      emailBody += renderNotableQuotes(call.notable_quotes as any[]);
      emailBody += renderActionPlan(call.critical_gaps);
    } else {
      // Service call
      emailBody += renderSectionScoresService(call.section_scores as any[]);
      emailBody += renderExecutionChecklist(call.discovery_wins);
      emailBody += renderNotableQuotes(call.notable_quotes as any[]);
      emailBody += renderCoachingRecommendations(call.coaching_recommendations as string[]);
    }

    // Summary (always at the end if exists)
    emailBody += renderSummary(call.summary);

    // CTA Button - Uses SITE_URL for dynamic domain
    const scorecardUrl = `${SITE_URL}/call-scoring?call=${call.id}`;
    emailBody += EmailComponents.button('🔗 View Full Scorecard in Agency Brain', scorecardUrl);

    // Build full email HTML - score-based subjects for both types
    const salesScore = call.overall_score ?? 0;
    const salesScoreRange = getScoreRange(salesScore);
    const subject = callType === 'sales'
      ? `📞 Call Score: ${salesScore}% (${salesScoreRange.label}) - ${teamMemberName} | ${filename}`
      : `📞 Service Call Score: ${call.overall_score ?? 'N/A'}/10 - ${teamMemberName} | ${filename}`;

    const emailHtml = buildEmailHtml({
      title: callType === 'sales' ? '📞 SALES CALL SCORECARD' : '📞 SERVICE CALL SCORECARD',
      subtitle: agency.name,
      bodyContent: emailBody,
      footerAgencyName: agency.name,
    });

    // 5. Send emails via Resend batch
    console.log('[send-call-score-notification] Sending to', recipients.length, 'recipients:', recipients);
    
    const emailBatch = recipients.map(email => ({
      from: BRAND.fromEmail,
      to: email,
      subject,
      html: emailHtml,
    }));

    const response = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBatch),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[send-call-score-notification] Resend API error:', errorText);
      // Don't fail the whole thing - log and return success
      return new Response(
        JSON.stringify({ success: true, message: 'Email delivery attempted', warning: errorText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    console.log('[send-call-score-notification] Emails sent successfully:', result);

    return new Response(
      JSON.stringify({ success: true, recipients_count: recipients.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-call-score-notification] Error:', error);
    // Never throw - always return success to not block analyze-call
    return new Response(
      JSON.stringify({ success: true, error: error instanceof Error ? error.message : 'Notification failed but analysis complete' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
