export type InsightType =
  | 'low_quote_rate'
  | 'low_close_rate'
  | 'objection_pattern'
  | 'low_call_volume'
  | 'low_talk_time'
  | 'declining_pass_rate'
  | 'declining_metric';

export type InsightSeverity = 'warning' | 'critical';

export interface CoachingInsight {
  id: string; // `${teamMemberId}-${type}-${metricKey}`
  type: InsightType;
  severity: InsightSeverity;
  teamMemberId: string;
  teamMemberName: string;
  metricKey: string;
  metricLabel: string;
  currentValue: number;
  benchmark: number;
  benchmarkSource: 'target' | 'team_average' | 'prior_period';
  suggestion: string;
  objectionName?: string;
  objectionCount?: number;
  trendWeeks?: number;
  priorValue?: number;
}

export interface TeamMemberInsights {
  teamMemberId: string;
  teamMemberName: string;
  role: string;
  insights: CoachingInsight[];
  criticalCount: number;
  warningCount: number;
}

export interface CoachingInsightFeatureFlags {
  lowQuoteRate: boolean;
  lowCloseRate: boolean;
  objectionPattern: boolean;
  lowCallVolume: boolean;
  lowTalkTime: boolean;
  decliningPassRate: boolean;
}

export interface CoachingInsightWindows {
  metricsLookbackDays: number;
  objectionsLookbackDays: number;
  passRateLookbackDays: number;
  passRateBuckets: number;
}

export interface CoachingBenchmarkConfig {
  useTeamAverageForActivity: boolean;
  useTeamAverageForRates: boolean;
  minTeamMembersForAverages: number;
}

export type CoachingSuggestionTemplateMap = Record<InsightType, string>;

export interface CoachingInsightConfig {
  thresholds: CoachingThresholds;
  featureFlags: CoachingInsightFeatureFlags;
  windows: CoachingInsightWindows;
  benchmarkConfig: CoachingBenchmarkConfig;
  suggestionTemplates: CoachingSuggestionTemplateMap;
}

export interface CoachingThresholds {
  activityWarningRatio: number;
  activityCriticalRatio: number;
  rateWarningRatio: number;
  rateCriticalRatio: number;
  objectionWarningCount: number;
  objectionCriticalCount: number;
  minQuoteRateSampleLeads: number;
  minCloseRateSampleQuoted: number;
  minActivitySampleDays: number;
  minPassRateSampleDays: number;
  passRateWarningWeeks: number;
  passRateWarningThreshold: number;
  passRateCriticalWeeks: number;
  passRateCriticalThreshold: number;
}

export const DEFAULT_COACHING_THRESHOLDS: CoachingThresholds = {
  activityWarningRatio: 0.8,
  activityCriticalRatio: 0.5,
  rateWarningRatio: 0.8,
  rateCriticalRatio: 0.5,
  objectionWarningCount: 3,
  objectionCriticalCount: 5,
  minQuoteRateSampleLeads: 8,
  minCloseRateSampleQuoted: 5,
  minActivitySampleDays: 7,
  minPassRateSampleDays: 8,
  passRateWarningWeeks: 2,
  passRateWarningThreshold: 60,
  passRateCriticalWeeks: 3,
  passRateCriticalThreshold: 40,
};

export type CoachingSampleSizeProfile = 'conservative' | 'average' | 'aggressive';

export const COACHING_SAMPLE_SIZE_PRESETS: Record<
  CoachingSampleSizeProfile,
  Pick<
    CoachingThresholds,
    'minQuoteRateSampleLeads' | 'minCloseRateSampleQuoted' | 'minActivitySampleDays' | 'minPassRateSampleDays'
  >
> = {
  conservative: {
    minQuoteRateSampleLeads: 15,
    minCloseRateSampleQuoted: 10,
    minActivitySampleDays: 14,
    minPassRateSampleDays: 18,
  },
  average: {
    minQuoteRateSampleLeads: 8,
    minCloseRateSampleQuoted: 5,
    minActivitySampleDays: 7,
    minPassRateSampleDays: 8,
  },
  aggressive: {
    minQuoteRateSampleLeads: 4,
    minCloseRateSampleQuoted: 3,
    minActivitySampleDays: 4,
    minPassRateSampleDays: 5,
  },
};

export const DEFAULT_COACHING_FEATURE_FLAGS: CoachingInsightFeatureFlags = {
  lowQuoteRate: true,
  lowCloseRate: true,
  objectionPattern: true,
  lowCallVolume: true,
  lowTalkTime: true,
  decliningPassRate: true,
};

export const DEFAULT_COACHING_INSIGHT_WINDOWS: CoachingInsightWindows = {
  metricsLookbackDays: 60,
  objectionsLookbackDays: 30,
  passRateLookbackDays: 28,
  passRateBuckets: 4,
};

export const DEFAULT_COACHING_BENCHMARK_CONFIG: CoachingBenchmarkConfig = {
  useTeamAverageForActivity: true,
  useTeamAverageForRates: true,
  minTeamMembersForAverages: 3,
};

export const DEFAULT_COACHING_SUGGESTION_TEMPLATES: CoachingSuggestionTemplateMap = {
  low_quote_rate:
    'Quote rate is {currentValue}% vs {benchmarkValue}% ({benchmarkSource}). Schedule a pipeline review — are leads being contacted within 24 hours? Review lead sources and follow-up cadence to identify drop-off points.',
  low_close_rate:
    'Close rate is {currentValue}% vs {benchmarkValue}% ({benchmarkSource}). Review their quoting process — are they presenting full coverage options? Role-play closing scenarios and review recent lost quotes for patterns.',
  objection_pattern:
    '"{objectionName}" came up {objectionCount} times in the last {objectionsLookbackDays} days. Schedule a focused coaching session on handling this objection. Consider pairing them with a top performer who handles this objection well.',
  low_call_volume:
    'Averaging {currentValue} calls/day vs {benchmarkValue} {benchmarkSource}. Check for time management issues — review their daily schedule and identify non-productive time blocks. Consider setting hourly call goals.',
  low_talk_time:
    'Average talk time is {currentValue} min/day vs {benchmarkValue} {benchmarkSource}. Short talk time may indicate rushed conversations or difficulty engaging prospects. Review call recordings to assess conversation quality and rapport-building.',
  declining_pass_rate:
    'Pass rate declined over {trendWeeks} weeks and is now {currentValue}% (from {priorValue}%). Schedule a 1:1 to identify obstacles—this may indicate burnout, personal issues, or a skill gap. Review which specific metrics are falling short.',
  declining_metric:
    '{metricLabel} has been declining for {trendWeeks}+ weeks ({priorValue} to {currentValue}). Investigate whether this is a skill gap, motivation issue, or process change. Set specific improvement goals for the next 2 weeks.',
};

export const DEFAULT_COACHING_INSIGHT_CONFIG: CoachingInsightConfig = {
  thresholds: DEFAULT_COACHING_THRESHOLDS,
  featureFlags: DEFAULT_COACHING_FEATURE_FLAGS,
  windows: DEFAULT_COACHING_INSIGHT_WINDOWS,
  benchmarkConfig: DEFAULT_COACHING_BENCHMARK_CONFIG,
  suggestionTemplates: DEFAULT_COACHING_SUGGESTION_TEMPLATES,
};

export function mergeCoachingInsightConfig(partial?: Partial<CoachingInsightConfig> | null): CoachingInsightConfig {
  return {
    thresholds: { ...DEFAULT_COACHING_THRESHOLDS, ...(partial?.thresholds ?? {}) },
    featureFlags: { ...DEFAULT_COACHING_FEATURE_FLAGS, ...(partial?.featureFlags ?? {}) },
    windows: { ...DEFAULT_COACHING_INSIGHT_WINDOWS, ...(partial?.windows ?? {}) },
    benchmarkConfig: { ...DEFAULT_COACHING_BENCHMARK_CONFIG, ...(partial?.benchmarkConfig ?? {}) },
    suggestionTemplates: { ...DEFAULT_COACHING_SUGGESTION_TEMPLATES, ...(partial?.suggestionTemplates ?? {}) },
  };
}
