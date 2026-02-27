import { useState, useMemo } from 'react';
import { ArrowUpDown, ChevronUp, ChevronDown, MapPin, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { ZipRoiRow } from '@/hooks/useLqsRoiAnalytics';

type SortKey =
  | 'zipCode'
  | 'totalLeads'
  | 'totalQuotes'
  | 'totalSales'
  | 'closeRatio'
  | 'premiumCents'
  | 'quotedPolicies'
  | 'writtenPolicies'
  | 'writtenItems'
  | 'costPerSale'
  | 'roi';

function formatCurrency(cents: number | null): string {
  if (cents === null) return '-';
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

function formatRoi(value: number | null): string {
  if (value === null) return '-';
  return `${value.toFixed(2)}x`;
}

function getSortValue(row: ZipRoiRow, key: SortKey): number | string {
  switch (key) {
    case 'zipCode':
      return row.zipCode;
    case 'totalLeads':
      return row.totalLeads;
    case 'totalQuotes':
      return row.totalQuotes;
    case 'totalSales':
      return row.totalSales;
    case 'closeRatio':
      return row.closeRatio ?? -1;
    case 'premiumCents':
      return row.premiumCents;
    case 'quotedPolicies':
      return row.quotedPolicies;
    case 'writtenPolicies':
      return row.writtenPolicies;
    case 'writtenItems':
      return row.writtenItems;
    case 'costPerSale':
      return row.costPerSale ?? Infinity;
    case 'roi':
      return row.roi ?? -1;
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

const PAGE_SIZE = 10;

interface ZipCodePerformanceTableProps {
  data: ZipRoiRow[];
  isLoading: boolean;
}

export function ZipCodePerformanceTable({ data, isLoading }: ZipCodePerformanceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('premiumCents');
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState('');
  const [minQuotes, setMinQuotes] = useState(5);
  const [page, setPage] = useState(0);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === 'zipCode');
    }
    setPage(0);
  };

  const filteredAndSorted = useMemo(() => {
    let filtered = data;

    // Apply min quotes threshold
    if (minQuotes > 0) {
      filtered = filtered.filter(r => r.totalQuotes >= minQuotes);
    }

    // Apply search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(r => r.zipCode.toLowerCase().includes(q));
    }

    // Sort
    return [...filtered].sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [data, sortKey, sortAsc, search, minQuotes]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const pagedRows = filteredAndSorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Zip Code Performance
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
          <MapPin className="h-5 w-5" />
          Zip Code Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search zip code..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 h-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Min quotes:</Label>
            <Input
              type="number"
              min={0}
              value={minQuotes}
              onChange={e => { setMinQuotes(Math.max(0, parseInt(e.target.value) || 0)); setPage(0); }}
              className="w-20 h-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader label="Zip Code" sortKey="zipCode" currentSortKey={sortKey} sortAsc={sortAsc} onClick={handleSort} className="text-left" />
                <SortableHeader label="Leads" sortKey="totalLeads" currentSortKey={sortKey} sortAsc={sortAsc} onClick={handleSort} />
                <SortableHeader label="Quoted HH" sortKey="totalQuotes" currentSortKey={sortKey} sortAsc={sortAsc} onClick={handleSort} />
                <SortableHeader label="Sold HH" sortKey="totalSales" currentSortKey={sortKey} sortAsc={sortAsc} onClick={handleSort} />
                <SortableHeader label="Close %" sortKey="closeRatio" currentSortKey={sortKey} sortAsc={sortAsc} onClick={handleSort} />
                <SortableHeader label="Sold Premium" sortKey="premiumCents" currentSortKey={sortKey} sortAsc={sortAsc} onClick={handleSort} />
                <SortableHeader label="Quoted Policies" sortKey="quotedPolicies" currentSortKey={sortKey} sortAsc={sortAsc} onClick={handleSort} />
                <SortableHeader label="Written Policies" sortKey="writtenPolicies" currentSortKey={sortKey} sortAsc={sortAsc} onClick={handleSort} />
                <SortableHeader label="Items Written" sortKey="writtenItems" currentSortKey={sortKey} sortAsc={sortAsc} onClick={handleSort} />
                <SortableHeader label="Cost/Sale" sortKey="costPerSale" currentSortKey={sortKey} sortAsc={sortAsc} onClick={handleSort} />
                <SortableHeader label="ROI" sortKey="roi" currentSortKey={sortKey} sortAsc={sortAsc} onClick={handleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    No zip codes match your filters
                  </TableCell>
                </TableRow>
              ) : (
                pagedRows.map(row => (
                  <TableRow key={row.zipCode}>
                    <TableCell className="font-medium">{row.zipCode}</TableCell>
                    <TableCell className="text-right">{row.totalLeads}</TableCell>
                    <TableCell className="text-right">{row.totalQuotes}</TableCell>
                    <TableCell className="text-right">{row.totalSales}</TableCell>
                    <TableCell className="text-right">{formatPercent(row.closeRatio)}</TableCell>
                    <TableCell className="text-right font-medium text-green-500">
                      {formatCurrency(row.premiumCents)}
                    </TableCell>
                    <TableCell className="text-right">{row.quotedPolicies}</TableCell>
                    <TableCell className="text-right">{row.writtenPolicies}</TableCell>
                    <TableCell className="text-right">{row.writtenItems}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.costPerSale)}</TableCell>
                    <TableCell className="text-right">
                      <span className={row.roi !== null && row.roi >= 1 ? 'text-green-500' : row.roi !== null ? 'text-amber-500' : ''}>
                        {formatRoi(row.roi)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredAndSorted.length)} of {filteredAndSorted.length} zip codes
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
