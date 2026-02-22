import { SalesPromptConfig, ServicePromptConfig } from './promptBuilderTypes';

export function generateSalesPrompt(config: SalesPromptConfig): string {
  const sectionsText = config.scoredSections
    .map((s, i) => `${i + 1}. **${s.name}** – ${s.criteria}`)
    .join('\n');

  const checklistText = (config.checklistItems || [])
    .map(item => `- ${item.label}: ${item.criteria}`)
    .join('\n');

  const checklistSection = checklistText ? `
EXECUTION CLEAN SHEET (mark Yes/No with evidence quote):
${checklistText}
` : '';

  return `
INSTRUCTIONS TO AI GRADER — SALES CALL EDITION
================================================
You will analyze one sales-call transcript.
Your job is to grade the sales representative and produce a structured report.

PRIVACY RULE: Use first names only. No DOB, SSN, addresses, or policy numbers.

SUMMARY: ${config.summaryInstructions}

SCORED SECTIONS:
${sectionsText}

SECTION FEEDBACK REQUIREMENTS:
For EACH scored section, provide detailed coaching feedback with this structure:

1. STRENGTHS: What the rep did well in this area. Include specific quotes or moments from the transcript when possible. (1-2 sentences minimum)

2. GAPS: What was missed, incomplete, or could be improved. Be specific about behaviors or statements that should have happened but didn't. (1-2 sentences minimum)

3. ACTION: One concrete, specific behavior to practice on the very next call. Make it actionable, not generic advice. (1 sentence)

IMPORTANT: Avoid generic feedback like "improve communication skills" or "be more thorough." Every piece of feedback must reference something specific from THIS call.

DISCOVERY WINS: ${config.discoveryWinsCriteria}

CLOSING ATTEMPTS: ${config.closingAttemptsCriteria}

COACHING FOCUS: ${config.coachingFocus}
${checklistSection}
OUTPUT FORMAT:
Return valid JSON with this exact structure:
{
  "overall_score": <0-100>,
  "summary": "<2-3 sentences>",
  "client_profile": {
    "name": "<first name>",
    "household_size": "<info>",
    "current_coverage": "<info>",
    "pain_points": ["<point1>", "<point2>"],
    "budget_indicators": "<info>"
  },
  "skill_scores": [
    {
      "skill_name": "<section name>",
      "score": <0-10>,
      "max_score": 10,
      "feedback": "STRENGTHS: [specific example of what rep did well, with quote if available]. GAPS: [specific behavior or statement that was missed or incomplete]. ACTION: [one concrete thing to practice on the next call].",
      "tip": "<one memorable coaching takeaway for quick reference>"
    }
  ],
  "section_scores": {
    "<normalized_section_key>": {
      "score": <0-100>,
      "feedback": "STRENGTHS: [specific example of what rep did well, with quote if available]. GAPS: [specific behavior or statement that was missed or incomplete]. ACTION: [one concrete thing to practice on the next call].",
      "tip": "<one memorable coaching takeaway for quick reference>"
    }
  },
  "discovery_wins": ["<win1>", "<win2>"],
  "closing_attempts": ["<attempt1>", "<attempt2>"],
  "coaching_recommendations": ["<rec1>", "<rec2>", "<rec3>"],
  "execution_checklist": [
    {
      "label": "<item label>",
      "checked": true | false,
      "evidence": "<supporting quote or null>"
    }
  ]
}
`.trim();
}

export function generateServicePrompt(config: ServicePromptConfig): string {
  const sectionsText = config.scoredSections
    .map((s, i) => `${i + 1}. **${s.name}** – ${s.criteria}`)
    .join('\n');

  const checklistText = config.checklistItems
    .map(item => `- ${item.label}: ${item.criteria}`)
    .join('\n');

  const crmSectionsText = config.crmSections.join(', ');

  return `
INSTRUCTIONS TO AI GRADER — SERVICE CALL EDITION
================================================
You will analyze one service-call transcript.
Your job is to grade the CSR and produce a structured report.

PRIVACY RULE: Use first names only. No DOB, SSN, addresses, or full policy numbers.

SUMMARY: ${config.summaryInstructions}

SCORED SECTIONS (score each 0-10):
${sectionsText}

SECTION FEEDBACK REQUIREMENTS:
For EACH scored section, provide detailed coaching feedback with this structure:

1. STRENGTHS: What the CSR did well in this area. Include specific quotes or moments from the transcript when possible. (1-2 sentences minimum)

2. GAPS: What was missed, incomplete, or could be improved. Be specific about behaviors or statements that should have happened but didn't. (1-2 sentences minimum)

3. ACTION: One concrete, specific behavior to practice on the very next call. Make it actionable, not generic advice. (1 sentence)

IMPORTANT: Avoid generic feedback like "improve communication skills" or "be more thorough." Every piece of feedback must reference something specific from THIS call.

FINAL CHECKLIST (mark Yes/No with evidence):
${checklistText}

CRM NOTES: Include these sections if mentioned: ${crmSectionsText}

SUGGESTIONS: Provide exactly ${config.numSuggestions} improvement suggestions. ${config.suggestionsFocus}

OUTPUT FORMAT:
Return valid JSON with this exact structure:
{
  "csr_name": "<first name or 'Unknown'>",
  "client_first_name": "<first name or 'Unknown'>",
  "overall_score": <0-10 with one decimal>,
  "summary": "<2-3 sentences>",
  "section_scores": [
    {
      "section_name": "<name>",
      "score": <0-10>,
      "max_score": 10,
      "feedback": "STRENGTHS: [specific example of what CSR did well, with quote if available]. GAPS: [specific behavior or statement that was missed or incomplete]. ACTION: [one concrete thing to practice on the next call].",
      "tip": "<one memorable coaching takeaway for quick reference>"
    }
  ],
  "crm_notes": "<formatted notes with subheadings>",
  "suggestions": ["<suggestion1>", "<suggestion2>", "<suggestion3>"],
  "improvement_goal": "<one measurable goal>",
  "checklist": [
    {
      "label": "<item label>",
      "checked": true | false,
      "evidence": "<quote or null>"
    }
  ]
}
`.trim();
}

// Parse existing prompt back into config (best effort)
export function parseExistingSalesPrompt(prompt: string): Partial<SalesPromptConfig> {
  const config: Partial<SalesPromptConfig> = {};
  
  // Try to extract summary instructions
  const summaryMatch = prompt.match(/SUMMARY:\s*(.+?)(?=\n\n|\nSCORED)/s);
  if (summaryMatch) config.summaryInstructions = summaryMatch[1].trim();
  
  // Try to extract discovery wins
  const discoveryMatch = prompt.match(/DISCOVERY WINS:\s*(.+?)(?=\n\n|\nCLOSING)/s);
  if (discoveryMatch) config.discoveryWinsCriteria = discoveryMatch[1].trim();
  
  // Try to extract closing attempts
  const closingMatch = prompt.match(/CLOSING ATTEMPTS:\s*(.+?)(?=\n\n|\nCOACHING)/s);
  if (closingMatch) config.closingAttemptsCriteria = closingMatch[1].trim();
  
  // Try to extract coaching focus
  const coachingMatch = prompt.match(/COACHING FOCUS:\s*(.+?)(?=\n\n|\nOUTPUT)/s);
  if (coachingMatch) config.coachingFocus = coachingMatch[1].trim();
  
  return config;
}

export function parseExistingServicePrompt(prompt: string): Partial<ServicePromptConfig> {
  const config: Partial<ServicePromptConfig> = {};
  
  // Try to extract summary instructions
  const summaryMatch = prompt.match(/SUMMARY:\s*(.+?)(?=\n\n|\nSCORED)/s);
  if (summaryMatch) config.summaryInstructions = summaryMatch[1].trim();
  
  // Try to extract suggestions focus
  const suggestionsMatch = prompt.match(/SUGGESTIONS:.+?(\d+).+?suggestions\.?\s*(.+?)(?=\n\n|\nOUTPUT)/s);
  if (suggestionsMatch) {
    config.numSuggestions = suggestionsMatch[1];
    config.suggestionsFocus = suggestionsMatch[2].trim();
  }
  
  return config;
}
