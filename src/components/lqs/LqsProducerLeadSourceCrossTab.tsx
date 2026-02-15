import { useState, useMemo } from 'react';
import { Grid3X3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  useLqsProducerLeadSourceCrossTab,
  CrossTabMetric,
  CrossTabCell,
} from '@/hooks/useLqsProducerLeadSourceCrossTab';

interface LqsProducerLeadSourceCrossTabProps {
  agencyId: string | null;
  dateRange: { start: Date; end: Date } | null;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatCellValue(cell: CrossTabCell | undefined, metric: CrossTabMetric): string {
  if (!cell) return '-';
  switch (metric) {
    case 'closeRate':
      return cell.closeRate !== null ? `${cell.closeRate.toFixed(1)}%` : '-';
    case 'premium':
      return cell.premiumCents > 0 ? formatCurrency(cell.premiumCents) : '-';
    case 'soldHH':
      return cell.soldHH > 0 ? cell.soldHH.toLocaleString() : '-';
    default:
      return '-';
  }
}

function getCellBg(cell: CrossTabCell | undefined, metric: CrossTabMetric): string {
  if (!cell) return '';
  if (metric === 'closeRate') {
    if (cell.closeRate === null || cell.quotedHH === 0) return 'bg-muted/5';
    if (cell.closeRate >= 30) return 'bg-green-500/20';
    if (cell.closeRate >= 15) return 'bg-amber-500/10';
    return 'bg-muted/5';
  }
  if (metric === 'premium') {
    if (cell.premiumCents === 0) return 'bg-muted/5';
    if (cell.premiumCents >= 100000) return 'bg-green-500/20'; // >= $1000
    if (cell.premiumCents >= 50000) return 'bg-amber-500/10';
    return 'bg-muted/5';
  }
  if (metric === 'soldHH') {
    if (cell.soldHH === 0) return 'bg-muted/5';
    if (cell.soldHH >= 5) return 'bg-green-500/20';
    if (cell.soldHH >= 2) return 'bg-amber-500/10';
    return 'bg-muted/5';
  }
  return '';
}

export function LqsProducerLeadSourceCrossTab({ agencyId, dateRange }: LqsProducerLeadSourceCrossTabProps) {
  const [aggregateByBucket, setAggregateByBucket] = useState(true);
  const [metric, setMetric] = useState<CrossTabMetric>('closeRate');

  const { buildCrossTab, isLoading } = useLqsProducerLeadSourceCrossTab(agencyId, dateRange);

  const data = useMemo(() => buildCrossTab(aggregateByBucket), [buildCrossTab, aggregateByBucket]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Producer Performance by Lead Source</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5 text-purple-500" />
            Producer Performance by Lead Source
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No quote or sale data available for this period.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5 text-purple-500" />
            Producer Performance by Lead Source
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border overflow-hidden">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 rounded-none border-none',
                  aggregateByBucket && 'bg-muted font-medium'
                )}
                onClick={() => setAggregateByBucket(true)}
              >
                By Bucket
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 rounded-none border-none',
                  !aggregateByBucket && 'bg-muted font-medium'
                )}
                onClick={() => setAggregateByBucket(false)}
              >
                By Source
              </Button>
            </div>
            <Select value={metric} onValueChange={(v) => setMetric(v as CrossTabMetric)}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="closeRate">Close Rate</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="soldHH">Sold HH</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky left-0 bg-background z-10 min-w-[140px]">Producer</TableHead>
                {data.columns.map(col => (
                  <TableHead key={col.id} className="text-center min-w-[100px]">
                    {col.name}
                  </TableHead>
                ))}
                <TableHead className="text-center min-w-[100px] font-bold">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map(row => (
                <TableRow key={row.teamMemberId ?? 'unassigned'}>
                  <TableCell className="sticky left-0 bg-background z-10 font-medium">
                    {row.producerName}
                  </TableCell>
                  {data.columns.map(col => {
                    const cell = row.cells.get(col.id);
                    return (
                      <TableCell
                        key={col.id}
                        className={cn('text-center', getCellBg(cell, metric))}
                      >
                        {formatCellValue(cell, metric)}
                      </TableCell>
                    );
                  })}
                  <TableCell className={cn('text-center font-medium', getCellBg(row.total, metric))}>
                    {formatCellValue(row.total, metric)}
                  </TableCell>
                </TableRow>
              ))}
              {/* Column totals row */}
              <TableRow className="border-t-2 font-medium hover:bg-transparent">
                <TableCell className="sticky left-0 bg-background z-10 font-bold">Total</TableCell>
                {data.columns.map(col => {
                  const cell = data.columnTotals.get(col.id);
                  return (
                    <TableCell
                      key={col.id}
                      className={cn('text-center', getCellBg(cell, metric))}
                    >
                      {formatCellValue(cell, metric)}
                    </TableCell>
                  );
                })}
                <TableCell className={cn('text-center font-bold', getCellBg(data.grandTotal, metric))}>
                  {formatCellValue(data.grandTotal, metric)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
