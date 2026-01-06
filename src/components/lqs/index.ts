// LQS (Lead → Quote → Sale) Components
export * from './MarketingBucketModal';
export * from './LeadSourceSpendModal';
export * from './MarketingBucketList';
export * from './EnhancedLeadSourceRow';
export * from './UnassignedLeadSourcesSection';
export * from './QuoteReportUploadModal';

// Cost type label mapping for UI display
export const COST_TYPE_LABELS: Record<string, string> = {
  'per_lead': 'Per Lead',
  'per_transfer': 'Per Transfer',
  'monthly_fixed': 'Monthly Fixed',
  'per_mailer': 'Per Mailer',
};
