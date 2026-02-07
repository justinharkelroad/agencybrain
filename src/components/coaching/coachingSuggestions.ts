import type { InsightType } from '@/types/coaching';

export interface InsightContext {
  currentValue: number;
  benchmark: number;
  benchmarkSource: 'target' | 'team_average' | 'prior_period';
  metricLabel: string;
  objectionName?: string;
  objectionCount?: number;
  trendWeeks?: number;
  priorValue?: number;
}

const fmt = (v: number, decimals = 1) =>
  Number.isInteger(v) ? v.toString() : v.toFixed(decimals);

const fmtPct = (v: number) => `${fmt(v)}%`;

const suggestionsByType: Record<InsightType, (ctx: InsightContext) => string> = {
  low_quote_rate: (ctx) =>
    `Quote rate is ${fmtPct(ctx.currentValue)} vs ${fmtPct(ctx.benchmark)} ${ctx.benchmarkSource === 'target' ? 'target' : 'team average'}. ` +
    `Schedule a pipeline review — are leads being contacted within 24 hours? ` +
    `Review lead sources and follow-up cadence to identify drop-off points.`,

  low_close_rate: (ctx) =>
    `Close rate is ${fmtPct(ctx.currentValue)} vs ${fmtPct(ctx.benchmark)} ${ctx.benchmarkSource === 'target' ? 'target' : 'team average'}. ` +
    `Review their quoting process — are they presenting full coverage options? ` +
    `Role-play closing scenarios and review recent lost quotes for patterns.`,

  objection_pattern: (ctx) =>
    `"${ctx.objectionName}" came up ${ctx.objectionCount} times in the last 30 days. ` +
    `Schedule a focused coaching session on handling this objection. ` +
    `Consider pairing them with a top performer who handles this objection well.`,

  low_call_volume: (ctx) =>
    `Averaging ${fmt(ctx.currentValue)} calls/day vs ${fmt(ctx.benchmark)} ${ctx.benchmarkSource === 'target' ? 'target' : 'team average'}. ` +
    `Check for time management issues — review their daily schedule and identify non-productive time blocks. ` +
    `Consider setting hourly call goals.`,

  low_talk_time: (ctx) =>
    `Average talk time is ${fmt(ctx.currentValue)} min/day vs ${fmt(ctx.benchmark)} ${ctx.benchmarkSource === 'target' ? 'target' : 'team average'}. ` +
    `Short talk time may indicate rushed conversations or difficulty engaging prospects. ` +
    `Review call recordings to assess conversation quality and rapport-building.`,

  declining_pass_rate: (ctx) =>
    `Pass rate declined from ${fmtPct(ctx.priorValue ?? 0)} to ${fmtPct(ctx.currentValue)} over ${ctx.trendWeeks} weeks. ` +
    `Schedule a 1:1 to identify obstacles — this may indicate burnout, personal issues, or need for skill development. ` +
    `Review which specific metrics are falling short.`,

  declining_metric: (ctx) =>
    `${ctx.metricLabel} has been declining for ${ctx.trendWeeks}+ weeks ` +
    `(from ${fmt(ctx.priorValue ?? 0)} to ${fmt(ctx.currentValue)}). ` +
    `Investigate whether this is a skill gap, motivation issue, or process change. ` +
    `Set specific improvement goals for the next 2 weeks.`,
};

export function getCoachingSuggestion(type: InsightType, context: InsightContext): string {
  return suggestionsByType[type](context);
}
