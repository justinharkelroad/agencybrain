// Types for the Prompt Builder feature

export interface ScoredSection {
  name: string;
  criteria: string;
}

export interface ChecklistItem {
  label: string;
  criteria: string;
}

// Follow-up template configuration
export interface FollowUpPromptConfig {
  crmNotes?: {
    enabled: boolean;
    instructions: string;
  };
  emailTemplate?: {
    enabled: boolean;
    tone: 'professional' | 'friendly' | 'casual';
    instructions: string;
  };
  textTemplate?: {
    enabled: boolean;
    tone: 'professional' | 'friendly' | 'casual';
    maxLength: number;
    instructions: string;
  };
}

export interface SalesPromptConfig {
  templateName: string;
  summaryInstructions: string;
  scoredSections: ScoredSection[];
  // Removed: highCriteria, mediumCriteria, lowCriteria - using overall_score instead
  discoveryWinsCriteria: string;
  closingAttemptsCriteria: string;
  coachingFocus: string;
  checklistItems: ChecklistItem[];
  followupPrompts?: FollowUpPromptConfig;
}

export interface ServicePromptConfig {
  templateName: string;
  summaryInstructions: string;
  scoredSections: ScoredSection[];
  checklistItems: ChecklistItem[];
  crmSections: string[];
  numSuggestions: string;
  suggestionsFocus: string;
  followupPrompts?: FollowUpPromptConfig;
}

export const DEFAULT_SALES_CONFIG: SalesPromptConfig = {
  templateName: '',
  summaryInstructions: 'Summarize why the prospect called and whether they showed buying intent',
  scoredSections: [
    { name: 'Opening & Rapport', criteria: 'Did the rep introduce themselves warmly, ask about the prospect\'s day, and establish personal connection within the first 60 seconds?' },
    { name: 'Discovery', criteria: 'Did the rep uncover the prospect\'s current situation, pain points, and motivations for shopping?' },
    { name: 'Coverage Education', criteria: 'Did the rep educate the prospect on coverage options and differentiate from competitors?' },
    { name: 'Closing', criteria: 'Did the rep ask for the sale with assumptive close language and make at least two closing attempts?' },
  ],
  // Removed rank criteria - using overall_score (0-100) instead
  discoveryWinsCriteria: 'Uncovering pain points with current carrier, learning about life changes (new home, new baby, teen driver), identifying cross-sell opportunities, getting budget information',
  closingAttemptsCriteria: 'Asking for the sale directly, offering to bind coverage today, suggesting a start date, overcoming objections, assumptive closes',
  coachingFocus: 'Focus on closing techniques, objection handling, building urgency, asking for referrals',
  checklistItems: [
    { label: 'HWF Framework Used', criteria: 'Rep asked about Home, Work, or Family to build rapport' },
    { label: 'Ask for Sale', criteria: 'Rep directly asked the prospect to move forward, bind coverage, or commit to a start date' },
    { label: 'Set Follow Up', criteria: 'Rep scheduled a specific follow-up call or next step before ending' },
  ],
};

export const DEFAULT_SERVICE_CONFIG: ServicePromptConfig = {
  templateName: '',
  summaryInstructions: 'Explain why the customer called and what resolution was provided or promised',
  scoredSections: [
    { name: 'Opening & Rapport', criteria: 'Did the CSR greet warmly, introduce themselves, and set a positive tone?' },
    { name: 'Active Listening', criteria: 'Did the CSR listen attentively, acknowledge the customer\'s concerns, and avoid interrupting?' },
    { name: 'Problem Resolution', criteria: 'Did the CSR effectively address the customer\'s issue and provide a clear solution?' },
    { name: 'Knowledge & Accuracy', criteria: 'Did the CSR demonstrate product/policy knowledge and provide accurate information?' },
    { name: 'Closing', criteria: 'Did the CSR summarize actions taken, confirm next steps, and offer additional assistance?' },
  ],
  checklistItems: [
    { label: 'Offered a policy review', criteria: 'CSR explicitly offered to review the client\'s current coverage or mentioned checking for discounts' },
    { label: 'Asked about life changes', criteria: 'CSR asked if any life changes have occurred (new home, new car, marriage, etc.)' },
    { label: 'Mentioned cross-sell opportunity', criteria: 'CSR mentioned other products or coverage the customer might benefit from' },
  ],
  crmSections: ['Personal Details', 'Coverage Details', 'Resolution / Next Step'],
  numSuggestions: '3',
  suggestionsFocus: 'Focus on efficiency, empathy, and cross-sell opportunities',
};
