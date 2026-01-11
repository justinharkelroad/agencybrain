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
    featureDescription: 'Get a real-time snapshot of your agency\'s health—track sales velocity, team performance, and coaching insights all in one glance. Spot trends before they become problems and celebrate wins as they happen.',
    videoKey: 'dashboard_overview'
  },
  
  // Sales folder items
  'sales-dashboard': {
    featureName: 'Sales Dashboard',
    featureDescription: 'See exactly where your revenue is coming from with powerful sales analytics that break down performance by producer, product, and time period. Identify your top performers and replicate their success across your team.',
    videoKey: 'sales_dashboard_overview'
  },
  'ai-sales-bot': {
    featureName: 'AI Roleplay Trainer',
    featureDescription: 'Practice any sales scenario 24/7 with an AI that adapts to your skill level and provides instant coaching feedback. Build muscle memory for objection handling, closing techniques, and discovery questions without burning real leads.',
    videoKey: 'roleplay_bot_overview'
  },
  'lqs-roadmap': {
    featureName: 'LQS Roadmap',
    featureDescription: 'Track your complete Lead → Quote → Sale journey with comprehensive pipeline analytics. Identify exactly where prospects drop off and optimize each stage of your sales funnel.',
    videoKey: 'lqs_roadmap_overview'
  },
  
  // Service folder items
  'cancel-audit': {
    featureName: 'Cancel Audit',
    featureDescription: 'Stop losing policies you worked hard to write. Our cancel audit system identifies at-risk accounts before they leave, giving your team the chance to save the relationship and protect your book.',
    videoKey: 'cancel_audit_overview'
  },
  'renewals': {
    featureName: 'Renewals Dashboard',
    featureDescription: 'Proactively manage your renewal pipeline instead of reacting to cancellations. See which policies are coming up, track retention rates, and ensure no renewal opportunity slips through the cracks.',
    videoKey: 'renewals_overview'
  },
  
  // Accountability folder items
  'scorecards': {
    featureName: 'Scorecards',
    featureDescription: 'Transform accountability from a dreaded chore into a daily habit. Track the leading indicators that drive sales success—calls, quotes, appointments—and watch your team\'s consistency skyrocket.',
    videoKey: 'scorecards_overview'
  },
  
  // Training folder items
  'standard-playbook': {
    featureName: 'Standard Playbook',
    featureDescription: 'Access our battle-tested training curriculum built from the strategies of top-performing agencies. Video lessons, quizzes, and certifications ensure your team masters the fundamentals that drive results.',
    videoKey: 'training_overview'
  },
  'agency-training': {
    featureName: 'Agency Training',
    featureDescription: 'Your agency\'s unique processes deserve custom training. Access modules created specifically for your team\'s workflows, scripts, and procedures—all in one organized library.',
    videoKey: 'agency_training_overview'
  },
  'manage-training': {
    featureName: 'Manage Training',
    featureDescription: 'Build your agency\'s training library without technical skills. Create custom modules, assign courses to team members, and track completion—all from one simple interface.',
    videoKey: 'manage_training_overview'
  },
  'video-training-architect': {
    featureName: 'Video Training Architect',
    featureDescription: 'Turn your expertise into professional training videos using AI. Simply describe what you want to teach, and our architect helps you structure, script, and build engaging video courses.',
    videoKey: 'video_architect_overview'
  },
  
  // Agency Mgmt folder items
  'annual-bonus-tool': {
    featureName: 'Annual Bonus Tool',
    featureDescription: 'Stop guessing what your bonus will be. Input your current metrics and see exactly where you stand against bonus thresholds—plus what it takes to hit the next tier before year-end.',
    videoKey: 'bonus_tool_overview'
  },
  'call-efficiency-tool': {
    featureName: 'Call Efficiency Tool',
    featureDescription: 'Discover if your team is actually on the phones or just saying they are. Analyze call patterns, talk time, and dial rates to optimize productivity and eliminate wasted hours.',
    videoKey: 'call_efficiency_overview'
  },
  'compensation-analyzer': {
    featureName: 'Compensation Analyzer',
    featureDescription: 'Upload your compensation statements and instantly see if you\'re being paid correctly. Catch discrepancies, track trends, and ensure you\'re getting every dollar you\'ve earned.',
    videoKey: 'compensation_analyzer_overview'
  },
  'data-lead-forecaster': {
    featureName: 'Data Lead Forecaster',
    featureDescription: 'Before you spend thousands on data leads, know exactly what return to expect. Input your close rates and average premium to see projected ROI and break-even timelines.',
    videoKey: 'data_forecaster_overview'
  },
  'live-transfer-forecaster': {
    featureName: 'Live Transfer Forecaster',
    featureDescription: 'Live transfers are expensive—make sure they\'re worth it. Calculate expected returns based on your team\'s conversion rates and determine if live transfers make sense for your agency.',
    videoKey: 'transfer_forecaster_overview'
  },
  'mailer-forecaster': {
    featureName: 'Mailer Forecaster',
    featureDescription: 'Direct mail can be a goldmine or a money pit. Model different mailer campaigns, response rates, and close ratios to find the sweet spot before you invest.',
    videoKey: 'mailer_forecaster_overview'
  },
  'roi-on-staff': {
    featureName: 'ROI on Staff',
    featureDescription: 'Know exactly what each team member costs you—and what they return. Make data-driven decisions about hiring, firing, and compensation based on real production numbers.',
    videoKey: 'staff_roi_overview'
  },
  'vendor-verifier': {
    featureName: 'Vendor Verifier',
    featureDescription: 'Stop wasting money on underperforming lead vendors. Compare vendor performance side-by-side, track ROI over time, and hold vendors accountable with hard data.',
    videoKey: 'vendor_verifier_overview'
  },
  'producer-quote-dashboard': {
    featureName: 'Quote Details',
    featureDescription: 'Dive deep into your quote-level data to understand what\'s converting and what\'s not. Track individual producer performance and identify coaching opportunities.',
    videoKey: 'quote_details_overview'
  },
  
  // Personal Growth folder items
  'flows': {
    featureName: 'Flows',
    featureDescription: 'Your best thinking doesn\'t happen in chaos. Our AI-guided reflection sessions help you process challenges, celebrate wins, and gain clarity—in just 10 minutes a day.',
    videoKey: 'flows_overview'
  },
  'core4': {
    featureName: 'Core 4',
    featureDescription: 'Success isn\'t just about sales—it\'s about showing up consistently in Body, Being, Balance, and Business. Track your daily habits and build the foundation that makes everything else possible.',
    videoKey: 'core4_overview'
  },
  'quarterly-targets': {
    featureName: 'Quarterly Targets',
    featureDescription: 'Set meaningful 90-day goals that align with your bigger vision. Our AI helps you break down ambitious targets into actionable weekly milestones you\'ll actually achieve.',
    videoKey: 'life_targets_overview'
  },
  '90-day-audio': {
    featureName: 'Theta Talk Track',
    featureDescription: 'Reprogram your subconscious with personalized affirmation audio tracks set to theta brainwave frequencies. Listen daily and watch your mindset—and your results—transform.',
    videoKey: 'theta_audio_overview'
  },
  'monthly-missions': {
    featureName: 'Monthly Missions',
    featureDescription: 'Bridge the gap between quarterly goals and daily action. AI-generated monthly missions give you exactly what to focus on this month to stay on track for the quarter.',
    videoKey: 'monthly_missions_overview'
  },
  
  // The Exchange
  'the-exchange': {
    featureName: 'The Exchange',
    featureDescription: 'Join a community of growth-minded agency owners who share wins, solve problems together, and push each other higher. Access exclusive resources and connect with peers who get it.',
    videoKey: 'exchange_overview'
  },
  
  // Staff-specific items
  'submit-form': {
    featureName: 'Submit Form',
    featureDescription: 'Submit your daily performance data quickly and easily. Your numbers fuel the analytics that help your agency grow.',
    videoKey: 'submit_form_overview'
  },
  
  // 1:1 Coaching (higher tier)
  '1-on-1': {
    featureName: '1:1 Coaching',
    featureDescription: 'Get personalized, one-on-one coaching sessions with experienced agency growth experts. Tackle your specific challenges with customized strategies built just for your situation.',
    videoKey: '1on1_coaching_overview'
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
