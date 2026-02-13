import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { getCoachingSuggestion } from '@/components/coaching/coachingSuggestions';
import type {
  CoachingInsight,
  CoachingThresholds,
  InsightSeverity,
  TeamMemberInsights,
  CoachingInsightConfig,
} from '@/types/coaching';
import {
  DEFAULT_COACHING_INSIGHT_CONFIG,
  mergeCoachingInsightConfig,
} from '@/types/coaching';

interface MetricsDailyRow {
  team_member_id: string;
  date: string;
  outbound_calls: number | null;
  quoted_count: number | null;
  sold_items: number | null;
  talk_minutes: number | null;
  pass: boolean | null;
  hits: number;
  role: string | null;
}

interface TeamMemberRow {
  id: string;
  name: string;
  role: string;
  status: string;
}

interface ObjectionRow {
  team_member_id: string;
  objection_id: string;
  objection_name: string;
  count: number;
}

interface LqsCountRow {
  team_member_id: string;
  quoted: number;
  sold: number;
  leads: number;
}

interface TargetRow {
  metric_key: string;
  value_number: number;
  team_member_id: string | null;
}

const PAGE_SIZE = 1000;
const MAX_FETCH = 10000;
const IN_BATCH_SIZE = 400; // Supabase .in() parameter limit safety margin

type CoachingInsightSettingsRow = {
  thresholds: CoachingThresholds;
  feature_flags: CoachingInsightConfig['featureFlags'];
  analysis_windows: CoachingInsightConfig['windows'];
  benchmark_config: CoachingInsightConfig['benchmarkConfig'];
  suggestion_templates: CoachingInsightConfig['suggestionTemplates'];
};

export function useCoachingInsights(agencyId: string | null) {
  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');

  const settingsQuery = useQuery({
    queryKey: ['coaching-insight-config', agencyId],
    enabled: !!agencyId,
    staleTime: 60_000,
    queryFn: async (): Promise<CoachingInsightConfig> => {
      const { data, error } = await supabase
        .from('coaching_insight_settings')
        .select('*')
        .eq('agency_id', agencyId!)
        .maybeSingle();
      if (error) {
        console.warn('[coaching-insights] settings query failed, using defaults', error);
        return DEFAULT_COACHING_INSIGHT_CONFIG;
      }
      if (!data) return DEFAULT_COACHING_INSIGHT_CONFIG;
      const row = data as unknown as CoachingInsightSettingsRow;
      return mergeCoachingInsightConfig({
        thresholds: row.thresholds,
        featureFlags: row.feature_flags,
        windows: row.analysis_windows,
        benchmarkConfig: row.benchmark_config,
        suggestionTemplates: row.suggestion_templates,
      });
    },
  });

  const config = settingsQuery.data ?? DEFAULT_COACHING_INSIGHT_CONFIG;
  const metricsWindowDays = Math.max(1, config.windows.metricsLookbackDays);
  const objectionsWindowDays = Math.max(1, config.windows.objectionsLookbackDays);
  const passRateWindowDays = Math.max(7, config.windows.passRateLookbackDays);
  const passRateBuckets = Math.max(2, config.windows.passRateBuckets);
  const metricsQueryWindowDays = Math.max(metricsWindowDays, passRateWindowDays);
  const metricsSince = format(subDays(now, metricsQueryWindowDays), 'yyyy-MM-dd');
  const activitySince = format(subDays(now, metricsWindowDays), 'yyyy-MM-dd');
  const objectionsSince = format(subDays(now, objectionsWindowDays), 'yyyy-MM-dd');
  const passRateSince = format(subDays(now, passRateWindowDays), 'yyyy-MM-dd');

  // 1. Team members
  const teamMembersQuery = useQuery({
    queryKey: ['coaching-team-members', agencyId],
    enabled: !!agencyId,
    staleTime: 60_000,
    queryFn: async (): Promise<TeamMemberRow[]> => {
      const primary = await supabase
        .from('team_members')
        .select('id, name, role, status')
        .eq('agency_id', agencyId!)
        .eq('status', 'active')
        .eq('include_in_metrics', true);

      if (!primary.error) {
        return (primary.data || []) as TeamMemberRow[];
      }

      // Backward-compat fallback for environments missing include_in_metrics.
      if (primary.error.code === '42703') {
        const fallback = await supabase
          .from('team_members')
          .select('id, name, role, status')
          .eq('agency_id', agencyId!)
          .eq('status', 'active');
        if (fallback.error) {
          console.warn('[coaching-insights] team_members fallback failed', fallback.error);
          return [];
        }
        return (fallback.data || []) as TeamMemberRow[];
      }

      console.warn('[coaching-insights] team_members query failed', primary.error);
      return [];
    },
  });

  // 2. metrics_daily (dynamic window) with pagination
  const metricsQuery = useQuery({
    queryKey: ['coaching-metrics-daily', agencyId, metricsQueryWindowDays, today],
    enabled: !!agencyId,
    staleTime: 60_000,
    queryFn: async (): Promise<MetricsDailyRow[]> => {
      const allRows: MetricsDailyRow[] = [];
      for (let from = 0; from < MAX_FETCH; from += PAGE_SIZE) {
        const { data: page, error } = await supabase
          .from('metrics_daily')
          .select('team_member_id, date, outbound_calls, quoted_count, sold_items, talk_minutes, pass, hits, role')
          .eq('agency_id', agencyId!)
          .gte('date', metricsSince)
          .lte('date', today)
          .range(from, from + PAGE_SIZE - 1);
        if (error) {
          console.warn('[coaching-insights] metrics_daily query failed', error);
          return [];
        }
        if (!page || page.length === 0) break;
        allRows.push(...(page as MetricsDailyRow[]));
        if (page.length < PAGE_SIZE) break;
      }
      return allRows;
    },
  });

  // 3. LQS pipeline counts per team member (60 days)
  const lqsQuery = useQuery({
    queryKey: ['coaching-lqs-counts', agencyId, metricsWindowDays, today],
    enabled: !!agencyId,
    staleTime: 60_000,
    queryFn: async (): Promise<LqsCountRow[]> => {
      // Get households with team members in the date range
      const { data: households, error: hhError } = await supabase
        .from('lqs_households')
        .select('id, team_member_id, status')
        .eq('agency_id', agencyId!)
        .not('team_member_id', 'is', null)
        .gte('created_at', activitySince);
      if (hhError) {
        console.warn('[coaching-insights] lqs_households query failed', hhError);
        return [];
      }
      if (!households || households.length === 0) return [];

      const householdIds = households.map(h => h.id);

      // Batch .in() queries to avoid Supabase parameter limits
      const quotedHHSet = new Set<string>();
      const soldHHSet = new Set<string>();

      for (let i = 0; i < householdIds.length; i += IN_BATCH_SIZE) {
        const batch = householdIds.slice(i, i + IN_BATCH_SIZE);

        const [quotesRes, salesRes] = await Promise.all([
          supabase
            .from('lqs_quotes')
            .select('household_id')
            .eq('agency_id', agencyId!)
            .in('household_id', batch),
          supabase
            .from('lqs_sales')
            .select('household_id')
            .eq('agency_id', agencyId!)
            .in('household_id', batch),
        ]);

        if (quotesRes.error) {
          console.warn('[coaching-insights] lqs_quotes query failed', quotesRes.error);
          return [];
        }
        if (salesRes.error) {
          console.warn('[coaching-insights] lqs_sales query failed', salesRes.error);
          return [];
        }

        for (const q of quotesRes.data || []) quotedHHSet.add(q.household_id);
        for (const s of salesRes.data || []) soldHHSet.add(s.household_id);
      }

      // Aggregate by team_member_id
      const byMember = new Map<string, { leads: number; quoted: number; sold: number }>();
      for (const hh of households) {
        const tmId = hh.team_member_id!;
        if (!byMember.has(tmId)) byMember.set(tmId, { leads: 0, quoted: 0, sold: 0 });
        const m = byMember.get(tmId)!;
        m.leads++;
        if (quotedHHSet.has(hh.id)) m.quoted++;
        if (soldHHSet.has(hh.id)) m.sold++;
      }

      return Array.from(byMember.entries()).map(([team_member_id, counts]) => ({
        team_member_id,
        ...counts,
      }));
    },
  });

  // 4. Objection frequency (30 days)
  const objectionsQuery = useQuery({
    queryKey: ['coaching-objections', agencyId, objectionsWindowDays],
    enabled: !!agencyId,
    staleTime: 60_000,
    queryFn: async (): Promise<ObjectionRow[]> => {
      const { data, error } = await supabase
        .from('lqs_households')
        .select('team_member_id, objection_id, lqs_objections(name)')
        .eq('agency_id', agencyId!)
        .not('objection_id', 'is', null)
        .not('team_member_id', 'is', null)
        .gte('updated_at', objectionsSince);
      if (error) {
        console.warn('[coaching-insights] objections query failed', error);
        return [];
      }
      if (!data || data.length === 0) return [];

      // Group by (team_member_id, objection_id)
      const countMap = new Map<string, { team_member_id: string; objection_id: string; objection_name: string; count: number }>();
      for (const row of data) {
        const key = `${row.team_member_id}-${row.objection_id}`;
        if (!countMap.has(key)) {
          const objName = (row.lqs_objections as any)?.name || 'Unknown';
          countMap.set(key, {
            team_member_id: row.team_member_id!,
            objection_id: row.objection_id!,
            objection_name: objName,
            count: 0,
          });
        }
        countMap.get(key)!.count++;
      }
      return Array.from(countMap.values());
    },
  });

  // 5. Targets (agency-level + per-member)
  const targetsQuery = useQuery({
    queryKey: ['coaching-targets', agencyId],
    enabled: !!agencyId,
    staleTime: 60_000,
    queryFn: async (): Promise<TargetRow[]> => {
      const { data, error } = await supabase
        .from('targets')
        .select('metric_key, value_number, team_member_id')
        .eq('agency_id', agencyId!);
      if (error) {
        console.warn('[coaching-insights] targets query failed', error);
        return [];
      }
      return (data || []) as TargetRow[];
    },
  });

  // Compute insights
  const result = useMemo(() => {
    const teamMembers = teamMembersQuery.data;
    const metrics = metricsQuery.data;
    const lqsCounts = lqsQuery.data;
    const objections = objectionsQuery.data;
    const targets = targetsQuery.data;
    const thresholds = config.thresholds;
    const featureFlags = config.featureFlags;
    const benchmarkConfig = config.benchmarkConfig;
    const suggestionTemplates = config.suggestionTemplates;
    const minQuoteRateSampleLeads = Math.max(1, thresholds.minQuoteRateSampleLeads);
    const minCloseRateSampleQuoted = Math.max(1, thresholds.minCloseRateSampleQuoted);
    const minActivitySampleDays = Math.max(1, thresholds.minActivitySampleDays);
    const minPassRateSampleDays = Math.max(1, thresholds.minPassRateSampleDays);

    if (!teamMembers || !metrics) return null;

    const insights: CoachingInsight[] = [];

    // Build lookups
    const memberNameMap = new Map(teamMembers.map(m => [m.id, m.name]));
    const memberRoleMap = new Map(teamMembers.map(m => [m.id, m.role]));
    const metricKeyForObjection = (objectionId: string) => `objection_${objectionId}`;

    // Target lookup: prefer per-member target, then agency-level
    const getTarget = (metricKey: string, memberId: string): number | null => {
      if (!targets) return null;
      const memberTarget = targets.find(t => t.metric_key === metricKey && t.team_member_id === memberId);
      if (memberTarget) return memberTarget.value_number;
      const agencyTarget = targets.find(t => t.metric_key === metricKey && t.team_member_id === null);
      if (agencyTarget) return agencyTarget.value_number;
      return null;
    };

    const activityWindowRows = metrics.filter(m => m.date >= activitySince);
    const passRateWindowRows = metrics.filter(m => m.date >= passRateSince);

    // Aggregate metrics per member for activity windows
    const activityRowsByMember = new Map<string, MetricsDailyRow[]>();
    for (const m of activityWindowRows) {
      if (!activityRowsByMember.has(m.team_member_id)) activityRowsByMember.set(m.team_member_id, []);
      activityRowsByMember.get(m.team_member_id)!.push(m);
    }

    // Pass-rate specific rows and team buckets per member
    const passRateRowsByMember = new Map<string, MetricsDailyRow[]>();
    for (const m of passRateWindowRows) {
      if (!passRateRowsByMember.has(m.team_member_id)) passRateRowsByMember.set(m.team_member_id, []);
      passRateRowsByMember.get(m.team_member_id)!.push(m);
    }

    // Team averages for activity analysis period
    const teamCallsPerDay: number[] = [];
    const teamTalkMinPerDay: number[] = [];
    for (const [, rows] of activityRowsByMember) {
      const daysCount = rows.length || 1;
      const totalCalls = rows.reduce((s, r) => s + (r.outbound_calls || 0), 0);
      const totalTalk = rows.reduce((s, r) => s + (r.talk_minutes || 0), 0);
      teamCallsPerDay.push(totalCalls / daysCount);
      teamTalkMinPerDay.push(totalTalk / daysCount);
    }
    const avgTeamCallsPerDay = teamCallsPerDay.length > 0
      ? teamCallsPerDay.reduce((a, b) => a + b, 0) / teamCallsPerDay.length : 0;
    const avgTeamTalkMinPerDay = teamTalkMinPerDay.length > 0
      ? teamTalkMinPerDay.reduce((a, b) => a + b, 0) / teamTalkMinPerDay.length : 0;

    // LQS team averages
    const lqsByMember = new Map((lqsCounts || []).map(l => [l.team_member_id, l]));
    const teamQuoteRates: number[] = [];
    const teamCloseRates: number[] = [];
    for (const l of lqsCounts || []) {
      if (l.leads > 0) teamQuoteRates.push((l.quoted / l.leads) * 100);
      if (l.quoted > 0) teamCloseRates.push((l.sold / l.quoted) * 100);
    }
    const avgTeamQuoteRate = teamQuoteRates.length > 0
      ? teamQuoteRates.reduce((a, b) => a + b, 0) / teamQuoteRates.length : 0;
    const avgTeamCloseRate = teamCloseRates.length > 0
      ? teamCloseRates.reduce((a, b) => a + b, 0) / teamCloseRates.length : 0;

    const hasMeaningfulTeamAvg = teamMembers.length >= Math.max(2, benchmarkConfig.minTeamMembersForAverages);

    for (const member of teamMembers) {
      const memberId = member.id;
      const memberName = member.name;
      const activityMemberRows = activityRowsByMember.get(memberId) || [];
      const passRateMemberRows = passRateRowsByMember.get(memberId) || [];
      const memberRows = activityMemberRows;
      const daysSubmitted = memberRows.length;

      if (daysSubmitted === 0) continue; // No data to analyze

      // --- A. Quote Rate ---
      // Targets are daily absolute counts (e.g., "3 quotes/day"), not percentages,
      // so we use team average as the benchmark for rate-based comparisons.
      const lqs = lqsByMember.get(memberId);
      if (featureFlags.lowQuoteRate && lqs && lqs.leads >= minQuoteRateSampleLeads) {
        const quoteRate = (lqs.quoted / lqs.leads) * 100;
        let benchmark: number | null = null;
        let benchmarkSource: CoachingInsight['benchmarkSource'] = 'team_average';

        if (benchmarkConfig.useTeamAverageForRates && hasMeaningfulTeamAvg && avgTeamQuoteRate > 0) {
          benchmark = avgTeamQuoteRate;
        }

        if (benchmark && benchmark > 0) {
          const ratio = quoteRate / benchmark;
          let severity: InsightSeverity | null = null;
          if (ratio < thresholds.rateCriticalRatio) severity = 'critical';
          else if (ratio < thresholds.rateWarningRatio) severity = 'warning';

          if (severity) {
            const ctx = {
              metricKey: 'quote_rate',
              currentValue: quoteRate,
              benchmark,
              benchmarkSource,
              metricLabel: 'Quote Rate',
            };
            insights.push({
              id: `${memberId}-low_quote_rate-quote_rate`,
              type: 'low_quote_rate',
              severity,
              teamMemberId: memberId,
              teamMemberName: memberName,
              metricKey: 'quote_rate',
              metricLabel: 'Quote Rate',
              currentValue: quoteRate,
              benchmark,
              benchmarkSource,
              suggestion: getCoachingSuggestion('low_quote_rate', {
                ...ctx,
                objectionsLookbackDays: objectionsWindowDays,
              }, suggestionTemplates),
            });
          }
        }
      }

      // --- B. Close Rate ---
      if (featureFlags.lowCloseRate && lqs && lqs.quoted >= minCloseRateSampleQuoted) {
        const closeRate = (lqs.sold / lqs.quoted) * 100;
        let benchmark: number | null = null;
        let benchmarkSource: CoachingInsight['benchmarkSource'] = 'team_average';

        if (benchmarkConfig.useTeamAverageForRates && hasMeaningfulTeamAvg && avgTeamCloseRate > 0) {
          benchmark = avgTeamCloseRate;
          benchmarkSource = 'team_average';
        }

        if (benchmark && benchmark > 0) {
          const ratio = closeRate / benchmark;
          let severity: InsightSeverity | null = null;
          if (ratio < thresholds.rateCriticalRatio) severity = 'critical';
          else if (ratio < thresholds.rateWarningRatio) severity = 'warning';

          if (severity) {
            const ctx = {
              metricKey: 'close_rate',
              currentValue: closeRate,
              benchmark,
              benchmarkSource,
              metricLabel: 'Close Rate',
            };
            insights.push({
              id: `${memberId}-low_close_rate-close_rate`,
              type: 'low_close_rate',
              severity,
              teamMemberId: memberId,
              teamMemberName: memberName,
              metricKey: 'close_rate',
              metricLabel: 'Close Rate',
              currentValue: closeRate,
              benchmark,
              benchmarkSource,
              suggestion: getCoachingSuggestion('low_close_rate', {
                ...ctx,
                objectionsLookbackDays: objectionsWindowDays,
              }, suggestionTemplates),
            });
          }
        }
      }

      // --- C. Objection Pattern ---
      if (featureFlags.objectionPattern && objections) {
        const memberObjections = objections.filter(o => o.team_member_id === memberId);
        for (const obj of memberObjections) {
          let severity: InsightSeverity | null = null;
          if (obj.count >= thresholds.objectionCriticalCount) severity = 'critical';
          else if (obj.count >= thresholds.objectionWarningCount) severity = 'warning';

          if (severity) {
            const ctx = {
              currentValue: obj.count,
              benchmark: 0,
              benchmarkSource: 'team_average' as const,
              metricLabel: 'Objection',
              objectionName: obj.objection_name,
              objectionCount: obj.count,
            };
            insights.push({
              id: `${memberId}-objection_pattern-${obj.objection_id}`,
              type: 'objection_pattern',
              severity,
              teamMemberId: memberId,
              teamMemberName: memberName,
              metricKey: metricKeyForObjection(obj.objection_id),
              metricLabel: obj.objection_name,
              currentValue: obj.count,
              benchmark: 0,
              benchmarkSource: 'team_average',
              suggestion: getCoachingSuggestion('objection_pattern', {
                ...ctx,
                metricKey: metricKeyForObjection(obj.objection_id),
                objectionsLookbackDays: objectionsWindowDays,
              }, suggestionTemplates),
              objectionName: obj.objection_name,
              objectionCount: obj.count,
            });
          }
        }
      }

      // --- D. Activity Struggles ---
      const totalCalls = memberRows.reduce((s, r) => s + (r.outbound_calls || 0), 0);
      const avgCalls = totalCalls / daysSubmitted;
      const callTarget = getTarget('outbound_calls', memberId);
      {
        let benchmark = callTarget;
        let benchmarkSource: CoachingInsight['benchmarkSource'] = 'target';
        if (!benchmark && benchmarkConfig.useTeamAverageForActivity && hasMeaningfulTeamAvg && avgTeamCallsPerDay > 0) {
          benchmark = avgTeamCallsPerDay;
          benchmarkSource = 'team_average';
        }
        if (featureFlags.lowCallVolume && daysSubmitted >= minActivitySampleDays && benchmark && benchmark > 0) {
          const ratio = avgCalls / benchmark;
          let severity: InsightSeverity | null = null;
          if (ratio < thresholds.activityCriticalRatio) severity = 'critical';
          else if (ratio < thresholds.activityWarningRatio) severity = 'warning';

          if (severity) {
            const ctx = {
              metricKey: 'outbound_calls',
              currentValue: avgCalls,
              benchmark,
              benchmarkSource,
              metricLabel: 'Outbound Calls',
            };
            insights.push({
              id: `${memberId}-low_call_volume-outbound_calls`,
              type: 'low_call_volume',
              severity,
              teamMemberId: memberId,
              teamMemberName: memberName,
              metricKey: 'outbound_calls',
              metricLabel: 'Outbound Calls',
              currentValue: avgCalls,
              benchmark,
              benchmarkSource,
              suggestion: getCoachingSuggestion(
                'low_call_volume',
                { ...ctx, objectionsLookbackDays: objectionsWindowDays },
                suggestionTemplates,
              ),
            });
          }
        }
      }

      // Talk time
      const totalTalk = memberRows.reduce((s, r) => s + (r.talk_minutes || 0), 0);
      const avgTalk = totalTalk / daysSubmitted;
      const talkTarget = getTarget('talk_minutes', memberId);
      {
        let benchmark = talkTarget;
        let benchmarkSource: CoachingInsight['benchmarkSource'] = 'target';
        if (!benchmark && benchmarkConfig.useTeamAverageForActivity && hasMeaningfulTeamAvg && avgTeamTalkMinPerDay > 0) {
          benchmark = avgTeamTalkMinPerDay;
          benchmarkSource = 'team_average';
        }
        if (featureFlags.lowTalkTime && daysSubmitted >= minActivitySampleDays && benchmark && benchmark > 0) {
          const ratio = avgTalk / benchmark;
          let severity: InsightSeverity | null = null;
          if (ratio < thresholds.activityCriticalRatio) severity = 'critical';
          else if (ratio < thresholds.activityWarningRatio) severity = 'warning';

          if (severity) {
            const ctx = {
              metricKey: 'talk_minutes',
              currentValue: avgTalk,
              benchmark,
              benchmarkSource,
              metricLabel: 'Talk Time',
            };
            insights.push({
              id: `${memberId}-low_talk_time-talk_minutes`,
              type: 'low_talk_time',
              severity,
              teamMemberId: memberId,
              teamMemberName: memberName,
              metricKey: 'talk_minutes',
              metricLabel: 'Talk Time (min/day)',
              currentValue: avgTalk,
              benchmark,
              benchmarkSource,
              suggestion: getCoachingSuggestion(
                'low_talk_time',
                { ...ctx, objectionsLookbackDays: objectionsWindowDays },
                suggestionTemplates,
              ),
            });
          }
        }
      }

      // --- E. Declining Pass Rate ---
      // Split recent window into configurable buckets
      const passRateSampleCount = passRateMemberRows.filter(r => r.pass !== null).length;
      if (!featureFlags.decliningPassRate || passRateSampleCount < minPassRateSampleDays) {
        continue;
      }
      const sortedRows = [...passRateMemberRows].sort((a, b) => a.date.localeCompare(b.date));
      const passRateLookbackDaysActual = Math.max(1, Math.ceil((new Date(today).getTime() - new Date(passRateSince).getTime()) / (1000 * 60 * 60 * 24)));
      const daysPerBucket = Math.max(1, Math.floor(passRateLookbackDaysActual / passRateBuckets));
      const weekBuckets: boolean[][] = Array.from({ length: passRateBuckets }, () => []);
      for (const row of sortedRows) {
        const dayOffset = Math.floor(
          (new Date(row.date).getTime() - new Date(passRateSince).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (dayOffset < 0) continue;
        const weekIdx = Math.min(Math.floor(dayOffset / daysPerBucket), passRateBuckets - 1);
        if (row.pass !== null && weekIdx >= 0 && weekIdx < weekBuckets.length) {
          weekBuckets[weekIdx].push(row.pass);
        }
      }

      const weekPassRates = weekBuckets.map(bucket => {
        if (bucket.length === 0) return null;
        return (bucket.filter(p => p).length / bucket.length) * 100;
      });

      // Check for consecutive declining weeks
      let decliningWeeks = 0;
      let firstNonNullRate: number | null = null;
      for (let i = 1; i < weekPassRates.length; i++) {
        const prev = weekPassRates[i - 1];
        const curr = weekPassRates[i];
        if (prev !== null && curr !== null && curr < prev) {
          decliningWeeks++;
          if (firstNonNullRate === null) firstNonNullRate = prev;
        } else {
          decliningWeeks = 0;
          firstNonNullRate = null;
        }
      }

      const latestPassRate = weekPassRates[weekPassRates.length - 1] ?? null;
      if (featureFlags.decliningPassRate && latestPassRate !== null && decliningWeeks >= thresholds.passRateWarningWeeks) {
        let severity: InsightSeverity | null = null;
        if (decliningWeeks >= thresholds.passRateCriticalWeeks && latestPassRate < thresholds.passRateCriticalThreshold) severity = 'critical';
        else if (decliningWeeks >= thresholds.passRateWarningWeeks && latestPassRate < thresholds.passRateWarningThreshold) severity = 'warning';

        if (severity) {
          const ctx = {
            currentValue: latestPassRate,
            benchmark: 0,
            benchmarkSource: 'prior_period' as const,
            metricLabel: 'Pass Rate',
            trendWeeks: decliningWeeks,
            priorValue: firstNonNullRate ?? 0,
          };
          insights.push({
            id: `${memberId}-declining_pass_rate-pass_rate`,
            type: 'declining_pass_rate',
            severity,
            teamMemberId: memberId,
            teamMemberName: memberName,
            metricKey: 'pass_rate',
            metricLabel: 'Pass Rate',
            currentValue: latestPassRate,
            benchmark: 0,
            benchmarkSource: 'prior_period',
            suggestion: getCoachingSuggestion('declining_pass_rate', {
              ...ctx,
              metricKey: 'pass_rate',
              objectionsLookbackDays: objectionsWindowDays,
            }, suggestionTemplates),
            trendWeeks: decliningWeeks,
            priorValue: firstNonNullRate ?? undefined,
          });
        }
      }
    }

    // --- Group by team member ---
    const byMember = new Map<string, CoachingInsight[]>();
    for (const insight of insights) {
      if (!byMember.has(insight.teamMemberId)) byMember.set(insight.teamMemberId, []);
      byMember.get(insight.teamMemberId)!.push(insight);
    }

    const teamMemberInsights: TeamMemberInsights[] = Array.from(byMember.entries())
      .map(([memberId, memberInsights]) => {
        const criticalCount = memberInsights.filter(i => i.severity === 'critical').length;
        const warningCount = memberInsights.filter(i => i.severity === 'warning').length;
        return {
          teamMemberId: memberId,
          teamMemberName: memberNameMap.get(memberId) || 'Unknown',
          role: memberRoleMap.get(memberId) || 'Unknown',
          insights: memberInsights.sort((a, b) => {
            if (a.severity === 'critical' && b.severity !== 'critical') return -1;
            if (a.severity !== 'critical' && b.severity === 'critical') return 1;
            return 0;
          }),
          criticalCount,
          warningCount,
        };
      })
      .sort((a, b) => {
        // Critical first, then by total insight count
        if (a.criticalCount !== b.criticalCount) return b.criticalCount - a.criticalCount;
        return b.insights.length - a.insights.length;
      });

    // Summary stats
    const totalPassDays = passRateWindowRows.filter(r => r.pass === true).length;
    const totalCountedDays = passRateWindowRows.filter(r => r.pass !== null).length;
    const teamPassRate = totalCountedDays > 0 ? (totalPassDays / totalCountedDays) * 100 : 0;

    return {
      teamMemberInsights,
      totalCritical: insights.filter(i => i.severity === 'critical').length,
      totalWarnings: insights.filter(i => i.severity === 'warning').length,
      membersNeedingAttention: teamMemberInsights.length,
      teamPassRate,
    };
  }, [
    teamMembersQuery.data,
    metricsQuery.data,
    lqsQuery.data,
    objectionsQuery.data,
    targetsQuery.data,
    settingsQuery.data,
    metricsWindowDays,
    objectionsWindowDays,
    passRateWindowDays,
    passRateBuckets,
    today,
  ]);

  const isLoading =
    teamMembersQuery.isLoading ||
    metricsQuery.isLoading ||
    lqsQuery.isLoading ||
    objectionsQuery.isLoading ||
    targetsQuery.isLoading ||
    settingsQuery.isLoading;

  const error =
    teamMembersQuery.error ||
    metricsQuery.error ||
    lqsQuery.error ||
    objectionsQuery.error ||
    targetsQuery.error ||
    settingsQuery.error;

  return {
    data: result,
    isLoading,
    error,
    refetch: () => {
      teamMembersQuery.refetch();
      metricsQuery.refetch();
      lqsQuery.refetch();
      objectionsQuery.refetch();
      targetsQuery.refetch();
      settingsQuery.refetch();
    },
  };
}
