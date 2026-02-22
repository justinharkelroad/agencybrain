import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to build dynamic service call prompt from template
function buildServiceUserPrompt(
  transcript: string, 
  skillCategories: any,
  transcriptSegments?: Array<{start: number; end: number; text: string}>
): string {
  // Build timestamped transcript if segments available
  let transcriptWithTimestamps = transcript;
  if (transcriptSegments && transcriptSegments.length > 0) {
    transcriptWithTimestamps = transcriptSegments
      .map(seg => `[${Math.floor(seg.start / 60)}:${String(Math.floor(seg.start % 60)).padStart(2, '0')}] ${seg.text}`)
      .join('\n');
  }
  // Extract template sections or use defaults
  const scoredSections = skillCategories?.scoredSections || [
    { name: "Opening & Rapport", criteria: "Did the CSR greet warmly and identify themselves? Did they confirm the client's identity appropriately? Did they establish a positive tone?" },
    { name: "Listening & Understanding", criteria: "Did they let the client fully explain their issue? Did they ask clarifying questions? Did they summarize the concern to confirm understanding?" },
    { name: "Problem Resolution", criteria: "Did they provide clear, accurate information? Did they take ownership of the issue? Did they follow through on commitments?" },
    { name: "Proactive Service", criteria: "Did they offer a policy review? Did they identify any coverage gaps or cross-sell opportunities? Did they ask for referrals?" },
    { name: "Closing & Follow-Up", criteria: "Did they confirm the resolution? Did they set clear expectations for next steps? Did they thank the client?" }
  ];

  const checklistItems = skillCategories?.checklistItems || [
    { label: "Greeted warmly", criteria: "Did the CSR greet the caller warmly and professionally?" },
    { label: "Confirmed identity", criteria: "Did they verify the caller's identity?" },
    { label: "Summarized concern", criteria: "Did they summarize the caller's concern to confirm understanding?" },
    { label: "Took ownership", criteria: "Did they take ownership of the issue?" },
    { label: "Offered policy review", criteria: "Did they offer a policy review?" },
    { label: "Asked for referral", criteria: "Did they ask for referrals?" },
    { label: "Set clear next steps", criteria: "Did they set clear expectations for next steps?" },
    { label: "Thanked client", criteria: "Did they thank the client?" }
  ];

  const rawCrmSections = skillCategories?.crmSections;
  const crmSections = Array.isArray(rawCrmSections) && rawCrmSections.length > 0
    ? rawCrmSections.map((section: any) => {
        if (typeof section === 'string') {
          return { name: section, placeholder: 'Details mentioned in the call (if any)' };
        }
        return {
          name: section?.name ?? String(section),
          placeholder: section?.placeholder ?? 'Details mentioned in the call (if any)',
        };
      })
    : [
        { name: "Personal Details", placeholder: "Any personal info mentioned" },
        { name: "Vehicles & Policies", placeholder: "Policy/vehicle details if discussed" },
        { name: "Coverage Details", placeholder: "Coverage info discussed" },
        { name: "Resolution / Next Step", placeholder: "What was resolved or scheduled" },
      ];

  const summaryInstructions = skillCategories?.summaryInstructions || "2-3 sentences: why call occurred, how it was handled, outcome";
  const suggestionsCount = Number(skillCategories?.numSuggestions ?? skillCategories?.suggestionsCount ?? 3);

  // Build scoring framework dynamically with detailed feedback requirements
  const scoringFramework = scoredSections.map((section: any, idx: number) => 
    `**${idx + 1}. ${section.name.toUpperCase()}**\n${section.criteria}`
  ).join('\n\n');

  // Build section_scores JSON example dynamically with STRENGTHS/GAPS/ACTION structure
  const sectionScoresExample = scoredSections.map((section: any) => ({
    section_name: section.name,
    score: 8,
    max_score: 10,
    feedback: "STRENGTHS: [specific example of what CSR did well, with quote if available]. GAPS: [specific behavior or statement that was missed or incomplete]. ACTION: [one concrete thing to practice on the next call].",
    tip: "<one memorable coaching takeaway for quick reference>"
  }));

  // Build checklist JSON example dynamically
  const checklistExample = checklistItems.map((item: any) => ({
    label: item.label,
    checked: true,
    evidence: "<quote from call or null if not observed>"
  }));

  // Build CRM notes template dynamically
  const crmNotesTemplate = crmSections.map((section: any) => 
    `**${section.name}**\\n- [${section.placeholder}]`
  ).join('\\n\\n');

  // Build suggestions array example
  const suggestionsExample = Array.from({ length: suggestionsCount }, (_, i) => 
    `<specific improvement suggestion ${i + 1}>`
  );

  return `Analyze this insurance service/customer support call transcript and provide a structured evaluation.

## SCORING FRAMEWORK

${scoringFramework}

## SECTION FEEDBACK REQUIREMENTS
For EACH scored section, provide detailed coaching feedback with this structure:

1. STRENGTHS: What the CSR did well in this area. Include specific quotes or moments from the transcript when possible. (1-2 sentences minimum)

2. GAPS: What was missed, incomplete, or could be improved. Be specific about behaviors or statements that should have happened but didn't. (1-2 sentences minimum)

3. ACTION: One concrete, specific behavior to practice on the very next call. Make it actionable, not generic advice. (1 sentence)

IMPORTANT: Avoid generic feedback like "improve communication skills" or "be more thorough." Every piece of feedback must reference something specific from THIS call.

## CHECKLIST CRITERIA

${checklistItems.map((item: any) => `- **${item.label}**: ${item.criteria || 'Did this occur during the call?'}`).join('\n')}

## NOTABLE QUOTES EXTRACTION
Identify 3-5 significant moments from the call. For each quote:
- Copy the exact words spoken (verbatim, 10-30 words)
- Identify if it was the agent or customer speaking
- Use the timestamp from the transcript (convert [M:SS] to total seconds, e.g., [2:35] = 155)
- Explain why this moment matters for coaching

Focus on quotes that demonstrate:
- Strong or weak rapport building
- Empathetic responses or missed empathy opportunities
- Problem resolution skills
- Proactive service moments
- Key customer concerns or satisfaction signals

## REQUIRED JSON RESPONSE FORMAT

{
  "csr_name": "<first name only>",
  "client_first_name": "<first name only>",
  "section_scores": ${JSON.stringify(sectionScoresExample, null, 4)},
  "overall_score": 7.4,
  "summary": "<${summaryInstructions}>",
  "crm_notes": "${crmNotesTemplate}",
  "suggestions": ${JSON.stringify(suggestionsExample)},
  "checklist": ${JSON.stringify(checklistExample, null, 4)},
  "notable_quotes": [
    {
      "text": "Exact quote from the call - copy verbatim",
      "speaker": "agent",
      "timestamp_seconds": 125,
      "context": "Brief explanation of why this quote is significant"
    }
  ]
}

IMPORTANT RULES:
- Score each section 0-10
- Overall score is the average of all section scores (one decimal place)
- CRITICAL: Each section's feedback MUST follow the "STRENGTHS: ... GAPS: ... ACTION: ..." format exactly
- Be specific with feedback - cite quotes from the transcript when possible
- Avoid generic coaching like "improve communication" - reference specific moments from THIS call
- CRM notes should be formatted with markdown headers
- Checklist evidence should quote the transcript when checked=true
- First names only - no last names or PII
- Extract 3-5 notable quotes with timestamps

## TRANSCRIPT (with timestamps)
${transcriptWithTimestamps}`;
}

// Helper function to build dynamic sales call prompt from template
function buildSalesUserPrompt(
  transcript: string, 
  skillCategories: any,
  transcriptSegments?: Array<{start: number; end: number; text: string}>
): string {
  // Build timestamped transcript if segments available
  let transcriptWithTimestamps = transcript;
  if (transcriptSegments && transcriptSegments.length > 0) {
    transcriptWithTimestamps = transcriptSegments
      .map(seg => `[${Math.floor(seg.start / 60)}:${String(Math.floor(seg.start % 60)).padStart(2, '0')}] ${seg.text}`)
      .join('\n');
  }
  // Extract template sections or use defaults
  const scoredSections = skillCategories?.scoredSections || [
    { 
      name: "Rapport", 
      criteria: "HWF Framework (Home, Work, Family) - Build trust through genuine connection BEFORE discussing insurance. Look for: 'How long have you been here?', 'Are you working or retired?', 'Do you have any kids?' Note: Asking about roof year is NOT rapport." 
    },
    { 
      name: "Coverage", 
      criteria: "Differentiate through education, not order-taking. Did they educate on coverage and liability? Did they position as advisor vs price-quoting agent? Look for phrases like 'coverage assessment'." 
    },
    { 
      name: "Closing", 
      criteria: "Use Assumptive Close Language. Minimum two close attempts. Final ask for the sale. If follow-up set: must include exact date/time. Bonus: Ask for referrals." 
    },
    { 
      name: "Objection Handling", 
      criteria: "Use the Objection Loop: Acknowledge the concern, Address/Reframe with value, Check if resolved ('does that solve it?'), Ask again after handling." 
    },
    { 
      name: "Discovery", 
      criteria: "Did they uncover needs, budget, timeline, decision-makers? Did they ask about other policies or assets?" 
    }
  ];

  const checklistItems = skillCategories?.checklistItems || [
    { label: "HWF Framework", criteria: "Did they use Home/Work/Family rapport building?" },
    { label: "Ask About Work", criteria: "Did they ask about the caller's occupation?" },
    { label: "Explain Coverage", criteria: "Did they explain coverage options?" },
    { label: "Deductible Value", criteria: "Did they explain deductible value?" },
    { label: "Advisor Frame", criteria: "Did they position as an advisor?" },
    { label: "Assumptive Close", criteria: "Did they use assumptive close language?" },
    { label: "Ask for Sale", criteria: "Did they directly ask for the sale?" },
    { label: "Set Follow Up", criteria: "Did they set a specific follow-up date/time?" }
  ];

  // Build scoring framework dynamically with detailed feedback requirements
  const scoringFramework = scoredSections.map((section: any, idx: number) => 
    `**${idx + 1}. ${section.name.toUpperCase()}**\n${section.criteria}`
  ).join('\n\n');

  // Generate section_scores object structure with STRENGTHS/GAPS/ACTION format
  const sectionScoresStructure = scoredSections.map((section: any) => {
    const key = section.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    return `    "${key}": {
      "score": <0-100>,
      "feedback": "STRENGTHS: [specific example of what rep did well, with quote if available]. GAPS: [specific behavior or statement that was missed or incomplete]. ACTION: [one concrete thing to practice on the next call].",
      "tip": "<one memorable coaching takeaway for quick reference>"
    }`;
  }).join(',\n');

  // Build checklist criteria explanation
  const checklistCriteriaExplanation = checklistItems.map((item: any) => 
    `- **${item.label}**: ${item.criteria || 'Did this occur during the call?'}`
  ).join('\n');

  // Generate execution_checklist JSON structure
  const checklistJsonStructure = checklistItems.map((item: any) => {
    const key = item.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    return `    "${key}": <true/false>`;
  }).join(',\n');

  // Generate skill_scores keys (for backward compatibility)
  const skillScoresKeys = scoredSections.map((section: any) => {
    const key = section.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    return `    "${key}": <0-100>`;
  }).join(',\n');

  return `Analyze this insurance sales call transcript and provide a structured evaluation.

## SCORING FRAMEWORK

${scoringFramework}

## SECTION FEEDBACK REQUIREMENTS
For EACH scored section, provide detailed coaching feedback with this structure:

1. STRENGTHS: What the rep did well in this area. Include specific quotes or moments from the transcript when possible. (1-2 sentences minimum)

2. GAPS: What was missed, incomplete, or could be improved. Be specific about behaviors or statements that should have happened but didn't. (1-2 sentences minimum)

3. ACTION: One concrete, specific behavior to practice on the very next call. Make it actionable, not generic advice. (1 sentence)

IMPORTANT: Avoid generic feedback like "improve closing skills" or "be more assertive." Every piece of feedback must reference something specific from THIS call.

## EXECUTION CHECKLIST CRITERIA

${checklistCriteriaExplanation}

## NOTABLE QUOTES EXTRACTION
Identify 3-5 significant moments from the call. For each quote:
- Copy the exact words spoken (verbatim, 10-30 words)
- Identify if it was the agent or customer speaking
- Use the timestamp from the transcript (convert [M:SS] to total seconds, e.g., [2:35] = 155)
- Explain why this moment matters for coaching

Focus on quotes that demonstrate:
- Strong or weak rapport building
- Good or missed discovery questions
- Objection handling (successful or failed)
- Closing attempts
- Key customer concerns or buying signals

## REQUIRED JSON RESPONSE FORMAT

{
  "salesperson_name": "<first name of the agent from transcript, or 'Agent' if unclear>",
  
  "critical_assessment": "<3-4 detailed sentences about the main issues or successes, citing specific moments from the call>",
  
  "skill_scores": {
${skillScoresKeys}
  },
  
  "section_scores": {
${sectionScoresStructure}
  },
  
  "execution_checklist": {
${checklistJsonStructure}
  },
  
  "corrective_action_plan": {
    "primary_focus": "<2-3 sentences with specific phrases and techniques to implement>",
    "secondary_focus": "<2-3 sentences on additional improvements>",
    "closing_focus": "<2-3 sentences on specific closing techniques and language to use>"
  },
  
  "crm_notes": {
    "personal_rapport": "<family, work, hobbies mentioned>",
    "motivation_to_switch": "<reasons stated>",
    "coverage_gaps_discussed": "<limits, deductibles, concerns>",
    "premium_insights": "<current carrier, budget, price expectations>",
    "decision_process": "<who decides, timing, stakeholders>",
    "quote_summary": "<what was quoted>",
    "follow_up_details": "<date/time/purpose if set, otherwise 'None scheduled'>"
  },
  
  "extracted_data": {
    "client_first_name": "<first name only>",
    "current_carrier": "<carrier name>",
    "your_quote": "<premium quoted - format as $X/month or $X/year>",
    "competitor_quote": "<their current premium - format as $X/month or $X/year>",
    "assets": ["<vehicle 1>", "<vehicle 2>", "<home if applicable>"],
    "timeline": "<decision timeline if mentioned>"
  },
  
  "call_outcome": "<sold | not_sold | follow_up_scheduled | undecided>",
  "summary": "<2-3 sentences: why call occurred, outcome, next step>",
  
  "notable_quotes": [
    {
      "text": "Exact quote from the call - copy verbatim",
      "speaker": "agent",
      "timestamp_seconds": 125,
      "context": "Brief explanation of why this quote is significant"
    }
  ]
}

IMPORTANT RULES:
- CRITICAL: Each section's feedback MUST follow the "STRENGTHS: ... GAPS: ... ACTION: ..." format exactly
- Avoid generic coaching like "improve closing skills" - reference specific moments from THIS call
- Critical assessment must be 3-4 sentences minimum
- Be specific - cite quotes from the transcript when possible
- Format prices consistently as $X/month or $X/year
- Extract 3-5 notable quotes with timestamps

## TRANSCRIPT (with timestamps)
${transcriptWithTimestamps}`;
}

// Helper function to normalize skill_scores from array to object format
function normalizeSkillScores(skillScores: any): Record<string, number> {
  if (!skillScores) return {};
  
  // If already an object with number values, return as-is
  if (!Array.isArray(skillScores)) {
    const normalized: Record<string, number> = {};
    for (const [key, value] of Object.entries(skillScores)) {
      if (typeof value === 'number') {
        normalized[key] = value;
      }
    }
    return normalized;
  }
  
  // Convert array format to object
  // Array format: [{ skill_name: "Rapport", score: 7 }, ...]
  const result: Record<string, number> = {};
  for (const item of skillScores) {
    const name = item?.skill_name || item?.name || item?.section_name;
    const score = item?.score;
    if (name && typeof score === 'number') {
      const key = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      // Scale 0-10 scores to 0-100 for consistency
      result[key] = score <= 10 ? Math.round(score * 10) : score;
    }
  }
  return result;
}

function extractSectionClaims(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry: any) => {
      if (typeof entry === 'string') return entry.trim();
      if (entry && typeof entry === 'object') {
        if (typeof entry.claim === 'string') return entry.claim.trim();
        if (typeof entry.text === 'string') return entry.text.trim();
      }
      return '';
    })
    .filter((entry: string) => entry.length > 0);
}

function buildSectionFeedback(sectionData: any): string | null {
  if (!sectionData || typeof sectionData !== 'object') return null;

  const directFeedback = typeof sectionData.feedback === 'string' ? sectionData.feedback.trim() : '';
  if (directFeedback) return directFeedback;

  const strengths =
    (typeof sectionData.strengths === 'string' && sectionData.strengths.trim()) ||
    extractSectionClaims(sectionData.wins).join(' ') ||
    '';
  const gaps =
    (typeof sectionData.gaps === 'string' && sectionData.gaps.trim()) ||
    extractSectionClaims(sectionData.failures).join(' ') ||
    '';
  const action =
    (typeof sectionData.action === 'string' && sectionData.action.trim()) ||
    (typeof sectionData.coaching === 'string' && sectionData.coaching.trim()) ||
    (typeof sectionData.tip === 'string' && sectionData.tip.trim()) ||
    '';

  if (!strengths && !gaps && !action) return null;

  return `STRENGTHS: ${strengths || 'Not clearly demonstrated in this call.'} GAPS: ${gaps || 'No clear gaps were captured in the section output.'} ACTION: ${action || 'Practice one specific behavior tied to this section on the next call.'}`;
}

function textValue(value: any): string {
  return typeof value === 'string' ? value.trim() : '';
}

function inferPlanDomain(text: string): 'rapport' | 'value_building' | 'closing' | 'unknown' {
  const normalized = text.toLowerCase();
  if (!normalized) return 'unknown';

  const rapportSignals = [
    'rapport', 'open-ended', 'open ended', 'home', 'work', 'family', 'trust',
    'connection', 'greet', 'greeting', 'personal life', 'personal connection'
  ];
  const valueSignals = [
    'coverage', 'value', 'liability', 'deductible', 'protect', 'protection',
    'premium', 'quote', 'asset', 'differentiate', 'discovery', 'advisor'
  ];
  const closingSignals = [
    'close', 'closing', 'ask for the sale', 'ask for sale', 'yes/no',
    'assumptive', 'follow-up', 'follow up', 'commitment', 'next step'
  ];

  if (closingSignals.some((signal) => normalized.includes(signal))) return 'closing';
  if (rapportSignals.some((signal) => normalized.includes(signal))) return 'rapport';
  if (valueSignals.some((signal) => normalized.includes(signal))) return 'value_building';
  return 'unknown';
}

function extractSectionAction(sectionData: any): string {
  if (!sectionData || typeof sectionData !== 'object') return '';

  const explicitAction = textValue(sectionData.action) || textValue(sectionData.coaching) || textValue(sectionData.tip);
  if (explicitAction) return explicitAction;

  const feedback = textValue(sectionData.feedback) || buildSectionFeedback(sectionData) || '';
  if (!feedback) return '';

  const actionMatch = feedback.match(/ACTION:\s*([\s\S]*)$/i);
  return actionMatch && actionMatch[1] ? actionMatch[1].trim() : '';
}

function normalizeSalesCorrectivePlan(
  analysis: any,
  normalizedSectionScores: Record<string, any>
): Record<string, string> {
  const rawPlan = (analysis && typeof analysis.corrective_action_plan === 'object' && !Array.isArray(analysis.corrective_action_plan))
    ? analysis.corrective_action_plan
    : {};
  const coaching = Array.isArray(analysis?.coaching_recommendations)
    ? analysis.coaching_recommendations.filter((item: any) => typeof item === 'string' && item.trim())
    : [];

  const sectionRapportAction = extractSectionAction(normalizedSectionScores.rapport);
  const sectionValueAction = extractSectionAction(normalizedSectionScores.coverage || normalizedSectionScores.discovery);
  const sectionClosingAction = extractSectionAction(normalizedSectionScores.closing);

  const routed: Record<'rapport' | 'value_building' | 'closing', string> = {
    rapport: '',
    value_building: '',
    closing: '',
  };

  const assign = (domain: 'rapport' | 'value_building' | 'closing', value: any) => {
    const text = textValue(value);
    if (!text || routed[domain]) return;
    routed[domain] = text;
  };

  assign('rapport', rawPlan.rapport);
  assign('value_building', rawPlan.value_building);
  assign('closing', rawPlan.closing);

  assign('rapport', rawPlan.rapport_focus);
  assign('value_building', rawPlan.value_focus);
  assign('closing', rawPlan.closing_focus);

  const genericCandidates = [
    rawPlan.primary_focus,
    rawPlan.secondary_focus,
    rawPlan.closing_focus,
    ...coaching,
  ];
  for (const candidate of genericCandidates) {
    const text = textValue(candidate);
    if (!text) continue;
    const inferred = inferPlanDomain(text);
    if (inferred !== 'unknown') assign(inferred, text);
  }

  assign('rapport', sectionRapportAction);
  assign('value_building', sectionValueAction);
  assign('closing', sectionClosingAction);

  assign('rapport', "Focus on building rapport.");
  assign('value_building', "Improve coverage education.");
  assign('closing', "Use assumptive close language.");

  return {
    primary_focus: routed.rapport,
    secondary_focus: routed.value_building,
    closing_focus: routed.closing,
    rapport: routed.rapport,
    value_building: routed.value_building,
    closing: routed.closing,
  };
}

function normalizeServiceSectionScores(sectionScores: any): any[] {
  const normalizeEntry = (entry: Record<string, unknown>, fallbackName: string) => {
    const scoreRaw = entry.score;
    const maxScoreRaw = entry.max_score;
    const score = typeof scoreRaw === 'number' ? scoreRaw : (typeof scoreRaw === 'string' ? Number(scoreRaw) : 0);
    const maxScore = typeof maxScoreRaw === 'number' ? maxScoreRaw : (typeof maxScoreRaw === 'string' ? Number(maxScoreRaw) : 10);

    return {
      section_name: (entry.section_name as string) || fallbackName,
      score: Number.isFinite(score) ? score : 0,
      max_score: Number.isFinite(maxScore) && maxScore > 0 ? maxScore : 10,
      feedback: typeof entry.feedback === 'string' ? entry.feedback : buildSectionFeedback(entry) || '',
      tip: typeof entry.tip === 'string' ? entry.tip : (typeof entry.coaching === 'string' ? entry.coaching : null),
    };
  };

  if (Array.isArray(sectionScores)) {
    return sectionScores.map((value, index) => {
      const entry = value && typeof value === 'object' ? { ...(value as Record<string, unknown>) } : {};
      const fallbackName = `Section ${index + 1}`;
      return normalizeEntry(entry, fallbackName);
    });
  }
  if (!sectionScores || typeof sectionScores !== 'object') return [];

  return Object.entries(sectionScores).map(([key, value]) => {
    const entry = value && typeof value === 'object' ? { ...(value as Record<string, unknown>) } : {};
    const fallbackName = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return normalizeEntry(entry, fallbackName);
  });
}

function toServiceText(value: any): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  return Object.values(value)
    .filter((entry) => typeof entry === 'string')
    .join(' ');
}

function detectFollowUpValidation(text: string) {
  const normalized = text.toLowerCase();
  const hasFollowUp = /\b(follow[- ]?up|call\s?back|callback|reach out|next step|appointment|renewal)\b/i.test(normalized);
  const hasDate =
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)\b/i.test(normalized) ||
    /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/i.test(normalized) ||
    /\b\d{4}-\d{2}-\d{2}\b/i.test(normalized) ||
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+\d{1,2}(?:st|nd|rd|th)?\b/i.test(normalized);
  const hasTime = /\b(\d{1,2}:\d{2}\s?(am|pm)?|\d{1,2}\s?(am|pm))\b/i.test(normalized);
  const hasOwner = /\b(i|we|agent|csr|team member|rep)\s+(will|to)\b/i.test(normalized) || /\bassigned\b/i.test(normalized);
  const hasChannel = /\b(phone|text|sms|email|voicemail|callback|call[- ]?back)\b/i.test(normalized);

  const missingFields: string[] = [];
  if (hasFollowUp) {
    if (!hasDate) missingFields.push('date');
    if (!hasTime) missingFields.push('time');
    if (!hasOwner) missingFields.push('owner');
    if (!hasChannel) missingFields.push('channel');
  }

  const status = !hasFollowUp
    ? 'missing'
    : missingFields.length === 0
      ? 'specific'
      : 'partial';

  return {
    status,
    has_follow_up: hasFollowUp,
    has_date: hasDate,
    has_time: hasTime,
    has_owner: hasOwner,
    has_channel: hasChannel,
    missing_fields: missingFields,
  };
}

function detectServiceOutcome(combinedText: string, followUpStatus: string) {
  const text = combinedText.toLowerCase();
  const resolvedSignals = ['resolved', 'fixed', 'completed', 'handled', 'taken care of', 'issue addressed', 'successfully'];
  const unresolvedSignals = ['not resolved', 'unable', "couldn't", 'cannot', 'pending', 'still waiting', 'escalate', 'needs review', 'not handled'];

  const hasResolved = resolvedSignals.some((signal) => text.includes(signal));
  const hasUnresolved = unresolvedSignals.some((signal) => text.includes(signal));

  let status: 'resolved' | 'partial' | 'unresolved' | 'follow_up_required' = 'partial';
  if (hasResolved && !hasUnresolved) {
    status = 'resolved';
  } else if (followUpStatus === 'specific' || followUpStatus === 'partial') {
    status = 'follow_up_required';
  } else if (hasUnresolved) {
    status = 'unresolved';
  }

  const rationaleMap: Record<typeof status, string> = {
    resolved: 'Issue appears resolved during the call with no clear remaining blockers.',
    partial: 'Call handled key parts of the issue, but resolution completeness is unclear.',
    unresolved: 'Issue appears unresolved by call end and no clear follow-up plan is documented.',
    follow_up_required: 'Issue requires follow-up action and needs a specific owner/date/time plan.',
  };

  return {
    status,
    rationale: rationaleMap[status],
  };
}

function buildServiceInsights(analysis: any, sectionScoresArray: any[]) {
  const crmText = toServiceText(analysis?.crm_notes);
  const summaryText = typeof analysis?.summary === 'string' ? analysis.summary : '';
  const sectionText = sectionScoresArray
    .map((section) => `${section?.section_name || ''} ${section?.feedback || ''} ${section?.tip || ''}`)
    .join(' ');
  const combined = `${summaryText} ${crmText} ${sectionText}`.trim();

  const followUpValidation = detectFollowUpValidation(`${summaryText} ${crmText}`);
  const serviceOutcome = detectServiceOutcome(combined, followUpValidation.status);

  return {
    service_outcome: serviceOutcome,
    follow_up_validation: followUpValidation,
  };
}

serve(async (req) => {
  console.log('analyze-call invoked');
  console.log('Request method:', req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { call_id } = await req.json();
    console.log('Call ID received:', call_id);
    if (!call_id) {
      return new Response(
        JSON.stringify({ error: "Missing call_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the call record with template
    const { data: call, error: callError } = await supabase
      .from("agency_calls")
      .select(`
        *,
        call_scoring_templates (
          name,
          system_prompt,
          skill_categories,
          call_type
        )
      `)
      .eq("id", call_id)
      .single();

    if (callError || !call) {
      return new Response(
        JSON.stringify({ error: "Call not found", details: callError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!call.transcript) {
      return new Response(
        JSON.stringify({ error: "Call has no transcript" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine call type from template
    const callType = call.call_scoring_templates?.call_type || 'sales';
    console.log(`Analyzing ${callType} call...`);

    // Extract skill categories from template
    const skillCategories = call.call_scoring_templates?.skill_categories as any;
    console.log('Using skill_categories from template:', JSON.stringify(skillCategories).substring(0, 500));

    // Use template prompt if available, otherwise fall back to hardcoded defaults
    const templatePrompt = call.call_scoring_templates?.system_prompt;
    
    const defaultServicePrompt = `You are an advanced service-call evaluator analyzing a transcribed insurance service/customer support call. Your mission is to:
- Evaluate CSR performance across key service dimensions
- Extract CRM-worthy data points for follow-up
- Surface coaching insights tied to best practices
- Maintain an evidence-backed, professional tone

All analysis must be:
- Specific — No vagueness or conjecture.
- Grounded — Each conclusion must cite transcript-based observations.
- No PII — Never include last names, DOBs, specific addresses, bank/card info, SSNs.

Voice profile:
- Tone: supportive, constructive, clear.
- Sentences: short, active, present tense.
- POV: second person ("you"). Address the CSR directly.

You must respond with ONLY valid JSON - no markdown, no explanation.`;

    const defaultSalesPrompt = `You are an advanced sales-performance evaluator analyzing a transcribed insurance sales call. Your mission is to:
- Extract CRM-worthy data points that directly reflect the talk path.
- Surface precision-targeted coaching insights tied to the agency's script.
- Maintain an evidence-backed, judgment-free tone.

All analysis must be:
- Specific — No vagueness or conjecture.
- Grounded — Each conclusion must cite transcript-based observations.
- Challenged — Actively attempt to disprove assumptions via cross-validation.
- Triple-Checked — Verify every item through at least two distinct signals.
- No PII — Never include last names, DOBs, specific addresses, bank/card info, SSNs.

Voice profile:
- Tone: blunt, clean, directive, zero hype.
- Sentences: short, active, present tense. 6–14 words.
- POV: second person ("you"). Address the salesperson directly.
- Use imperatives for fixes.

You must respond with ONLY valid JSON - no markdown, no explanation.`;

    const systemPrompt = templatePrompt && templatePrompt.trim().length > 0
      ? templatePrompt
      : (callType === 'service' ? defaultServicePrompt : defaultSalesPrompt);

    // Schema override to ensure required fields are always included regardless of template
    const schemaOverride = callType === 'sales' ? `

ADDITIONAL REQUIRED OUTPUT FIELDS (MUST be included in your JSON response):

1. "notable_quotes": Array of 3-5 significant call moments with verbatim quotes:
   [
     {
       "text": "<exact verbatim quote, 10-30 words>",
       "speaker": "agent" | "customer",
       "timestamp_seconds": <integer - convert [M:SS] to total seconds, e.g., [2:35] = 155>,
       "context": "<why this quote matters for coaching>"
     }
   ]

2. "execution_checklist": MUST be an ARRAY (not object) for each checklist item:
   [
     {
       "label": "<checklist item name>",
       "checked": true | false,
       "evidence": "<verbatim quote proving this was done, or null if not observed>"
     }
   ]

3. "crm_notes": MUST be an object with these exact keys:
   {
     "personal_rapport": "<family, work, hobbies mentioned or 'None discussed'>",
     "motivation_to_switch": "<reasons stated or 'Not mentioned'>",
     "coverage_gaps_discussed": "<limits, deductibles, concerns or 'None identified'>",
     "premium_insights": "<current carrier, budget, price expectations or 'Not discussed'>",
     "decision_process": "<who decides, timing, stakeholders or 'Unknown'>",
     "quote_summary": "<what was quoted or 'No quote provided'>",
     "follow_up_details": "<date/time/purpose if set, otherwise 'None scheduled'>"
   }

4. For each section in "section_scores", use this exact structure:
   {
     "rapport": {
       "score": 65,
       "feedback": "STRENGTHS: <specific win with evidence>. GAPS: <specific miss with evidence>. ACTION: <one concrete next-call behavior>.",
       "tip": "<one memorable coaching takeaway>"
     }
   }

TIMESTAMP RULE: Use transcript timestamps [M:SS] - convert to total seconds (e.g., [2:35] = 155).
` : `

ADDITIONAL REQUIRED OUTPUT FIELDS (MUST be included in your JSON response):

1. "notable_quotes": Array of 3-5 significant call moments with verbatim quotes.
`;

    // Enforce JSON-only output with schema override
    const enforcedSystemPrompt = `${systemPrompt}${schemaOverride}\n\nCRITICAL OUTPUT FORMAT: Respond with ONLY valid JSON. Do NOT use markdown. Do NOT use HTML. Do NOT add commentary.`;

    console.log('Using prompt source:', templatePrompt && templatePrompt.trim().length > 0 ? 'TEMPLATE' : 'HARDCODED DEFAULT');
    console.log('Has custom scored sections:', skillCategories?.scoredSections?.length > 0 ? 'YES' : 'NO');
    console.log('Has custom checklist items:', skillCategories?.checklistItems?.length > 0 ? 'YES' : 'NO');

    // Build dynamic user prompt based on call type and template skill_categories
    // Pass transcript_segments for timestamped quotes extraction
    const transcriptSegments = call.transcript_segments as Array<{start: number; end: number; text: string}> | undefined;
    const userPrompt = callType === 'service' 
      ? buildServiceUserPrompt(call.transcript, skillCategories, transcriptSegments)
      : buildSalesUserPrompt(call.transcript, skillCategories, transcriptSegments);

    console.log("Generated user prompt length:", userPrompt.length);
    console.log("User prompt preview:", userPrompt.substring(0, 1000));

    console.log("Sending transcript to GPT-4o for analysis...");

    // Call OpenAI API
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: enforcedSystemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI API error:", errorText);
      return new Response(
        JSON.stringify({ error: "AI analysis failed", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiResult = await openaiResponse.json();
    const analysisText = openaiResult.choices?.[0]?.message?.content;

    // Extract token usage and calculate costs
    const usage = openaiResult.usage;
    const inputTokens = usage?.prompt_tokens || 0;
    const outputTokens = usage?.completion_tokens || 0;
    
    // GPT-4o pricing: $2.50/1M input, $10/1M output
    const inputCost = (inputTokens / 1000000) * 2.50;
    const outputCost = (outputTokens / 1000000) * 10.00;
    const gptCost = inputCost + outputCost;
    
    console.log(`GPT-4o usage - Input: ${inputTokens} tokens, Output: ${outputTokens} tokens`);
    console.log(`GPT-4o cost: $${gptCost.toFixed(4)} (input: $${inputCost.toFixed(4)}, output: $${outputCost.toFixed(4)})`);

    if (!analysisText) {
      return new Response(
        JSON.stringify({ error: "No analysis returned from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Raw AI response:", analysisText.substring(0, 500));

    // Parse the JSON response
    let analysis;
    try {
      // Clean up potential markdown formatting
      let cleanJson = analysisText.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.slice(7);
      }
      if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.slice(3);
      }
      if (cleanJson.endsWith("```")) {
        cleanJson = cleanJson.slice(0, -3);
      }
      analysis = JSON.parse(cleanJson.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI analysis", raw: analysisText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log key fields for debugging (AFTER analysis is parsed)
    console.log("[analyze-call] notable_quotes:", JSON.stringify(analysis?.notable_quotes)?.substring(0, 300) || 'undefined');
    console.log("[analyze-call] execution_checklist type:", Array.isArray(analysis?.execution_checklist) ? 'array' : typeof analysis?.execution_checklist);
    console.log("[analyze-call] crm_notes type:", typeof analysis?.crm_notes);

    // Calculate overall score based on call type
    let overallScore: number;
    if (callType === 'service') {
      // Service calls: average of section_scores array (keep 0-10 scale with 1 decimal)
      const sectionScores = normalizeServiceSectionScores(analysis.section_scores);
      const totalScore = sectionScores.reduce((sum: number, s: any) => sum + (s.score || 0), 0);
      overallScore = sectionScores.length > 0 
        ? parseFloat((totalScore / sectionScores.length).toFixed(1))
        : 0;
    } else {
      // Sales calls: normalize skill_scores and calculate average
      const normalizedSkillScores = normalizeSkillScores(analysis.skill_scores);
      console.log('Normalized skill_scores:', JSON.stringify(normalizedSkillScores));
      const scores = Object.values(normalizedSkillScores);
      overallScore = scores.length > 0 
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : (typeof analysis.overall_score === 'number' ? analysis.overall_score : 0);
      // Store normalized version for use in update payload
      (analysis as any)._normalizedSkillScores = normalizedSkillScores;
    }

    // Get existing whisper cost to calculate total
    const { data: existingCall } = await supabase
      .from("agency_calls")
      .select("whisper_cost")
      .eq("id", call_id)
      .single();

    const whisperCost = existingCall?.whisper_cost || 0;
    const totalCost = whisperCost + gptCost;
    console.log(`Total call cost: $${totalCost.toFixed(4)} (whisper: $${whisperCost.toFixed(4)}, gpt: $${gptCost.toFixed(4)})`);

    // Build update payload based on call type
    let updatePayload: Record<string, any> = {
      overall_score: overallScore,
      call_type: callType,
      summary: analysis.summary,
      gpt_input_tokens: inputTokens,
      gpt_output_tokens: outputTokens,
      gpt_cost: gptCost,
      total_cost: totalCost,
      status: "analyzed",
      analyzed_at: new Date().toISOString(),
    };

    if (callType === 'service') {
      // Service call specific fields
      // Convert section_scores array to skill_scores array for UI consistency
      const sectionScoresArray = normalizeServiceSectionScores(analysis.section_scores);
      const skillScoresFromSections = sectionScoresArray.map((section: any) => ({
        skill_name: section.section_name || 'Unknown',
        score: section.score || 0,
        max_score: section.max_score || 10,
        feedback: section.feedback || null,
        tip: section.tip || null
      }));
      const serviceInsights = buildServiceInsights(analysis, sectionScoresArray);
      
      const existingCriticalGaps = analysis?.critical_gaps && typeof analysis.critical_gaps === 'object'
        ? analysis.critical_gaps
        : {};

      updatePayload = {
        ...updatePayload,
        skill_scores: skillScoresFromSections, // Add for UI consistency
        section_scores: sectionScoresArray,
        closing_attempts: analysis.crm_notes,
        coaching_recommendations: analysis.suggestions,
        discovery_wins: analysis.checklist,
        notable_quotes: analysis.notable_quotes || [],
        critical_gaps: {
          ...existingCriticalGaps,
          service_outcome: serviceInsights.service_outcome,
          follow_up_validation: serviceInsights.follow_up_validation,
        },
        client_profile: {
          csr_name: analysis.csr_name,
          client_first_name: analysis.client_first_name,
        },
      };
    } else {
      // Sales call specific fields
      // Convert skill_scores to array format for consistent UI display
      let skillScoresForStorage = analysis.skill_scores;
      
      // Helper to normalize keys for section_scores lookup
      const normalizeKey = (str: string): string => {
        return str
          .toLowerCase()
          .replace(/&/g, '')
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '');
      };
      
      // Build normalized section_scores map for lookup
      const sectionScoresMap: Record<string, any> = {};
      const rawSectionScores = analysis.section_scores || {};
      if (typeof rawSectionScores === 'object' && !Array.isArray(rawSectionScores)) {
        for (const [key, value] of Object.entries(rawSectionScores)) {
          const normalizedKey = normalizeKey(key);
          sectionScoresMap[normalizedKey] = value;
          sectionScoresMap[key] = value; // Also keep original
        }
      }
      
      // If skill_scores is an object (not array), convert to array format using section_scores data
      if (skillScoresForStorage && !Array.isArray(skillScoresForStorage)) {
        console.log('[analyze-call] skill_scores returned as object, converting to array format');
        const skillScoresObj = skillScoresForStorage as Record<string, number>;
        skillScoresForStorage = Object.entries(skillScoresObj).map(([key, score]) => {
          const normalizedKey = normalizeKey(key);
          const sectionData = sectionScoresMap[normalizedKey] || sectionScoresMap[key];
          return {
            skill_name: key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
            score: typeof score === 'number' ? (score <= 10 ? score : Math.round(score / 10)) : 0,
            max_score: 10,
            feedback: sectionData?.feedback ?? buildSectionFeedback(sectionData) ?? sectionData?.coaching ?? null,
            tip: sectionData?.tip ?? null
          };
        });
        console.log('[analyze-call] Converted skill_scores to array:', JSON.stringify(skillScoresForStorage));
      } else if (Array.isArray(skillScoresForStorage)) {
        // skill_scores is already an array - enrich it with section_scores data
        console.log('[analyze-call] skill_scores is array, enriching with section_scores data');
        skillScoresForStorage = skillScoresForStorage.map((row: any) => {
          const normalizedKey = normalizeKey(row.skill_name || '');
          const sectionData = sectionScoresMap[normalizedKey];
          return {
            ...row,
            feedback: row.feedback ?? sectionData?.feedback ?? buildSectionFeedback(sectionData) ?? sectionData?.coaching ?? null,
            tip: row.tip ?? sectionData?.tip ?? null
          };
        });
        console.log('[analyze-call] Enriched skill_scores array:', JSON.stringify(skillScoresForStorage));
      }
      
      // Normalize execution_checklist to array format with evidence
      let checklistData = analysis.execution_checklist || analysis.checklist || [];
      if (!Array.isArray(checklistData)) {
        // Convert object format {key: true/false} to array format with evidence
        checklistData = Object.entries(checklistData).map(([key, value]) => ({
          label: key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          checked: Boolean(value),
          evidence: null
        }));
        console.log('[analyze-call] Converted checklist from object to array format');
      }
      
      // Normalize all checklist labels for consistency (remove quotes, title case)
      checklistData = checklistData.map((item: any) => ({
        ...item,
        label: item.label
          ? item.label
              .trim()
              // Remove all quote variants
              .replace(/['"''"""`]/g, '')
              // Title case each word
              .split(' ')
              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(' ')
          : item.label
      }));
      console.log('[analyze-call] Normalized checklist labels for consistency');
      
      // Normalize crm_notes to object format
      let crmNotesData = analysis.crm_notes || analysis.closing_attempts || {};
      if (typeof crmNotesData === 'string') {
        crmNotesData = { raw: crmNotesData };
        console.log('[analyze-call] Wrapped string crm_notes in object');
      } else if (Array.isArray(crmNotesData)) {
        crmNotesData = { raw: crmNotesData.join('\n') };
        console.log('[analyze-call] Converted array crm_notes to object');
      }
      
      console.log('[analyze-call] Final checklist items:', checklistData.length);
      console.log('[analyze-call] Final notable_quotes:', (analysis.notable_quotes || []).length);
      console.log('[analyze-call] CRM notes keys:', Object.keys(crmNotesData));

      const normalizedSectionScores = (() => {
        const raw = analysis.section_scores || {};
        const keyMap: Record<string, string> = {
          'opening__rapport': 'rapport',
          'opening_rapport': 'rapport',
          'coverage_education': 'coverage',
          'coverage__education': 'coverage',
        };
        const normalized: Record<string, any> = {};
        for (const [key, value] of Object.entries(raw)) {
          const normalizedKey = keyMap[key] || key;
          const valueObj = value && typeof value === 'object' ? { ...(value as Record<string, unknown>) } : value;
          if (valueObj && typeof valueObj === 'object') {
            const typed = valueObj as Record<string, unknown>;
            if (typeof typed.score === 'number' && typed.score >= 0 && typed.score <= 10) {
              typed.score = Math.round(typed.score * 10);
            }
            const feedback = buildSectionFeedback(typed);
            if (feedback && (typeof typed.feedback !== 'string' || !typed.feedback.trim())) {
              typed.feedback = feedback;
            }
            if ((!typed.tip || typeof typed.tip !== 'string') && typeof typed.coaching === 'string') {
              typed.tip = typed.coaching;
            }
          }
          normalized[normalizedKey] = valueObj;
        }
        console.log('[analyze-call] Normalized section_scores keys:', Object.keys(normalized));
        return normalized;
      })();
      
      updatePayload = {
        ...updatePayload,
        potential_rank: null, // No longer generating ranks - using overall_score instead
        skill_scores: skillScoresForStorage, // Store as array for UI consistency
        section_scores: normalizedSectionScores, // Normalized for UI
        // Accept both key names - prompt spec OR what AI actually returns
        client_profile: analysis.extracted_data || analysis.client_profile,
        discovery_wins: checklistData, // Store normalized checklist array
        notable_quotes: analysis.notable_quotes || [],
        critical_gaps: {
          assessment: analysis.critical_assessment || analysis.summary,
          rationale: analysis.critical_assessment || 'Performance assessment based on overall call analysis.',
          corrective_plan: normalizeSalesCorrectivePlan(analysis, normalizedSectionScores),
        },
        closing_attempts: crmNotesData, // Store normalized CRM notes object
      };
    }

    // Update the call record with analysis results
    const { error: updateError } = await supabase
      .from("agency_calls")
      .update(updatePayload)
      .eq("id", call_id);

    if (updateError) {
      console.error("Failed to update call record:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to save analysis", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Analysis complete and saved for call:", call_id);

    // Trigger call score notification email (fire and forget - never block the response)
    try {
      const notificationUrl = `${supabaseUrl}/functions/v1/send-call-score-notification`;
      console.log('Triggering call score notification for call:', call_id);
      
      fetch(notificationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ 
          call_id: call_id,
          agency_id: call.agency_id
        }),
      }).then(async (response) => {
        if (response.ok) {
          console.log('Call score notification triggered successfully');
        } else {
          const text = await response.text();
          console.error('Failed to trigger call score notification:', text);
        }
      }).catch(err => {
        console.error('Error triggering call score notification:', err);
      });
    } catch (notificationError) {
      console.error('Notification trigger setup failed:', notificationError);
      // Never block the main response
    }

    return new Response(
      JSON.stringify({
        success: true,
        call_id,
        analysis,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
