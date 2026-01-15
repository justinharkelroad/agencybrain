// LQS (Lead → Quote → Sale) Components
export * from './MarketingBucketModal';
export { LqsGroupedSection } from './LqsGroupedSection';
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
export * from './LqsBucket';
export * from './LqsWaterFlow';
export * from './LqsBucketSelector';
export * from './LqsActionDropdowns';
export * from './AddLeadModal';
export * from './AddQuoteModal';
export * from './LeadUploadModal';
export * from './SalesUploadModal';
export * from './SalesUploadResultsModal';

// Cost type label mapping for UI display
export const COST_TYPE_LABELS: Record<string, string> = {
  'per_lead': 'Per Lead',
  'per_transfer': 'Per Transfer',
  'monthly_fixed': 'Monthly Fixed',
  'per_mailer': 'Per Mailer',
};
