import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { BusinessMetricsSnapshot } from '@/lib/growth-center/types';

type TrendView = 'growth' | 'retention' | 'premium' | 'loss-ratio';

interface GCTrendChartProps {
  snapshots: BusinessMetricsSnapshot[];
}

const SERIES_COLORS = {
  growth: 'hsl(var(--primary))',
  retention: 'hsl(188 87% 47%)',
  variance: 'hsl(38 92% 50%)',
  premiumNew: 'hsl(172 70% 45%)',
  premiumRenewal: 'hsl(214 89% 60%)',
  premiumTrend: 'hsl(31 95% 55%)',
  loss12: 'hsl(188 87% 47%)',
  loss24: 'hsl(31 95% 55%)',
};

function sortByReportMonthAsc<T extends { report_month: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.report_month.localeCompare(b.report_month));
}

function monthLabel(reportMonth: string): string {
  const d = new Date(`${reportMonth}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return reportMonth;
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

function formatCentsAxisK(v: number): string {
  const dollars = v / 100;
  const abs = Math.abs(dollars);
  if (abs >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(dollars / 1_000)}K`;
  return `$${Math.round(dollars)}`;
}

function formatCents(v: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v / 100);
}

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  color: 'hsl(var(--popover-foreground))',
};

export function GCTrendChart({ snapshots }: GCTrendChartProps) {
  const [view, setView] = useState<TrendView>('growth');

  const data = useMemo(
    () =>
      sortByReportMonthAsc(snapshots).map((s) => ({
        month: monthLabel(s.report_month),
        growthPoints: s.capped_items_variance_pye ?? 0,
        retentionCurrent: (s.retention_current ?? 0) * 100,
        retentionVariancePy: (s.retention_point_variance_py ?? 0) * 100,
        premiumNew: s.premium_current_month_new ?? 0,
        premiumRenewal: s.premium_current_month_renewal ?? 0,
        premiumVarianceYtd: (s.premium_pct_variance_py_ytd ?? 0) * 100,
        lossRatio12: (s.loss_ratio_12mm ?? 0) * 100,
        lossRatio24: (s.loss_ratio_24mm ?? 0) * 100,
      })),
    [snapshots]
  );

  const toggleButtons: Array<{ id: TrendView; label: string }> = [
    { id: 'growth', label: 'Growth Points' },
    { id: 'retention', label: 'Retention' },
    { id: 'premium', label: 'Premium' },
    { id: 'loss-ratio', label: 'Loss Ratio' },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm font-medium">Monthly Trends</CardTitle>
          <div className="flex flex-wrap gap-1">
            {toggleButtons.map((btn) => (
              <Button
                key={btn.id}
                size="sm"
                variant={view === btn.id ? 'secondary' : 'ghost'}
                className="h-8 px-3"
                onClick={() => setView(btn.id)}
              >
                {btn.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            {view === 'growth' ? (
              <AreaChart data={data}>
                <CartesianGrid vertical={false} strokeDasharray="8 8" className="stroke-border/50" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                <Area
                  type="natural"
                  dataKey="growthPoints"
                  stroke={SERIES_COLORS.growth}
                  fill={SERIES_COLORS.growth}
                  fillOpacity={0.14}
                  strokeWidth={2.2}
                />
              </AreaChart>
            ) : view === 'retention' ? (
              <ComposedChart data={data}>
                <CartesianGrid vertical={false} strokeDasharray="8 8" className="stroke-border/50" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" domain={[0, 100]} tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v.toFixed(1)} pts`} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) => {
                    if (name === 'Retention') return [`${value.toFixed(2)}%`, name];
                    return [`${value.toFixed(2)} pts`, name];
                  }}
                />
                <Legend />
                <Line yAxisId="left" type="natural" dataKey="retentionCurrent" name="Retention" stroke={SERIES_COLORS.retention} strokeWidth={2.6} dot={false} activeDot={{ r: 4 }} />
                <Line yAxisId="right" type="natural" dataKey="retentionVariancePy" name="PY Variance" stroke={SERIES_COLORS.variance} strokeWidth={2.4} strokeDasharray="6 6" dot={false} activeDot={{ r: 4 }} />
              </ComposedChart>
            ) : view === 'premium' ? (
              <ComposedChart data={data}>
                <CartesianGrid vertical={false} strokeDasharray="8 8" className="stroke-border/50" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis
                  yAxisId="left"
                  tickFormatter={(v) => formatCentsAxisK(v)}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) => {
                    if (name === 'YTD Variance') return [`${value.toFixed(2)}%`, name];
                    return [formatCents(value), name];
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="premiumNew" name="New Premium" stackId="premium" fill={SERIES_COLORS.premiumNew} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="premiumRenewal" name="Renewal Premium" stackId="premium" fill={SERIES_COLORS.premiumRenewal} radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="natural" dataKey="premiumVarianceYtd" name="YTD Variance" stroke={SERIES_COLORS.premiumTrend} strokeWidth={2.6} dot={false} activeDot={{ r: 4 }} />
              </ComposedChart>
            ) : (
              <ComposedChart data={data}>
                <CartesianGrid vertical={false} strokeDasharray="8 8" className="stroke-border/50" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `${value.toFixed(2)}%`} />
                <ReferenceArea y1={0} y2={40} fill="hsl(142 76% 36%)" fillOpacity={0.08} />
                <ReferenceArea y1={50} y2={100} fill="hsl(0 84% 60%)" fillOpacity={0.08} />
                <Area type="natural" dataKey="lossRatio12" name="12MM" stroke={SERIES_COLORS.loss12} fill={SERIES_COLORS.loss12} fillOpacity={0.1} strokeWidth={2.2} />
                <Line type="natural" dataKey="lossRatio24" name="24MM" stroke={SERIES_COLORS.loss24} strokeWidth={2.4} strokeDasharray="6 6" dot={false} activeDot={{ r: 4 }} />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
