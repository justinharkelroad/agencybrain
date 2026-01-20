import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { LeadSourceRoiRow } from '@/hooks/useLqsRoiAnalytics';

interface LqsRoiBucketTableProps {
  data: LeadSourceRoiRow[];
  isLoading: boolean;
  onLeadSourceClick?: (leadSourceId: string | null) => void;
}

// Format currency from cents
function formatCurrency(cents: number | null): string {
  if (cents === null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

// Format percentage
function formatPercent(value: number | null): string {
  if (value === null) return '-';
  return `${value.toFixed(1)}%`;
}

// Format ROI
function formatRoi(value: number | null): string {
  if (value === null) return '-';
  return `${value.toFixed(2)}x`;
}

// Bucket data structure
interface BucketData {
  bucketId: string | null;
  bucketName: string;
  sources: LeadSourceRoiRow[];
  // Aggregated metrics
  spendCents: number;
  quotedHouseholds: number;
  quotedPolicies: number;
  quotedItems: number;
  writtenHouseholds: number;
  writtenPolicies: number;
  writtenItems: number;
  premiumCents: number;
  // Calculated costs
  costPerQuotedHH: number | null;
  costPerQuotedPolicy: number | null;
  costPerQuotedItem: number | null;
  householdAcqCost: number | null;
  policyAcqCost: number | null;
  itemAcqCost: number | null;
}

export function LqsRoiBucketTable({ data, isLoading, onLeadSourceClick }: LqsRoiBucketTableProps) {
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string | null>>(new Set());
  const [sortField, setSortField] = useState<string>('premiumCents');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Group data by bucket
  const groupedData = useMemo(() => {
    const bucketMap = new Map<string | null, LeadSourceRoiRow[]>();

    // Group sources by bucket
    data.forEach(source => {
      const bucketId = source.bucketId;
      if (!bucketMap.has(bucketId)) {
        bucketMap.set(bucketId, []);
      }
      bucketMap.get(bucketId)!.push(source);
    });

    // Build bucket data with aggregated metrics
    const buckets: BucketData[] = [];

    bucketMap.forEach((sources, bucketId) => {
      const bucketName = sources[0]?.bucketName || (bucketId === null ? 'Unassigned' : 'Unknown');

      // Aggregate metrics
      const spendCents = sources.reduce((sum, s) => sum + s.spendCents, 0);
      const quotedHouseholds = sources.reduce((sum, s) => sum + s.totalQuotes, 0);
      const quotedPolicies = sources.reduce((sum, s) => sum + s.quotedPolicies, 0);
      const quotedItems = sources.reduce((sum, s) => sum + s.quotedItems, 0);
      const writtenHouseholds = sources.reduce((sum, s) => sum + s.totalSales, 0);
      const writtenPolicies = sources.reduce((sum, s) => sum + s.writtenPolicies, 0);
      const writtenItems = sources.reduce((sum, s) => sum + s.writtenItems, 0);
      const premiumCents = sources.reduce((sum, s) => sum + s.premiumCents, 0);

      // Calculate cost metrics for bucket
      const costPerQuotedHH = quotedHouseholds > 0 ? spendCents / quotedHouseholds : null;
      const costPerQuotedPolicy = quotedPolicies > 0 ? spendCents / quotedPolicies : null;
      const costPerQuotedItem = quotedItems > 0 ? spendCents / quotedItems : null;
      const householdAcqCost = writtenHouseholds > 0 ? spendCents / writtenHouseholds : null;
      const policyAcqCost = writtenPolicies > 0 ? spendCents / writtenPolicies : null;
      const itemAcqCost = writtenItems > 0 ? spendCents / writtenItems : null;

      buckets.push({
        bucketId,
        bucketName,
        sources: sources.sort((a, b) => b.premiumCents - a.premiumCents),
        spendCents,
        quotedHouseholds,
        quotedPolicies,
        quotedItems,
        writtenHouseholds,
        writtenPolicies,
        writtenItems,
        premiumCents,
        costPerQuotedHH,
        costPerQuotedPolicy,
        costPerQuotedItem,
        householdAcqCost,
        policyAcqCost,
        itemAcqCost,
      });
    });

    // Sort buckets: Unassigned at bottom, others by premium
    return buckets.sort((a, b) => {
      if (a.bucketId === null) return 1;
      if (b.bucketId === null) return -1;
      return b.premiumCents - a.premiumCents;
    });
  }, [data]);

  const toggleBucket = (bucketId: string | null) => {
    setExpandedBuckets(prev => {
      const next = new Set(prev);
      const key = bucketId ?? '__null__';
      if (next.has(key as string | null)) {
        next.delete(key as string | null);
      } else {
        next.add(key as string | null);
      }
      return next;
    });
  };

  const isBucketExpanded = (bucketId: string | null) => {
    const key = bucketId ?? '__null__';
    return expandedBuckets.has(key as string | null);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Marketing ROI by Bucket</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Marketing ROI by Bucket
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[200px]">Marketing Bucket</TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('spendCents')}>
                  Spend {sortField === 'spendCents' && (sortDir === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead className="text-right">Quoted HH</TableHead>
                <TableHead className="text-right">Quoted Policies</TableHead>
                <TableHead className="text-right">Quoted Items</TableHead>
                <TableHead className="text-right">Written HH</TableHead>
                <TableHead className="text-right">Written Policies</TableHead>
                <TableHead className="text-right">Written Items</TableHead>
                <TableHead className="text-right">Cost/Quoted HH</TableHead>
                <TableHead className="text-right">Cost/Quoted Policy</TableHead>
                <TableHead className="text-right">Cost/Quoted Item</TableHead>
                <TableHead className="text-right">HH Acq. Cost</TableHead>
                <TableHead className="text-right">Policy Acq. Cost</TableHead>
                <TableHead className="text-right">Item Acq. Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
                    No data available
                  </TableCell>
                </TableRow>
              ) : (
                groupedData.map((bucket) => (
                  <>
                    {/* Bucket Row */}
                    <TableRow
                      key={bucket.bucketId ?? 'unassigned'}
                      className={cn(
                        'cursor-pointer font-semibold',
                        bucket.bucketId === null
                          ? 'bg-amber-500/10 hover:bg-amber-500/20 border-l-4 border-l-amber-500'
                          : 'bg-muted/50 hover:bg-muted'
                      )}
                      onClick={() => toggleBucket(bucket.bucketId)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {isBucketExpanded(bucket.bucketId) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span>{bucket.bucketName}</span>
                          <span className="text-xs text-muted-foreground">
                            ({bucket.sources.length} sources)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(bucket.spendCents)}</TableCell>
                      <TableCell className="text-right">{bucket.quotedHouseholds.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{bucket.quotedPolicies.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{bucket.quotedItems.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{bucket.writtenHouseholds.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{bucket.writtenPolicies.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{bucket.writtenItems.toLocaleString()}</TableCell>
                      {/* For unassigned, don't show cost calculations */}
                      {bucket.bucketId === null ? (
                        <>
                          <TableCell className="text-right text-muted-foreground">-</TableCell>
                          <TableCell className="text-right text-muted-foreground">-</TableCell>
                          <TableCell className="text-right text-muted-foreground">-</TableCell>
                          <TableCell className="text-right text-muted-foreground">-</TableCell>
                          <TableCell className="text-right text-muted-foreground">-</TableCell>
                          <TableCell className="text-right text-muted-foreground">-</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-right">{formatCurrency(bucket.costPerQuotedHH)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(bucket.costPerQuotedPolicy)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(bucket.costPerQuotedItem)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(bucket.householdAcqCost)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(bucket.policyAcqCost)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(bucket.itemAcqCost)}</TableCell>
                        </>
                      )}
                    </TableRow>

                    {/* Lead Source Rows (expanded) */}
                    {isBucketExpanded(bucket.bucketId) &&
                      bucket.sources.map((source) => (
                        <TableRow
                          key={source.leadSourceId ?? 'unattributed'}
                          className={cn(
                            'hover:bg-muted/30',
                            onLeadSourceClick && 'cursor-pointer'
                          )}
                          onClick={() => onLeadSourceClick?.(source.leadSourceId)}
                        >
                          <TableCell className="pl-10">
                            <span className="text-muted-foreground">{source.leadSourceName}</span>
                            {source.leadSourceId === null && (
                              <span className="ml-2 text-xs text-amber-500">(no source)</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(source.spendCents)}</TableCell>
                          <TableCell className="text-right">{source.totalQuotes.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{source.quotedPolicies.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{source.quotedItems.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{source.totalSales.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{source.writtenPolicies.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{source.writtenItems.toLocaleString()}</TableCell>
                          {/* For unassigned sources, don't show cost calculations */}
                          {bucket.bucketId === null ? (
                            <>
                              <TableCell className="text-right text-muted-foreground">-</TableCell>
                              <TableCell className="text-right text-muted-foreground">-</TableCell>
                              <TableCell className="text-right text-muted-foreground">-</TableCell>
                              <TableCell className="text-right text-muted-foreground">-</TableCell>
                              <TableCell className="text-right text-muted-foreground">-</TableCell>
                              <TableCell className="text-right text-muted-foreground">-</TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="text-right">{formatCurrency(source.costPerQuotedHousehold)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(source.costPerQuotedPolicy)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(source.costPerQuotedItem)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(source.householdAcqCost)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(source.policyAcqCost)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(source.itemAcqCost)}</TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
