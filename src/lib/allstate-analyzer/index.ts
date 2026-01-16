// Explicit re-exports to avoid name conflicts (ProductBreakdown exists in both modules)
export {
  compareStatements,
  type ProductBreakdown as ComparisonProductBreakdown,
  type BusinessTypeBreakdown,
  type ComparisonResult,
} from './comparison-engine';

export * from './rate-validator';

export {
  analyzeSubProducers,
  getProducerDisplayName,
  type SubProducerTransaction,
  type InsuredAggregate,
  type BundleTypeBreakdown,
  type ProductBreakdown as SubProducerProductBreakdown,
  type SubProducerMetrics,
  type SubProducerSummary,
  type TeamMemberForLookup,
} from './sub-producer-analyzer';
