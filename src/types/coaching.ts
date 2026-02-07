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

export interface CoachingThresholds {
  activityWarningRatio: number;
  activityCriticalRatio: number;
  rateWarningRatio: number;
  rateCriticalRatio: number;
  objectionWarningCount: number;
  objectionCriticalCount: number;
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
  passRateWarningWeeks: 2,
  passRateWarningThreshold: 60,
  passRateCriticalWeeks: 3,
  passRateCriticalThreshold: 40,
};
