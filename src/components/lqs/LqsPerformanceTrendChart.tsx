import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TrendingUp, Info } from 'lucide-react';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useLqsPerformanceTrend, type BucketTrendData } from '@/hooks/useLqsPerformanceTrend';

interface LqsPerformanceTrendChartProps {
  agencyId: string | null;
}

type MetricType = 'premium' | 'roi' | 'closeRate' | 'leads' | 'sales';

const METRIC_CONFIG: Record<MetricType, {
  label: string;
  dataKey: string;
  color: string;
  formatter: (value: number | null) => string;
  yAxisFormatter: (value: number) => string;
  description: string;
}> = {
  premium: {
    label: 'Premium Written',
    dataKey: 'premiumCents',
    color: 'hsl(142.1 76.2% 36.3%)',
    formatter: (v) => v !== null ? formatCurrency(v) : '—',
    yAxisFormatter: (v) => formatCompactCurrency(v),
    description: 'Total premium from closed sales each month',
  },
  roi: {
    label: 'ROI',
    dataKey: 'roi',
    color: 'hsl(221.2 83.2% 53.3%)',
    formatter: (v) => v !== null ? `${v.toFixed(2)}x` : '—',
    yAxisFormatter: (v) => `${v.toFixed(1)}x`,
    description: 'Commission earned divided by spend',
  },
  closeRate: {
    label: 'Close Rate',
    dataKey: 'closeRate',
    color: 'hsl(38 92% 50%)',
    formatter: (v) => v !== null ? `${v.toFixed(1)}%` : '—',
    yAxisFormatter: (v) => `${v.toFixed(0)}%`,
    description: 'Percentage of quoted households that closed',
  },
  leads: {
    label: 'Leads Received',
    dataKey: 'leadsReceived',
    color: 'hsl(262.1 83.3% 57.8%)',
    formatter: (v) => v !== null ? v.toLocaleString() : '—',
    yAxisFormatter: (v) => v.toLocaleString(),
    description: 'Number of new leads received each month',
  },
  sales: {
    label: 'Sales Closed',
    dataKey: 'soldHouseholds',
    color: 'hsl(142.1 76.2% 36.3%)',
    formatter: (v) => v !== null ? v.toLocaleString() : '—',
    yAxisFormatter: (v) => v.toLocaleString(),
    description: 'Number of households closed each month',
  },
};

// Format currency from cents
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

// Format compact currency
function formatCompactCurrency(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000000) {
    return `$${(dollars / 1000000).toFixed(1)}M`;
  }
  if (dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(0)}K`;
  }
  return `$${dollars.toFixed(0)}`;
}

// Custom tooltip
function CustomTooltip({
  active,
  payload,
  label,
  metric,
}: {
  active?: boolean;
  payload?: Array<{ value: number | null; color: string; name: string }>;
  label?: string;
  metric: MetricType;
}) {
  if (!active || !payload || !payload.length) return null;

  const config = METRIC_CONFIG[metric];

  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">{config.label}:</span>
        <span className="font-medium" style={{ color: config.color }}>
          {config.formatter(payload[0].value)}
        </span>
      </div>
    </div>
  );
}

export function LqsPerformanceTrendChart({ agencyId }: LqsPerformanceTrendChartProps) {
  const { data: trendData, isLoading, error } = useLqsPerformanceTrend(agencyId);
  const [selectedBucket, setSelectedBucket] = useState<string>('__all__');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('premium');

  // Get chart data for selected bucket
  const chartData = useMemo(() => {
    if (!trendData) return [];
    const bucket = trendData.find((b) => b.bucketId === selectedBucket);
    return bucket?.monthlyData || [];
  }, [trendData, selectedBucket]);

  // Get bucket options for dropdown
  const bucketOptions = useMemo(() => {
    if (!trendData) return [];
    return trendData.map((b) => ({
      value: b.bucketId ?? 'null',
      label: b.bucketName,
    }));
  }, [trendData]);

  const metricConfig = METRIC_CONFIG[selectedMetric];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] flex items-center justify-center text-destructive">
            Failed to load trend data
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            No trend data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Trend
            </CardTitle>
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[280px]">
                  <p className="text-xs">{metricConfig.description}</p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedMetric} onValueChange={(v) => setSelectedMetric(v as MetricType)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="premium">Premium Written</SelectItem>
                <SelectItem value="sales">Sales Closed</SelectItem>
                <SelectItem value="leads">Leads Received</SelectItem>
                <SelectItem value="closeRate">Close Rate</SelectItem>
                <SelectItem value="roi">ROI</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedBucket ?? 'null'} onValueChange={setSelectedBucket}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bucketOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Last 12 months performance by marketing bucket
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                tickLine={false}
              />
              <YAxis
                tickFormatter={metricConfig.yAxisFormatter}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip metric={selectedMetric} />} />
              <Line
                type="monotone"
                dataKey={metricConfig.dataKey}
                stroke={metricConfig.color}
                strokeWidth={2}
                dot={{ fill: metricConfig.color, strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
          {(() => {
            // Calculate summary stats
            const dataWithValues = chartData.filter((d) => {
              const val = d[metricConfig.dataKey as keyof typeof d];
              return val !== null && val !== undefined;
            });

            if (dataWithValues.length === 0) {
              return (
                <div className="col-span-3 text-center text-muted-foreground text-sm">
                  No data available for this metric
                </div>
              );
            }

            const values = dataWithValues.map((d) => d[metricConfig.dataKey as keyof typeof d] as number);
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            const latest = values[values.length - 1];
            const previous = values.length > 1 ? values[values.length - 2] : null;
            const change = previous !== null && previous !== 0
              ? ((latest - previous) / previous) * 100
              : null;

            return (
              <>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Latest</p>
                  <p className="font-semibold" style={{ color: metricConfig.color }}>
                    {metricConfig.formatter(latest)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">12-Month Avg</p>
                  <p className="font-semibold text-muted-foreground">
                    {metricConfig.formatter(avg)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">vs Last Month</p>
                  <p className={`font-semibold ${
                    change === null ? 'text-muted-foreground' :
                    change >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {change !== null ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}%` : '—'}
                  </p>
                </div>
              </>
            );
          })()}
        </div>
      </CardContent>
    </Card>
  );
}
