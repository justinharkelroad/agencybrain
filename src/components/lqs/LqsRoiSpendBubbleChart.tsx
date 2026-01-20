import { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Info } from 'lucide-react';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { LeadSourceRoiRow } from '@/hooks/useLqsRoiAnalytics';

interface LqsRoiSpendBubbleChartProps {
  data: LeadSourceRoiRow[];
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

// Format compact currency for axis
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

interface BubbleDataPoint {
  name: string;
  spend: number; // in dollars for display
  spendCents: number;
  roi: number;
  premium: number; // in dollars for display
  premiumCents: number;
  sales: number;
  isPositiveRoi: boolean;
  bucketName: string | null;
}

// Custom tooltip component
function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: BubbleDataPoint }> }) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-foreground mb-2">{data.name}</p>
      {data.bucketName && (
        <p className="text-xs text-muted-foreground mb-2">{data.bucketName}</p>
      )}
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Spend:</span>
          <span className="font-medium">{formatCurrency(data.spendCents)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">ROI:</span>
          <span className={`font-medium ${data.isPositiveRoi ? 'text-green-500' : 'text-amber-500'}`}>
            {data.roi.toFixed(2)}x
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Premium:</span>
          <span className="font-medium text-green-500">{formatCurrency(data.premiumCents)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Sales:</span>
          <span className="font-medium">{data.sales}</span>
        </div>
      </div>
    </div>
  );
}

export function LqsRoiSpendBubbleChart({ data, isLoading }: LqsRoiSpendBubbleChartProps) {
  // Transform data for the chart - only include sources with spend > 0 and valid ROI
  const chartData = useMemo<BubbleDataPoint[]>(() => {
    return data
      .filter((row) => row.spendCents > 0 && row.roi !== null)
      .map((row) => ({
        name: row.leadSourceName,
        spend: row.spendCents / 100,
        spendCents: row.spendCents,
        roi: row.roi!,
        premium: row.premiumCents / 100,
        premiumCents: row.premiumCents,
        sales: row.totalSales,
        isPositiveRoi: row.roi! >= 1,
        bucketName: row.bucketName,
      }))
      .sort((a, b) => b.premium - a.premium); // Sort by premium for consistent z-index
  }, [data]);

  // Calculate domain for axes with padding
  const { xDomain, yDomain, zRange } = useMemo(() => {
    if (chartData.length === 0) {
      return { xDomain: [0, 1000], yDomain: [0, 3], zRange: [50, 200] };
    }

    const spends = chartData.map((d) => d.spend);
    const rois = chartData.map((d) => d.roi);
    const premiums = chartData.map((d) => d.premium);

    const minSpend = Math.min(...spends);
    const maxSpend = Math.max(...spends);
    const minRoi = Math.min(...rois);
    const maxRoi = Math.max(...rois);
    const minPremium = Math.min(...premiums);
    const maxPremium = Math.max(...premiums);

    // Add 10% padding to domains
    const spendPadding = (maxSpend - minSpend) * 0.1 || maxSpend * 0.1;
    const roiPadding = (maxRoi - minRoi) * 0.15 || 0.5;

    return {
      xDomain: [Math.max(0, minSpend - spendPadding), maxSpend + spendPadding],
      yDomain: [Math.max(0, minRoi - roiPadding), maxRoi + roiPadding],
      // Bubble size range based on premium spread
      zRange: [40, maxPremium > minPremium * 10 ? 400 : 200] as [number, number],
    };
  }, [chartData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            ROI vs Spend Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px] w-full" />
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
            ROI vs Spend Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            No lead sources with spend data available
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
            <TrendingUp className="h-5 w-5" />
            ROI vs Spend Analysis
          </CardTitle>
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[280px]">
                <p className="text-xs">
                  Bubble size represents premium written. Green bubbles have ROI ≥ 1x (profitable).
                  The dashed line marks break-even (1x ROI).
                </p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </div>
        <p className="text-sm text-muted-foreground">
          Identify high-spend underperformers and hidden gems
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                type="number"
                dataKey="spend"
                name="Spend"
                domain={xDomain}
                tickFormatter={(value) => formatCompactCurrency(value * 100)}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                label={{
                  value: 'Total Spend',
                  position: 'bottom',
                  offset: 0,
                  className: 'fill-muted-foreground text-xs',
                }}
              />
              <YAxis
                type="number"
                dataKey="roi"
                name="ROI"
                domain={yDomain}
                tickFormatter={(value) => `${value.toFixed(1)}x`}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                label={{
                  value: 'ROI',
                  angle: -90,
                  position: 'insideLeft',
                  className: 'fill-muted-foreground text-xs',
                }}
              />
              <ZAxis
                type="number"
                dataKey="premium"
                range={zRange}
                name="Premium"
              />
              {/* Break-even line at ROI = 1 */}
              <ReferenceLine
                y={1}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="5 5"
                strokeOpacity={0.5}
              />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={chartData} fill="#8884d8">
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isPositiveRoi ? 'hsl(142.1 76.2% 36.3%)' : 'hsl(38 92% 50%)'}
                    fillOpacity={0.7}
                    stroke={entry.isPositiveRoi ? 'hsl(142.1 76.2% 36.3%)' : 'hsl(38 92% 50%)'}
                    strokeWidth={2}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-muted-foreground">ROI ≥ 1x (Profitable)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-muted-foreground">ROI &lt; 1x (Losing Money)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/50" />
            <span className="text-muted-foreground">Size = Premium Written</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
