import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';

export interface MonthlyPerformanceData {
  month: string; // YYYY-MM format
  monthLabel: string; // "Jan 2024" format
  leadsReceived: number;
  quotedHouseholds: number;
  soldHouseholds: number;
  premiumCents: number;
  spendCents: number;
  roi: number | null;
  closeRate: number | null;
}

export interface BucketTrendData {
  bucketId: string | null;
  bucketName: string;
  monthlyData: MonthlyPerformanceData[];
}

const MONTHS_TO_FETCH = 12;

export function useLqsPerformanceTrend(agencyId: string | null) {
  // Calculate date range for last 12 months
  const dateRange = useMemo(() => {
    const end = endOfMonth(new Date());
    const start = startOfMonth(subMonths(end, MONTHS_TO_FETCH - 1));
    return { start, end };
  }, []);

  // Fetch leads received by month
  const leadsQuery = useQuery({
    queryKey: ['lqs-trend-leads', agencyId],
    enabled: !!agencyId,
    staleTime: 60000,
    queryFn: async () => {
      const startStr = format(dateRange.start, 'yyyy-MM-dd');
      const endStr = format(dateRange.end, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('lqs_households')
        .select('id, lead_source_id, lead_received_date')
        .eq('agency_id', agencyId!)
        .gte('lead_received_date', startStr)
        .lte('lead_received_date', endStr);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch quotes by month
  const quotesQuery = useQuery({
    queryKey: ['lqs-trend-quotes', agencyId],
    enabled: !!agencyId,
    staleTime: 60000,
    queryFn: async () => {
      const startStr = format(dateRange.start, 'yyyy-MM-dd');
      const endStr = format(dateRange.end, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('lqs_quotes')
        .select('household_id, quote_date, household:lqs_households!inner(lead_source_id)')
        .eq('agency_id', agencyId!)
        .gte('quote_date', startStr)
        .lte('quote_date', endStr);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch sales by month
  const salesQuery = useQuery({
    queryKey: ['lqs-trend-sales', agencyId],
    enabled: !!agencyId,
    staleTime: 60000,
    queryFn: async () => {
      const startStr = format(dateRange.start, 'yyyy-MM-dd');
      const endStr = format(dateRange.end, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('lqs_sales')
        .select('household_id, sale_date, premium_cents, household:lqs_households!inner(lead_source_id)')
        .eq('agency_id', agencyId!)
        .gte('sale_date', startStr)
        .lte('sale_date', endStr);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch monthly spend
  const spendQuery = useQuery({
    queryKey: ['lqs-trend-spend', agencyId],
    enabled: !!agencyId,
    staleTime: 60000,
    queryFn: async () => {
      const startMonth = format(dateRange.start, 'yyyy-MM-dd');
      const endMonth = format(dateRange.end, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('lead_source_monthly_spend')
        .select('lead_source_id, total_spend_cents, month')
        .eq('agency_id', agencyId!)
        .gte('month', startMonth)
        .lte('month', endMonth);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch lead sources with buckets
  const leadSourcesQuery = useQuery({
    queryKey: ['lqs-trend-lead-sources', agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_sources')
        .select('id, name, bucket_id')
        .eq('agency_id', agencyId!);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch buckets
  const bucketsQuery = useQuery({
    queryKey: ['lqs-trend-buckets', agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_buckets')
        .select('id, name')
        .eq('agency_id', agencyId!)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch agency commission rate
  const agencyQuery = useQuery({
    queryKey: ['agency-commission-rate', agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agencies')
        .select('default_commission_rate')
        .eq('id', agencyId!)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Aggregate data by month and bucket
  const trendData = useMemo(() => {
    const leads = leadsQuery.data;
    const quotes = quotesQuery.data;
    const sales = salesQuery.data;
    const spend = spendQuery.data;
    const leadSources = leadSourcesQuery.data;
    const buckets = bucketsQuery.data;
    const commissionRate = agencyQuery.data?.default_commission_rate ?? 22;

    if (!leads || !quotes || !sales || !spend || !leadSources || !buckets) {
      return null;
    }

    // Create lead source to bucket mapping
    const sourceToucket = new Map(leadSources.map((ls) => [ls.id, ls.bucket_id]));
    const bucketNames = new Map(buckets.map((b) => [b.id, b.name]));

    // Generate month keys for last 12 months
    const months: string[] = [];
    for (let i = MONTHS_TO_FETCH - 1; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      months.push(format(monthDate, 'yyyy-MM'));
    }

    // Initialize aggregation by bucket and month
    type MonthMetrics = {
      leads: number;
      quotedHouseholdIds: Set<string>;
      soldHouseholdIds: Set<string>;
      premiumCents: number;
      spendCents: number;
    };

    const bucketMonthlyMetrics = new Map<string | null, Map<string, MonthMetrics>>();

    // Initialize all buckets with empty months
    const initBucket = (bucketId: string | null) => {
      if (!bucketMonthlyMetrics.has(bucketId)) {
        const monthMap = new Map<string, MonthMetrics>();
        months.forEach((m) => {
          monthMap.set(m, {
            leads: 0,
            quotedHouseholdIds: new Set(),
            soldHouseholdIds: new Set(),
            premiumCents: 0,
            spendCents: 0,
          });
        });
        bucketMonthlyMetrics.set(bucketId, monthMap);
      }
      return bucketMonthlyMetrics.get(bucketId)!;
    };

    // Also track overall (all buckets combined)
    initBucket('__all__');

    // Process leads
    leads.forEach((lead) => {
      if (!lead.lead_received_date) return;
      const month = lead.lead_received_date.substring(0, 7);
      const bucketId = lead.lead_source_id ? sourceToucket.get(lead.lead_source_id) ?? null : null;

      const bucketMetrics = initBucket(bucketId);
      const metrics = bucketMetrics.get(month);
      if (metrics) {
        metrics.leads++;
      }

      // Also add to overall
      const allMetrics = bucketMonthlyMetrics.get('__all__')!.get(month);
      if (allMetrics) {
        allMetrics.leads++;
      }
    });

    // Process quotes
    quotes.forEach((quote) => {
      if (!quote.quote_date) return;
      const month = quote.quote_date.substring(0, 7);
      const leadSourceId = (quote.household as { lead_source_id: string | null } | null)?.lead_source_id ?? null;
      const bucketId = leadSourceId ? sourceToucket.get(leadSourceId) ?? null : null;

      const bucketMetrics = initBucket(bucketId);
      const metrics = bucketMetrics.get(month);
      if (metrics) {
        metrics.quotedHouseholdIds.add(quote.household_id);
      }

      // Also add to overall
      const allMetrics = bucketMonthlyMetrics.get('__all__')!.get(month);
      if (allMetrics) {
        allMetrics.quotedHouseholdIds.add(quote.household_id);
      }
    });

    // Process sales
    sales.forEach((sale) => {
      if (!sale.sale_date) return;
      const month = sale.sale_date.substring(0, 7);
      const leadSourceId = (sale.household as { lead_source_id: string | null } | null)?.lead_source_id ?? null;
      const bucketId = leadSourceId ? sourceToucket.get(leadSourceId) ?? null : null;

      const bucketMetrics = initBucket(bucketId);
      const metrics = bucketMetrics.get(month);
      if (metrics) {
        metrics.soldHouseholdIds.add(sale.household_id);
        metrics.premiumCents += sale.premium_cents || 0;
      }

      // Also add to overall
      const allMetrics = bucketMonthlyMetrics.get('__all__')!.get(month);
      if (allMetrics) {
        allMetrics.soldHouseholdIds.add(sale.household_id);
        allMetrics.premiumCents += sale.premium_cents || 0;
      }
    });

    // Process spend
    spend.forEach((s) => {
      if (!s.month) return;
      const month = s.month.substring(0, 7);
      const bucketId = s.lead_source_id ? sourceToucket.get(s.lead_source_id) ?? null : null;

      const bucketMetrics = initBucket(bucketId);
      const metrics = bucketMetrics.get(month);
      if (metrics) {
        metrics.spendCents += s.total_spend_cents || 0;
      }

      // Also add to overall
      const allMetrics = bucketMonthlyMetrics.get('__all__')!.get(month);
      if (allMetrics) {
        allMetrics.spendCents += s.total_spend_cents || 0;
      }
    });

    // Convert to output format
    const result: BucketTrendData[] = [];

    bucketMonthlyMetrics.forEach((monthMap, bucketId) => {
      const bucketName =
        bucketId === '__all__'
          ? 'All Sources'
          : bucketId
          ? bucketNames.get(bucketId) || 'Uncategorized'
          : 'Unattributed';

      const monthlyData: MonthlyPerformanceData[] = months.map((month) => {
        const metrics = monthMap.get(month)!;
        const quotedHouseholds = metrics.quotedHouseholdIds.size;
        const soldHouseholds = metrics.soldHouseholdIds.size;
        const commissionEarned = metrics.premiumCents * (commissionRate / 100);
        const roi = metrics.spendCents > 0 ? commissionEarned / metrics.spendCents : null;
        const closeRate = quotedHouseholds > 0 ? (soldHouseholds / quotedHouseholds) * 100 : null;

        // Parse month for label
        const monthDate = parseISO(`${month}-01`);
        const monthLabel = format(monthDate, 'MMM yyyy');

        return {
          month,
          monthLabel,
          leadsReceived: metrics.leads,
          quotedHouseholds,
          soldHouseholds,
          premiumCents: metrics.premiumCents,
          spendCents: metrics.spendCents,
          roi,
          closeRate,
        };
      });

      result.push({
        bucketId: bucketId === '__all__' ? '__all__' : bucketId,
        bucketName,
        monthlyData,
      });
    });

    // Sort: "All Sources" first, then by bucket name
    result.sort((a, b) => {
      if (a.bucketId === '__all__') return -1;
      if (b.bucketId === '__all__') return 1;
      return a.bucketName.localeCompare(b.bucketName);
    });

    return result;
  }, [
    leadsQuery.data,
    quotesQuery.data,
    salesQuery.data,
    spendQuery.data,
    leadSourcesQuery.data,
    bucketsQuery.data,
    agencyQuery.data,
  ]);

  const isLoading =
    leadsQuery.isLoading ||
    quotesQuery.isLoading ||
    salesQuery.isLoading ||
    spendQuery.isLoading ||
    leadSourcesQuery.isLoading ||
    bucketsQuery.isLoading ||
    agencyQuery.isLoading;

  const error =
    leadsQuery.error ||
    quotesQuery.error ||
    salesQuery.error ||
    spendQuery.error ||
    leadSourcesQuery.error ||
    bucketsQuery.error ||
    agencyQuery.error;

  return {
    data: trendData,
    isLoading,
    error,
  };
}
