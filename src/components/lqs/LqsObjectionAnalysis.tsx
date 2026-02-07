import { useState } from 'react';
import { ShieldAlert, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  LineChart,
  Line,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useLqsObjectionAnalysis } from '@/hooks/useLqsObjectionAnalysis';

interface LqsObjectionAnalysisProps {
  agencyId: string | null;
  dateRange: { start: Date; end: Date } | null;
}

function formatPercent(value: number | null): string {
  if (value === null) return '-';
  return `${value.toFixed(1)}%`;
}

export function LqsObjectionAnalysis({ agencyId, dateRange }: LqsObjectionAnalysisProps) {
  const { data, isLoading } = useLqsObjectionAnalysis(agencyId, dateRange);
  const [tab, setTab] = useState('bySource');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Objection Analysis</CardTitle>
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

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-orange-500" />
            Objection Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data.hasSufficientData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-orange-500" />
            Objection Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 space-y-3">
            <Info className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">
              Start assigning objections to lost leads to unlock insights here.
            </p>
            <p className="text-xs text-muted-foreground">
              {data.withObjection} of {data.withObjection + data.withoutObjection} households have objections assigned.
              At least 5 are needed for analysis.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare chart data for horizontal bar chart
  const chartData = data.frequencies.slice(0, 10).map(f => ({
    name: f.objectionName.length > 20 ? f.objectionName.slice(0, 18) + '...' : f.objectionName,
    fullName: f.objectionName,
    count: f.total,
    soldDespite: f.soldDespite,
    percentage: f.percentage,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-orange-500" />
          Objection Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="text-2xl font-bold">
              {data.totalNonSold.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Total Non-Sold</div>
          </div>
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="text-2xl font-bold text-orange-500">
              {data.withObjection.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              With Objection
              <Badge variant="outline" className="border-orange-500/30 text-orange-500 text-[10px] ml-1">
                {formatPercent(data.objectionRate)}
              </Badge>
            </div>
          </div>
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="text-2xl font-bold text-muted-foreground">
              {data.withoutObjection.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">No Objection Set</div>
          </div>
        </div>

        {/* Objection Frequency Chart */}
        {chartData.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Top Objections</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={130}
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                />
                <RechartsTooltip
                  cursor={false}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--popover-foreground))',
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'count') return [value, 'Total'];
                    if (name === 'soldDespite') return [value, 'Sold Despite'];
                    return [value, name];
                  }}
                  labelFormatter={(label: string, payload) => {
                    const item = payload?.[0]?.payload;
                    return item?.fullName || label;
                  }}
                />
                <Bar dataKey="count" fill="#f97316" fillOpacity={0.7} radius={[0, 8, 8, 0]} name="count" />
                <Bar dataKey="soldDespite" fill="#22c55e" fillOpacity={0.7} radius={[0, 8, 8, 0]} name="soldDespite" />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-orange-500/70 inline-block" /> Total with objection
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-green-500/70 inline-block" /> Sold despite objection
              </span>
            </div>
          </div>
        )}

        {/* Tabs: By Source / By Producer / Trend */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bySource">By Lead Source</TabsTrigger>
            <TabsTrigger value="byProducer">By Producer</TabsTrigger>
            <TabsTrigger value="trend">Trend</TabsTrigger>
          </TabsList>

          <TabsContent value="bySource" className="mt-4">
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Non-Sold</TableHead>
                    <TableHead className="text-right">With Objection</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead>Top Objection</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.bySource.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                        No data
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.bySource.map(row => (
                      <TableRow key={row.groupId ?? 'unassigned'}>
                        <TableCell className="font-medium">{row.groupName}</TableCell>
                        <TableCell className="text-right">{row.nonSold.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-orange-500 font-medium">
                          {row.withObjection.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={cn(
                            row.objectionRate !== null && row.objectionRate >= 50
                              ? 'border-red-500/30 text-red-500'
                              : row.objectionRate !== null && row.objectionRate >= 25
                              ? 'border-amber-500/30 text-amber-500'
                              : ''
                          )}>
                            {formatPercent(row.objectionRate)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {row.topObjection || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="byProducer" className="mt-4">
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Producer</TableHead>
                    <TableHead className="text-right">Non-Sold</TableHead>
                    <TableHead className="text-right">With Objection</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead>Top Objection</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byProducer.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                        No data
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.byProducer.map(row => (
                      <TableRow key={row.groupId ?? 'unassigned'}>
                        <TableCell className="font-medium">{row.groupName}</TableCell>
                        <TableCell className="text-right">{row.nonSold.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-orange-500 font-medium">
                          {row.withObjection.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={cn(
                            row.objectionRate !== null && row.objectionRate >= 50
                              ? 'border-red-500/30 text-red-500'
                              : row.objectionRate !== null && row.objectionRate >= 25
                              ? 'border-amber-500/30 text-amber-500'
                              : ''
                          )}>
                            {formatPercent(row.objectionRate)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {row.topObjection || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="trend" className="mt-4 space-y-4">
            {data.trend.length > 1 ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.trend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12 }}
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      className="fill-muted-foreground"
                      tickFormatter={(v) => `${v}%`}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--popover-foreground))',
                      }}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Objection Rate']}
                    />
                    <Line
                      type="monotone"
                      dataKey="objectionRate"
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#f97316' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="overflow-x-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Total HH</TableHead>
                        <TableHead className="text-right">With Objection</TableHead>
                        <TableHead className="text-right">Objection Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.trend.map(row => (
                        <TableRow key={row.month}>
                          <TableCell className="font-medium">{row.month}</TableCell>
                          <TableCell className="text-right">{row.totalHouseholds.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-orange-500 font-medium">
                            {row.withObjection.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">{formatPercent(row.objectionRate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Need data from at least 2 months to show a trend.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
