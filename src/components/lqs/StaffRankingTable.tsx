import { useState, useMemo } from 'react';
import { ArrowUpDown, ChevronUp, ChevronDown, Trophy } from 'lucide-react';
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
import type { ProducerBreakdownData, ProducerMetrics } from '@/hooks/useLqsProducerBreakdown';
import type { ProducerViewMode } from '@/hooks/useLqsProducerDetail';

type SortKey =
  | 'teamMemberName'
  | 'soldPremiumCents'
  | 'quotedPremiumCents'
  | 'soldHouseholds'
  | 'quotedHouseholds'
  | 'soldItems'
  | 'soldPolicies'
  | 'closeRatio'
  | 'bundleRatio';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatPercent(value: number | null): string {
  if (value === null) return '-';
  return `${value.toFixed(1)}%`;
}

function getSortValue(row: ProducerMetrics, key: SortKey): number | string {
  switch (key) {
    case 'teamMemberName':
      return row.teamMemberName.toLowerCase();
    case 'soldPremiumCents':
      return row.soldPremiumCents;
    case 'quotedPremiumCents':
      return row.quotedPremiumCents;
    case 'soldHouseholds':
      return row.soldHouseholds;
    case 'quotedHouseholds':
      return row.quotedHouseholds;
    case 'soldItems':
      return row.soldItems;
    case 'soldPolicies':
      return row.soldPolicies;
    case 'closeRatio':
      return row.closeRatio ?? -1;
    case 'bundleRatio':
      return row.bundleRatio ?? -1;
  }
}

function SortableHeader({
  label,
  sortKey,
  currentSortKey,
  sortAsc,
  onClick,
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentSortKey: SortKey;
  sortAsc: boolean;
  onClick: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = currentSortKey === sortKey;
  return (
    <TableHead
      className={cn('cursor-pointer hover:bg-muted/50 select-none', className)}
      onClick={() => onClick(sortKey)}
    >
      <div className="flex items-center gap-1 justify-end">
        {label}
        {isActive ? (
          sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </div>
    </TableHead>
  );
}

const RANK_STYLES: Record<number, string> = {
  1: 'bg-yellow-500/15 border-l-2 border-l-yellow-500',
  2: 'bg-gray-300/10 border-l-2 border-l-gray-400',
  3: 'bg-amber-700/10 border-l-2 border-l-amber-700',
};

interface StaffRankingTableProps {
  data: ProducerBreakdownData | null;
  isLoading: boolean;
  onProducerClick?: (teamMemberId: string | null, viewMode: ProducerViewMode) => void;
}

export function StaffRankingTable({ data, isLoading, onProducerClick }: StaffRankingTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('soldPremiumCents');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === 'teamMemberName');
    }
  };

  // Merge quotedBy and soldBy into a single row per team member
  const mergedRows = useMemo(() => {
    if (!data) return [];

    const map = new Map<string | null, ProducerMetrics>();

    // Start with soldBy data (has sold metrics)
    data.bySoldBy.forEach(p => {
      map.set(p.teamMemberId, { ...p });
    });

    // Merge in quotedBy data
    data.byQuotedBy.forEach(p => {
      const existing = map.get(p.teamMemberId);
      if (existing) {
        existing.quotedHouseholds = p.quotedHouseholds;
        existing.quotedPolicies = p.quotedPolicies;
        existing.quotedItems = p.quotedItems;
        existing.quotedPremiumCents = p.quotedPremiumCents;
        existing.closeRatio = p.quotedHouseholds > 0
          ? (existing.soldHouseholds / p.quotedHouseholds) * 100
          : null;
      } else {
        map.set(p.teamMemberId, { ...p });
      }
    });

    return Array.from(map.values());
  }, [data]);

  const sortedRows = useMemo(() => {
    return [...mergedRows].sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [mergedRows, sortKey, sortAsc]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Producer Rankings
          </CardTitle>
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
          <Trophy className="h-5 w-5" />
          Producer Rankings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <SortableHeader
                  label="Agent"
                  sortKey="teamMemberName"
                  currentSortKey={sortKey}
                  sortAsc={sortAsc}
                  onClick={handleSort}
                  className="text-left"
                />
                <SortableHeader
                  label="Sold Premium"
                  sortKey="soldPremiumCents"
                  currentSortKey={sortKey}
                  sortAsc={sortAsc}
                  onClick={handleSort}
                />
                <SortableHeader
                  label="Quoted Premium"
                  sortKey="quotedPremiumCents"
                  currentSortKey={sortKey}
                  sortAsc={sortAsc}
                  onClick={handleSort}
                />
                <SortableHeader
                  label="Sold HH"
                  sortKey="soldHouseholds"
                  currentSortKey={sortKey}
                  sortAsc={sortAsc}
                  onClick={handleSort}
                />
                <SortableHeader
                  label="Quoted HH"
                  sortKey="quotedHouseholds"
                  currentSortKey={sortKey}
                  sortAsc={sortAsc}
                  onClick={handleSort}
                />
                <SortableHeader
                  label="Items Sold"
                  sortKey="soldItems"
                  currentSortKey={sortKey}
                  sortAsc={sortAsc}
                  onClick={handleSort}
                />
                <SortableHeader
                  label="Policies Sold"
                  sortKey="soldPolicies"
                  currentSortKey={sortKey}
                  sortAsc={sortAsc}
                  onClick={handleSort}
                />
                <SortableHeader
                  label="Close %"
                  sortKey="closeRatio"
                  currentSortKey={sortKey}
                  sortAsc={sortAsc}
                  onClick={handleSort}
                />
                <SortableHeader
                  label="Bundle %"
                  sortKey="bundleRatio"
                  currentSortKey={sortKey}
                  sortAsc={sortAsc}
                  onClick={handleSort}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No producer data available
                  </TableCell>
                </TableRow>
              ) : (
                sortedRows.map((row, index) => {
                  const rank = index + 1;
                  return (
                    <TableRow
                      key={row.teamMemberId ?? 'unknown'}
                      className={cn(
                        'cursor-pointer hover:bg-muted/50 transition-colors',
                        RANK_STYLES[rank]
                      )}
                      onClick={() => onProducerClick?.(row.teamMemberId, 'soldBy')}
                    >
                      <TableCell className="font-medium">{rank}</TableCell>
                      <TableCell className="font-medium">{row.teamMemberName}</TableCell>
                      <TableCell className="text-right font-medium text-green-500">
                        {formatCurrency(row.soldPremiumCents)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.quotedPremiumCents)}
                      </TableCell>
                      <TableCell className="text-right">{row.soldHouseholds}</TableCell>
                      <TableCell className="text-right">{row.quotedHouseholds}</TableCell>
                      <TableCell className="text-right">{row.soldItems}</TableCell>
                      <TableCell className="text-right">{row.soldPolicies}</TableCell>
                      <TableCell className="text-right">{formatPercent(row.closeRatio)}</TableCell>
                      <TableCell className="text-right">{formatPercent(row.bundleRatio)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
