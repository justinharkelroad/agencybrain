import { useState } from 'react';
import { Zap, TrendingUp, Filter, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useLqsSameMonthConversion, SameMonthConversionData } from '@/hooks/useLqsSameMonthConversion';

interface LqsSameMonthConversionProps {
  agencyId: string | null;
  dateRange: { start: Date; end: Date } | null;
}

// Format currency from cents
function formatCurrency(cents: number): string {
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

export function LqsSameMonthConversion({ agencyId, dateRange }: LqsSameMonthConversionProps) {
  const [selectedBuckets, setSelectedBuckets] = useState<(string | null)[] | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const { data, isLoading, availableBuckets } = useLqsSameMonthConversion(
    agencyId,
    dateRange,
    selectedBuckets
  );

  const handleBucketToggle = (bucketId: string | null) => {
    setSelectedBuckets(prev => {
      if (prev === null) {
        // First selection - start with just this one
        return [bucketId];
      }
      if (prev.includes(bucketId)) {
        // Remove it
        const next = prev.filter(id => id !== bucketId);
        return next.length === 0 ? null : next;
      } else {
        // Add it
        return [...prev, bucketId];
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedBuckets(null);
  };

  const handleClearAll = () => {
    setSelectedBuckets([]);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Same-Month Conversion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Same-Month Conversion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Same-Month Conversion
          </CardTitle>

          {/* Bucket Filter */}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                {selectedBuckets === null
                  ? 'All Buckets'
                  : selectedBuckets.length === 0
                  ? 'None Selected'
                  : `${selectedBuckets.length} bucket${selectedBuckets.length > 1 ? 's' : ''}`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Filter by Bucket</h4>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={handleSelectAll} className="h-7 text-xs">
                      All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleClearAll} className="h-7 text-xs">
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availableBuckets.map(bucket => {
                    const isSelected = selectedBuckets === null || selectedBuckets.includes(bucket.id);
                    return (
                      <div
                        key={bucket.id ?? 'unassigned'}
                        className="flex items-center gap-2"
                      >
                        <Checkbox
                          id={bucket.id ?? 'unassigned'}
                          checked={isSelected}
                          onCheckedChange={() => handleBucketToggle(bucket.id)}
                        />
                        <Label
                          htmlFor={bucket.id ?? 'unassigned'}
                          className={cn(
                            'text-sm cursor-pointer flex-1',
                            bucket.id === null && 'text-amber-500'
                          )}
                        >
                          {bucket.name}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="text-2xl font-bold text-amber-500">
              {data.totalQuotedHouseholds.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Quoted HH</div>
          </div>
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="text-2xl font-bold text-green-500">
              {data.sameMonthConvertedHouseholds.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Same-Mo Converted</div>
          </div>
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="text-2xl font-bold">
              {formatPercent(data.sameMonthConversionRate)}
            </div>
            <div className="text-xs text-muted-foreground">Conversion Rate</div>
          </div>
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="text-2xl font-bold text-green-500">
              {formatCurrency(data.sameMonthPremiumCents)}
            </div>
            <div className="text-xs text-muted-foreground">Same-Mo Premium</div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground">
          Shows households that were both quoted and closed within the same calendar month.
          This is a key indicator of sales velocity and hot lead conversion.
        </p>

        {/* By Bucket Table */}
        <div>
          <h4 className="text-sm font-medium mb-2">By Marketing Bucket</h4>
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Bucket</TableHead>
                  <TableHead className="text-right">Quoted HH</TableHead>
                  <TableHead className="text-right">Same-Mo Converted</TableHead>
                  <TableHead className="text-right">Conv. Rate</TableHead>
                  <TableHead className="text-right">Same-Mo Premium</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byBucket.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                      No data for selected buckets
                    </TableCell>
                  </TableRow>
                ) : (
                  data.byBucket.map(row => (
                    <TableRow
                      key={row.bucketId ?? 'unassigned'}
                      className={cn(
                        row.bucketId === null && 'bg-amber-500/5'
                      )}
                    >
                      <TableCell className="font-medium">
                        {row.bucketName}
                        {row.bucketId === null && (
                          <span className="ml-2 text-xs text-amber-500">(no bucket)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{row.quotedHouseholds.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-500 font-medium">
                        {row.sameMonthConverted.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={cn(
                            row.sameMonthConversionRate !== null && row.sameMonthConversionRate >= 20
                              ? 'border-green-500/30 text-green-500'
                              : row.sameMonthConversionRate !== null && row.sameMonthConversionRate >= 10
                              ? 'border-amber-500/30 text-amber-500'
                              : ''
                          )}
                        >
                          {formatPercent(row.sameMonthConversionRate)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-green-500">
                        {formatCurrency(row.sameMonthPremiumCents)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Monthly Trend */}
        {data.byMonth.length > 1 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Monthly Trend</h4>
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Quoted HH</TableHead>
                    <TableHead className="text-right">Same-Mo Converted</TableHead>
                    <TableHead className="text-right">Conv. Rate</TableHead>
                    <TableHead className="text-right">Same-Mo Premium</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byMonth.map(row => (
                    <TableRow key={row.month}>
                      <TableCell className="font-medium">{row.month}</TableCell>
                      <TableCell className="text-right">{row.quotedHouseholds.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-500 font-medium">
                        {row.sameMonthConverted.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPercent(row.sameMonthConversionRate)}
                      </TableCell>
                      <TableCell className="text-right text-green-500">
                        {formatCurrency(row.sameMonthPremiumCents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
