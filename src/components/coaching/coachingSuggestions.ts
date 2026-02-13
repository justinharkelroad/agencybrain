import type { InsightType } from '@/types/coaching';
import { DEFAULT_COACHING_SUGGESTION_TEMPLATES } from '@/types/coaching';

export interface InsightContext {
  currentValue: number;
  benchmark: number;
  benchmarkSource: 'target' | 'team_average' | 'prior_period';
  metricKey?: string;
  metricLabel: string;
  objectionName?: string;
  objectionCount?: number;
  trendWeeks?: number;
  priorValue?: number;
  objectionsLookbackDays?: number;
}

const fmt = (v: number, decimals = 1) =>
  Number.isInteger(v) ? v.toString() : v.toFixed(decimals);

const fmtPct = (v: number) => `${fmt(v)}%`;

const renderTemplate = (template: string, context: InsightContext): string => {
  const benchmarkSourceLabel =
    context.benchmarkSource === 'team_average'
      ? 'team average'
      : context.benchmarkSource === 'prior_period'
        ? 'prior period'
        : 'target';

  const variables = {
    currentValue:
      context.metricKey === 'pass_rate' || context.metricKey === 'quote_rate' || context.metricKey === 'close_rate'
      ? fmtPct(context.currentValue)
      : fmt(context.currentValue),
    benchmarkSource: benchmarkSourceLabel,
    benchmarkValue:
      context.metricKey === 'pass_rate' || context.metricKey === 'quote_rate' || context.metricKey === 'close_rate'
      ? fmtPct(context.benchmark)
      : fmt(context.benchmark),
    objectionName: context.objectionName || 'unknown objection',
    objectionCount: String(context.objectionCount || 0),
    trendWeeks: String(context.trendWeeks || 0),
    priorValue: fmt(context.priorValue || 0),
    metricLabel: context.metricLabel || '',
    objectionsLookbackDays: String(context.objectionsLookbackDays || 30),
  };

  return template.replace(/\{(\w+)\}/g, (_, key) => variables[key as keyof typeof variables] || `{${key}}`);
};

const suggestionTemplateByType: Record<InsightType, string> = DEFAULT_COACHING_SUGGESTION_TEMPLATES;

export function getCoachingSuggestion(
  type: InsightType,
  context: InsightContext,
  templates?: Partial<Record<InsightType, string>>,
): string {
  const template = templates?.[type] || suggestionTemplateByType[type];
  return renderTemplate(template, context);
}
