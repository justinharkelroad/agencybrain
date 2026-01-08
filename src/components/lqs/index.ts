// LQS (Lead → Quote → Sale) Components
export * from './MarketingBucketModal';
export * from './LeadSourceSpendModal';
export * from './MarketingBucketList';
export * from './EnhancedLeadSourceRow';
export * from './UnassignedLeadSourcesSection';
export * from './QuoteReportUploadModal';
export * from './LqsMetricTiles';
export * from './LqsFilters';
export * from './LqsHouseholdTable';
export * from './LqsHouseholdRow';
export * from './AssignLeadSourceModal';
export * from './LqsOverviewDashboard';
export * from './LqsBucketSelector';
export * from './LqsActionDropdowns';
export * from './AddLeadModal';
export * from './AddQuoteModal';
export * from './LeadUploadModal';

// Cost type label mapping for UI display
export const COST_TYPE_LABELS: Record<string, string> = {
  'per_lead': 'Per Lead',
  'per_transfer': 'Per Transfer',
  'monthly_fixed': 'Monthly Fixed',
  'per_mailer': 'Per Mailer',
};
