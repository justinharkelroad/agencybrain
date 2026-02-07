import { useState, useCallback } from 'react';
import { Clock, AlertTriangle, Phone } from 'lucide-react';
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
import { useLqsTimeToClose, type FilteredHousehold } from '@/hooks/useLqsTimeToClose';
import { LqsTimeToCloseDetailSheet } from './LqsTimeToCloseDetailSheet';

interface LqsTimeToCloseAnalyticsProps {
  agencyId: string | null;
  dateRange: { start: Date; end: Date } | null;
}

export function LqsTimeToCloseAnalytics({ agencyId, dateRange }: LqsTimeToCloseAnalyticsProps) {
  const { data, isLoading } = useLqsTimeToClose(agencyId, dateRange);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTitle, setSheetTitle] = useState('');
  const [sheetHouseholds, setSheetHouseholds] = useState<FilteredHousehold[]>([]);

  const openSheet = useCallback((title: string, households: FilteredHousehold[]) => {
    setSheetTitle(title);
    setSheetHouseholds(households);
    setSheetOpen(true);
  }, []);

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

  const handleStatClick = (type: 'avg' | 'median' | 'closed' | 'stale' | 'occ') => {
    if (type === 'stale') {
      openSheet('Stale Quotes (30+ Days)', data.staleHouseholdsEnriched);
    } else if (type === 'occ') {
      const occHouseholds = data.soldHouseholdsEnriched.filter(h => data.oneCallCloseHouseholdIds.has(h.id));
      openSheet('One-Call Closes', occHouseholds);
    } else {
      openSheet('Closed Deals', data.soldHouseholdsEnriched);
    }
  };

  const handleBarClick = (entry: { label: string; min: number; max: number }) => {
    const filtered = data.soldHouseholdsEnriched.filter(h => {
      if (h.daysToClose === null) return false;
      return h.daysToClose >= entry.min && h.daysToClose <= entry.max;
    });
    openSheet(`Closed in ${entry.label}`, filtered);
  };

  const handleSourceRowClick = (sourceId: string | null) => {
    const filtered = data.soldHouseholdsEnriched.filter(h => h.leadSourceId === sourceId);
    const sourceName = data.bySource.find(s => s.sourceId === sourceId)?.sourceName || 'Unknown';
    openSheet(`Closed Deals — ${sourceName}`, filtered);
  };

  const handleProducerRowClick = (teamMemberId: string | null) => {
    const filtered = data.soldHouseholdsEnriched.filter(h => h.teamMemberId === teamMemberId);
    const producerName = data.byProducer.find(p => p.teamMemberId === teamMemberId)?.producerName || 'Unknown';
    openSheet(`Closed Deals — ${producerName}`, filtered);
  };

  const handleStaleBadgeClick = (sourceId: string | null, sourceName: string) => {
    const filtered = data.staleHouseholdsEnriched.filter(h => h.leadSourceId === sourceId);
    openSheet(`Stale Quotes — ${sourceName}`, filtered);
  };

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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <button
            className="text-center p-4 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => handleStatClick('avg')}
          >
            <div className="text-2xl font-bold text-blue-500">
              {data.avgDays}
            </div>
            <div className="text-xs text-muted-foreground">Avg Days</div>
          </button>
          <button
            className="text-center p-4 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => handleStatClick('median')}
          >
            <div className="text-2xl font-bold text-blue-500">
              {data.medianDays}
            </div>
            <div className="text-xs text-muted-foreground">Median Days</div>
          </button>
          <button
            className="text-center p-4 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => handleStatClick('closed')}
          >
            <div className="text-2xl font-bold text-green-500">
              {data.closedDeals.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Closed Deals</div>
          </button>
          <button
            className="text-center p-4 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => handleStatClick('occ')}
          >
            <div className="text-2xl font-bold text-green-500">
              <Phone className="h-4 w-4 inline mr-1 -mt-1" />
              {data.oneCallCloses}
            </div>
            <div className="text-xs text-muted-foreground">
              One-Call Closes
              {data.oneCallCloseRate !== null && (
                <span className="ml-1 text-green-500">
                  ({Math.round(data.oneCallCloseRate * 100)}%)
                </span>
              )}
            </div>
          </button>
          <button
            className={cn(
              "text-center p-4 rounded-lg cursor-pointer transition-colors",
              data.staleQuotes > 0 ? "bg-amber-500/10 hover:bg-amber-500/20" : "bg-muted/30 hover:bg-muted/50"
            )}
            onClick={() => handleStatClick('stale')}
          >
            <div className={cn(
              "text-2xl font-bold",
              data.staleQuotes > 0 ? "text-amber-500" : "text-muted-foreground"
            )}>
              {data.staleQuotes > 0 && <AlertTriangle className="h-4 w-4 inline mr-1 -mt-1" />}
              {data.staleQuotes.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Stale Quotes (30d+)</div>
          </button>
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
              <Bar
                dataKey="count"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(_data: unknown, index: number) => {
                  const entry = data.distribution[index];
                  if (entry) handleBarClick(entry);
                }}
              >
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
                      <TableRow
                        key={row.sourceId ?? 'unassigned'}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSourceRowClick(row.sourceId)}
                      >
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
                      <TableRow
                        key={row.teamMemberId ?? 'unassigned'}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleProducerRowClick(row.teamMemberId)}
                      >
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
                <button
                  key={row.sourceId ?? 'unassigned'}
                  onClick={() => handleStaleBadgeClick(row.sourceId, row.sourceName)}
                  className="inline-flex"
                >
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 text-amber-500 cursor-pointer hover:bg-amber-500/10 transition-colors"
                  >
                    {row.sourceName}: {row.count}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Detail Sheet */}
      <LqsTimeToCloseDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={sheetTitle}
        households={sheetHouseholds}
      />
    </Card>
  );
}
