// Feature gate configuration for Call Scoring Only tier users
// Maps navigation item IDs to their upsell modal content

export interface FeatureGateConfig {
  featureName: string;
  featureDescription: string;
  videoKey?: string; // Maps to help_videos table video_key column
}

// Map of navigation item IDs (from navigation.ts) to their gate config
export const featureGateConfig: Record<string, FeatureGateConfig> = {
  // Dashboard
  'dashboard': {
    featureName: 'Agency Dashboard',
    featureDescription: 'Track your agency\'s performance metrics, coaching insights, month-over-month trends, and team performance all in one place.',
    videoKey: 'dashboard_overview'
  },
  
  // Sales folder items
  'sales-dashboard': {
    featureName: 'Sales Dashboard',
    featureDescription: 'Comprehensive sales analytics and performance tracking for your agency.',
    videoKey: 'sales_dashboard_overview'
  },
  'ai-sales-bot': {
    featureName: 'AI Sales Bot',
    featureDescription: 'Practice sales conversations with AI-powered roleplay and get instant coaching feedback.',
    videoKey: 'roleplay_bot_overview'
  },
  'lqs-roadmap': {
    featureName: 'LQS Roadmap',
    featureDescription: 'Track your Lead → Quote → Sale journey with comprehensive pipeline analytics.',
    videoKey: 'lqs_roadmap_overview'
  },
  
  // Service folder items
  'cancel-audit': {
    featureName: 'Cancel Audit',
    featureDescription: 'Review and analyze policy cancellations to identify patterns and improve retention.',
    videoKey: 'cancel_audit_overview'
  },
  'renewals': {
    featureName: 'Renewals Dashboard',
    featureDescription: 'Track and manage your policy renewals pipeline to maximize retention.',
    videoKey: 'renewals_overview'
  },
  
  // Accountability folder items
  'scorecards': {
    featureName: 'Scorecards',
    featureDescription: 'Track daily and weekly team performance metrics with customizable scorecards.',
    videoKey: 'scorecards_overview'
  },
  
  // Training folder items
  'standard-playbook': {
    featureName: 'Standard Playbook',
    featureDescription: 'Access our comprehensive training curriculum with video lessons and quizzes.',
    videoKey: 'training_overview'
  },
  'agency-training': {
    featureName: 'Agency Training',
    featureDescription: 'Custom training modules created specifically for your agency team.',
    videoKey: 'agency_training_overview'
  },
  'manage-training': {
    featureName: 'Manage Training',
    featureDescription: 'Create and manage custom training content for your team.',
    videoKey: 'manage_training_overview'
  },
  'video-training-architect': {
    featureName: 'Video Training Architect',
    featureDescription: 'Build custom video training modules with our AI-powered architect.',
    videoKey: 'video_architect_overview'
  },
  
  // Agency Mgmt folder items
  'annual-bonus-tool': {
    featureName: 'Annual Bonus Tool',
    featureDescription: 'Calculate and project your annual bonus based on performance metrics.',
    videoKey: 'bonus_tool_overview'
  },
  'call-efficiency-tool': {
    featureName: 'Call Efficiency Tool',
    featureDescription: 'Analyze call patterns and optimize your team\'s phone efficiency.',
    videoKey: 'call_efficiency_overview'
  },
  'compensation-analyzer': {
    featureName: 'Compensation Analyzer',
    featureDescription: 'Upload and analyze compensation statements to track earnings.',
    videoKey: 'compensation_analyzer_overview'
  },
  'data-lead-forecaster': {
    featureName: 'Data Lead Forecaster',
    featureDescription: 'Project ROI on data lead campaigns with our forecasting tool.',
    videoKey: 'data_forecaster_overview'
  },
  'live-transfer-forecaster': {
    featureName: 'Live Transfer Forecaster',
    featureDescription: 'Calculate expected returns on live transfer lead investments.',
    videoKey: 'transfer_forecaster_overview'
  },
  'mailer-forecaster': {
    featureName: 'Mailer Forecaster',
    featureDescription: 'Project ROI on direct mail campaigns.',
    videoKey: 'mailer_forecaster_overview'
  },
  'roi-on-staff': {
    featureName: 'ROI on Staff',
    featureDescription: 'Calculate the return on investment for each team member.',
    videoKey: 'staff_roi_overview'
  },
  'vendor-verifier': {
    featureName: 'Vendor Verifier',
    featureDescription: 'Verify and compare vendor performance and pricing.',
    videoKey: 'vendor_verifier_overview'
  },
  'producer-quote-dashboard': {
    featureName: 'Quote Details',
    featureDescription: 'Detailed quote tracking and producer performance analytics.',
    videoKey: 'quote_details_overview'
  },
  
  // Personal Growth folder items
  'flows': {
    featureName: 'Flows',
    featureDescription: 'AI-powered guided reflection and journaling sessions for personal growth.',
    videoKey: 'flows_overview'
  },
  'core4': {
    featureName: 'Core 4',
    featureDescription: 'Track daily habits across Body, Being, Balance, and Business.',
    videoKey: 'core4_overview'
  },
  'quarterly-targets': {
    featureName: 'Quarterly Targets',
    featureDescription: 'Set and track 90-day goals with AI-powered mission planning.',
    videoKey: 'life_targets_overview'
  },
  '90-day-audio': {
    featureName: '90-Day Target Audio',
    featureDescription: 'Create personalized affirmation audio tracks with theta brainwave technology.',
    videoKey: 'theta_audio_overview'
  },
  'monthly-missions': {
    featureName: 'Monthly Missions',
    featureDescription: 'AI-generated monthly action plans aligned with your quarterly targets.',
    videoKey: 'monthly_missions_overview'
  },
  
  // The Exchange
  'the-exchange': {
    featureName: 'The Exchange',
    featureDescription: 'Connect with other coaching clients, share insights, and learn from the community.',
    videoKey: 'exchange_overview'
  },
  
  // Staff-specific items
  'submit-form': {
    featureName: 'Submit Form',
    featureDescription: 'Submit your daily performance data and scorecards.',
    videoKey: 'submit_form_overview'
  },
};

// Helper function to get gate config for an item ID
// Returns a default config if the ID is not found
export function getFeatureGateConfig(itemId: string): FeatureGateConfig {
  return featureGateConfig[itemId] || {
    featureName: 'Premium Feature',
    featureDescription: 'This feature is available with a full Agency Brain membership.',
    videoKey: undefined
  };
}
