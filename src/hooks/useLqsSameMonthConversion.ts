import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';

export interface SameMonthConversionData {
  // Overall metrics
  totalQuotedHouseholds: number;
  sameMonthConvertedHouseholds: number;
  sameMonthConversionRate: number | null;
  sameMonthPremiumCents: number;
  // By bucket breakdown
  byBucket: Array<{
    bucketId: string | null;
    bucketName: string;
    quotedHouseholds: number;
    sameMonthConverted: number;
    sameMonthConversionRate: number | null;
    sameMonthPremiumCents: number;
  }>;
  // Monthly breakdown
  byMonth: Array<{
    month: string; // YYYY-MM
    quotedHouseholds: number;
    sameMonthConverted: number;
    sameMonthConversionRate: number | null;
    sameMonthPremiumCents: number;
  }>;
}

interface HouseholdWithDates {
  id: string;
  lead_source_id: string | null;
  first_quote_date: string | null;
  sold_date: string | null;
  quotes: Array<{ quote_date: string | null }>;
  sales: Array<{ sale_date: string | null; premium_cents: number | null }>;
}

interface LeadSourceWithBucket {
  id: string;
  bucket_id: string | null;
}

interface MarketingBucket {
  id: string;
  name: string;
}

const PAGE_SIZE = 1000;
const MAX_FETCH = 20000;

export function useLqsSameMonthConversion(
  agencyId: string | null,
  dateRange: { start: Date; end: Date } | null,
  selectedBucketIds: (string | null)[] | null // null = all buckets, array = filter to these
) {
  // Fetch marketing buckets
  const bucketsQuery = useQuery({
    queryKey: ['lqs-smc-buckets', agencyId],
    enabled: !!agencyId,
    queryFn: async (): Promise<MarketingBucket[]> => {
      const { data, error } = await supabase
        .from('marketing_buckets')
        .select('id, name')
        .eq('agency_id', agencyId!)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch lead sources with bucket mapping
  const leadSourcesQuery = useQuery({
    queryKey: ['lqs-smc-lead-sources', agencyId],
    enabled: !!agencyId,
    queryFn: async (): Promise<LeadSourceWithBucket[]> => {
      const { data, error } = await supabase
        .from('lead_sources')
        .select('id, bucket_id')
        .eq('agency_id', agencyId!);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch households with quote and sale dates
  const householdsQuery = useQuery({
    queryKey: ['lqs-smc-households', agencyId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    enabled: !!agencyId,
    queryFn: async (): Promise<HouseholdWithDates[]> => {
      const allRows: HouseholdWithDates[] = [];

      for (let from = 0; from < MAX_FETCH; from += PAGE_SIZE) {
        let query = supabase
          .from('lqs_households')
          .select(`
            id,
            lead_source_id,
            first_quote_date,
            sold_date,
            quotes:lqs_quotes(quote_date),
            sales:lqs_sales(sale_date, premium_cents)
          `)
          .eq('agency_id', agencyId!)
          .not('first_quote_date', 'is', null); // Only households that have been quoted

        // Date filter based on first_quote_date
        if (dateRange) {
          const startStr = format(dateRange.start, 'yyyy-MM-dd');
          const endStr = format(dateRange.end, 'yyyy-MM-dd');
          query = query
            .gte('first_quote_date', startStr)
            .lte('first_quote_date', endStr);
        }

        const { data: page, error } = await query.range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!page || page.length === 0) break;

        allRows.push(...(page as HouseholdWithDates[]));
        if (page.length < PAGE_SIZE) break;
      }

      return allRows;
    },
  });

  // Process data
  const data = useMemo<SameMonthConversionData | null>(() => {
    const buckets = bucketsQuery.data;
    const leadSources = leadSourcesQuery.data;
    const households = householdsQuery.data;

    if (!buckets || !leadSources || !households) return null;

    // Build lookup maps
    const bucketNameMap = new Map(buckets.map(b => [b.id, b.name]));
    const leadSourceBucketMap = new Map(leadSources.map(ls => [ls.id, ls.bucket_id]));

    // Filter households by selected buckets
    const filteredHouseholds = households.filter(h => {
      if (selectedBucketIds === null) return true; // Show all
      const bucketId = h.lead_source_id ? leadSourceBucketMap.get(h.lead_source_id) ?? null : null;
      return selectedBucketIds.includes(bucketId);
    });

    // Aggregate by bucket
    interface BucketMetrics {
      quotedHouseholds: number;
      sameMonthConverted: number;
      sameMonthPremiumCents: number;
    }
    const byBucketMap = new Map<string | null, BucketMetrics>();

    // Aggregate by month
    interface MonthMetrics {
      quotedHouseholds: number;
      sameMonthConverted: number;
      sameMonthPremiumCents: number;
    }
    const byMonthMap = new Map<string, MonthMetrics>();

    // Helper to check if sale happened same month as first quote
    const isSameMonthConversion = (h: HouseholdWithDates): boolean => {
      if (!h.first_quote_date || !h.sold_date) return false;
      const quoteDate = new Date(h.first_quote_date);
      const saleDate = new Date(h.sold_date);
      return isSameMonth(quoteDate, saleDate);
    };

    // Get premium for same-month sales
    const getSameMonthPremium = (h: HouseholdWithDates): number => {
      if (!h.first_quote_date) return 0;
      const quoteDate = new Date(h.first_quote_date);

      // Sum premium from sales that happened in the same month as the first quote
      return h.sales
        .filter(s => s.sale_date && isSameMonth(new Date(s.sale_date), quoteDate))
        .reduce((sum, s) => sum + (s.premium_cents || 0), 0);
    };

    let totalQuotedHouseholds = 0;
    let sameMonthConvertedHouseholds = 0;
    let sameMonthPremiumCents = 0;

    filteredHouseholds.forEach(h => {
      const bucketId = h.lead_source_id ? leadSourceBucketMap.get(h.lead_source_id) ?? null : null;
      const quoteMonth = h.first_quote_date ? format(new Date(h.first_quote_date), 'yyyy-MM') : null;
      const isSameMo = isSameMonthConversion(h);
      const sameMoPremium = getSameMonthPremium(h);

      totalQuotedHouseholds++;
      if (isSameMo) {
        sameMonthConvertedHouseholds++;
        sameMonthPremiumCents += sameMoPremium;
      }

      // Update bucket metrics
      if (!byBucketMap.has(bucketId)) {
        byBucketMap.set(bucketId, {
          quotedHouseholds: 0,
          sameMonthConverted: 0,
          sameMonthPremiumCents: 0,
        });
      }
      const bucketMetrics = byBucketMap.get(bucketId)!;
      bucketMetrics.quotedHouseholds++;
      if (isSameMo) {
        bucketMetrics.sameMonthConverted++;
        bucketMetrics.sameMonthPremiumCents += sameMoPremium;
      }

      // Update month metrics
      if (quoteMonth) {
        if (!byMonthMap.has(quoteMonth)) {
          byMonthMap.set(quoteMonth, {
            quotedHouseholds: 0,
            sameMonthConverted: 0,
            sameMonthPremiumCents: 0,
          });
        }
        const monthMetrics = byMonthMap.get(quoteMonth)!;
        monthMetrics.quotedHouseholds++;
        if (isSameMo) {
          monthMetrics.sameMonthConverted++;
          monthMetrics.sameMonthPremiumCents += sameMoPremium;
        }
      }
    });

    // Build byBucket array
    const byBucket = Array.from(byBucketMap.entries()).map(([bucketId, metrics]) => ({
      bucketId,
      bucketName: bucketId ? (bucketNameMap.get(bucketId) || 'Unknown') : 'Unassigned',
      quotedHouseholds: metrics.quotedHouseholds,
      sameMonthConverted: metrics.sameMonthConverted,
      sameMonthConversionRate: metrics.quotedHouseholds > 0
        ? (metrics.sameMonthConverted / metrics.quotedHouseholds) * 100
        : null,
      sameMonthPremiumCents: metrics.sameMonthPremiumCents,
    })).sort((a, b) => b.sameMonthConverted - a.sameMonthConverted);

    // Build byMonth array
    const byMonth = Array.from(byMonthMap.entries())
      .map(([month, metrics]) => ({
        month,
        quotedHouseholds: metrics.quotedHouseholds,
        sameMonthConverted: metrics.sameMonthConverted,
        sameMonthConversionRate: metrics.quotedHouseholds > 0
          ? (metrics.sameMonthConverted / metrics.quotedHouseholds) * 100
          : null,
        sameMonthPremiumCents: metrics.sameMonthPremiumCents,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      totalQuotedHouseholds,
      sameMonthConvertedHouseholds,
      sameMonthConversionRate: totalQuotedHouseholds > 0
        ? (sameMonthConvertedHouseholds / totalQuotedHouseholds) * 100
        : null,
      sameMonthPremiumCents,
      byBucket,
      byMonth,
    };
  }, [bucketsQuery.data, leadSourcesQuery.data, householdsQuery.data, selectedBucketIds]);

  const isLoading = bucketsQuery.isLoading || leadSourcesQuery.isLoading || householdsQuery.isLoading;
  const error = bucketsQuery.error || leadSourcesQuery.error || householdsQuery.error;

  // Return available buckets for the filter
  const availableBuckets = useMemo(() => {
    const buckets = bucketsQuery.data || [];
    return [
      { id: null, name: 'Unassigned' },
      ...buckets.map(b => ({ id: b.id as string | null, name: b.name })),
    ];
  }, [bucketsQuery.data]);

  return {
    data,
    isLoading,
    error,
    availableBuckets,
  };
}
