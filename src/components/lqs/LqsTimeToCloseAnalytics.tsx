import { Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useLqsTimeToClose } from '@/hooks/useLqsTimeToClose';

interface LqsTimeToCloseAnalyticsProps {
  agencyId: string | null;
  dateRange: { start: Date; end: Date } | null;
}

export function LqsTimeToCloseAnalytics({ agencyId, dateRange }: LqsTimeToCloseAnalyticsProps) {
  const { data, isLoading } = useLqsTimeToClose(agencyId, dateRange);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Time to Close</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-[300px] w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.closedDeals === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            Time to Close
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No closed deals in this period to analyze cycle times.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-500" />
          Time to Close
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="text-2xl font-bold text-blue-500">
              {data.avgDays}
            </div>
            <div className="text-xs text-muted-foreground">Avg Days</div>
          </div>
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="text-2xl font-bold text-blue-500">
              {data.medianDays}
            </div>
            <div className="text-xs text-muted-foreground">Median Days</div>
          </div>
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="text-2xl font-bold text-green-500">
              {data.closedDeals.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Closed Deals</div>
          </div>
          <div className={cn(
            "text-center p-4 rounded-lg",
            data.staleQuotes > 0 ? "bg-amber-500/10" : "bg-muted/30"
          )}>
            <div className={cn(
              "text-2xl font-bold",
              data.staleQuotes > 0 ? "text-amber-500" : "text-muted-foreground"
            )}>
              {data.staleQuotes > 0 && <AlertTriangle className="h-4 w-4 inline mr-1 -mt-1" />}
              {data.staleQuotes.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Stale Quotes (30d+)</div>
          </div>
        </div>

        {/* Distribution Histogram */}
        <div>
          <h4 className="text-sm font-medium mb-2">Close Time Distribution</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.distribution} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--popover-foreground))',
                }}
                formatter={(value: number) => [value, 'Deals']}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.distribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By Source and By Producer tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* By Lead Source */}
          <div>
            <h4 className="text-sm font-medium mb-2">By Lead Source</h4>
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Avg Days</TableHead>
                    <TableHead className="text-right">Median</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.bySource.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                        No data
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.bySource.map(row => (
                      <TableRow key={row.sourceId ?? 'unassigned'}>
                        <TableCell className="font-medium">{row.sourceName}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={cn(
                            row.avgDays <= 14 ? 'border-green-500/30 text-green-500' :
                            row.avgDays <= 30 ? 'border-amber-500/30 text-amber-500' :
                            'border-red-500/30 text-red-500'
                          )}>
                            {row.avgDays}d
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{row.medianDays}d</TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* By Producer */}
          <div>
            <h4 className="text-sm font-medium mb-2">By Producer</h4>
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Producer</TableHead>
                    <TableHead className="text-right">Avg Days</TableHead>
                    <TableHead className="text-right">Median</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byProducer.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                        No data
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.byProducer.map(row => (
                      <TableRow key={row.teamMemberId ?? 'unassigned'}>
                        <TableCell className="font-medium">{row.producerName}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={cn(
                            row.avgDays <= 14 ? 'border-green-500/30 text-green-500' :
                            row.avgDays <= 30 ? 'border-amber-500/30 text-amber-500' :
                            'border-red-500/30 text-red-500'
                          )}>
                            {row.avgDays}d
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{row.medianDays}d</TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Stale Quotes Alert */}
        {data.staleQuotes > 0 && data.staleBySource.length > 0 && (
          <div className="border border-amber-500/30 rounded-lg p-4 bg-amber-500/5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h4 className="text-sm font-medium text-amber-500">
                {data.staleQuotes} Stale Quotes (Quoted 30+ Days Ago, Not Sold)
              </h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.staleBySource.map(row => (
                <Badge
                  key={row.sourceId ?? 'unassigned'}
                  variant="outline"
                  className="border-amber-500/30 text-amber-500"
                >
                  {row.sourceName}: {row.count}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
