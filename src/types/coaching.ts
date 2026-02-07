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
