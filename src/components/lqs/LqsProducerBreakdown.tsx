import { useState } from 'react';
import { Users, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { ProducerMetrics, ProducerBreakdownData } from '@/hooks/useLqsProducerBreakdown';

interface LqsProducerBreakdownProps {
  data: ProducerBreakdownData | null;
  isLoading: boolean;
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

// Producer table for "Quoted By" view
function QuotedByTable({ data }: { data: ProducerMetrics[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No quote data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[200px]">Producer</TableHead>
            <TableHead className="text-right">Quoted HH</TableHead>
            <TableHead className="text-right">Quoted Policies</TableHead>
            <TableHead className="text-right">Quoted Items</TableHead>
            <TableHead className="text-right">Quote Premium</TableHead>
            <TableHead className="text-right">Converted HH</TableHead>
            <TableHead className="text-right">Close Ratio</TableHead>
            <TableHead className="text-right">Bundle Ratio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={row.teamMemberId ?? 'unassigned'}
              className={cn(
                row.teamMemberId === null &&
                  'bg-amber-500/10 hover:bg-amber-500/20 border-l-4 border-l-amber-500'
              )}
            >
              <TableCell className="font-medium">
                {row.teamMemberName}
                {row.teamMemberId === null && (
                  <span className="ml-2 text-xs text-amber-500">(no producer)</span>
                )}
              </TableCell>
              <TableCell className="text-right">{row.quotedHouseholds.toLocaleString()}</TableCell>
              <TableCell className="text-right">{row.quotedPolicies.toLocaleString()}</TableCell>
              <TableCell className="text-right">{row.quotedItems.toLocaleString()}</TableCell>
              <TableCell className="text-right">{formatCurrency(row.quotedPremiumCents)}</TableCell>
              <TableCell className="text-right font-medium text-green-500">
                {row.soldHouseholds.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                <span className={row.closeRatio !== null && row.closeRatio >= 20 ? 'text-green-500' : ''}>
                  {formatPercent(row.closeRatio)}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <span className={row.bundleRatio !== null && row.bundleRatio >= 30 ? 'text-green-500' : ''}>
                  {formatPercent(row.bundleRatio)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Producer table for "Sold By" view
function SoldByTable({ data }: { data: ProducerMetrics[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No sales data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[200px]">Producer</TableHead>
            <TableHead className="text-right">Sold HH</TableHead>
            <TableHead className="text-right">Sold Policies</TableHead>
            <TableHead className="text-right">Sold Items</TableHead>
            <TableHead className="text-right">Premium Written</TableHead>
            <TableHead className="text-right">Avg Premium/HH</TableHead>
            <TableHead className="text-right">Bundle Ratio</TableHead>
            <TableHead className="text-right">% of Total Sales</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index, arr) => {
            const totalPremium = arr.reduce((sum, r) => sum + r.soldPremiumCents, 0);
            const shareOfTotal = totalPremium > 0 ? (row.soldPremiumCents / totalPremium) * 100 : 0;
            const avgPremiumPerHH = row.soldHouseholds > 0 ? row.soldPremiumCents / row.soldHouseholds : 0;

            return (
              <TableRow
                key={row.teamMemberId ?? 'unassigned'}
                className={cn(
                  row.teamMemberId === null &&
                    'bg-amber-500/10 hover:bg-amber-500/20 border-l-4 border-l-amber-500'
                )}
              >
                <TableCell className="font-medium">
                  {row.teamMemberName}
                  {row.teamMemberId === null && (
                    <span className="ml-2 text-xs text-amber-500">(no producer)</span>
                  )}
                </TableCell>
                <TableCell className="text-right">{row.soldHouseholds.toLocaleString()}</TableCell>
                <TableCell className="text-right">{row.soldPolicies.toLocaleString()}</TableCell>
                <TableCell className="text-right">{row.soldItems.toLocaleString()}</TableCell>
                <TableCell className="text-right font-medium text-green-500">
                  {formatCurrency(row.soldPremiumCents)}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(avgPremiumPerHH)}</TableCell>
                <TableCell className="text-right">
                  <span className={row.bundleRatio !== null && row.bundleRatio >= 30 ? 'text-green-500' : ''}>
                    {formatPercent(row.bundleRatio)}
                  </span>
                </TableCell>
                <TableCell className="text-right">{formatPercent(shareOfTotal)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function LqsProducerBreakdown({ data, isLoading }: LqsProducerBreakdownProps) {
  const [activeTab, setActiveTab] = useState<'quotedBy' | 'soldBy'>('quotedBy');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Producer Breakdown</CardTitle>
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

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Producer Breakdown</CardTitle>
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
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Producer Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'quotedBy' | 'soldBy')}>
          <TabsList className="mb-4">
            <TabsTrigger value="quotedBy" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Quoted By
            </TabsTrigger>
            <TabsTrigger value="soldBy" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Sold By
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quotedBy">
            <div className="text-sm text-muted-foreground mb-4">
              Performance by who created the quote. Close ratio shows % of quoted households that converted to sales.
            </div>
            <QuotedByTable data={data.byQuotedBy} />
          </TabsContent>

          <TabsContent value="soldBy">
            <div className="text-sm text-muted-foreground mb-4">
              Performance by who closed the sale. Shows actual premium written and bundle performance.
            </div>
            <SoldByTable data={data.bySoldBy} />
          </TabsContent>
        </Tabs>

        {/* Totals Summary */}
        <div className="mt-6 pt-4 border-t border-border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Total Quoted HH</div>
              <div className="text-lg font-semibold">{data.totals.quotedHouseholds.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Total Quoted Premium</div>
              <div className="text-lg font-semibold">{formatCurrency(data.totals.quotedPremiumCents)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Total Sold HH</div>
              <div className="text-lg font-semibold text-green-500">{data.totals.soldHouseholds.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Total Written Premium</div>
              <div className="text-lg font-semibold text-green-500">{formatCurrency(data.totals.soldPremiumCents)}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
