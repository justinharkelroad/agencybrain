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

function monthLabel(reportMonth: string): string {
  const d = new Date(reportMonth);
  if (!Number.isFinite(d.getTime())) return reportMonth;
  return d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
}

function formatCentsAxisK(v: number): string {
  const dollars = v / 100;
  const abs = Math.abs(dollars);
  if (abs >= 1000) return `$${(dollars / 1000).toFixed(0)}K`;
  return `$${Math.round(dollars)}`;
}

function formatCents(v: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v / 100);
}

export function GCTrendChart({ snapshots }: GCTrendChartProps) {
  const [view, setView] = useState<TrendView>('growth');

  const data = useMemo(
    () =>
      snapshots.map((s) => ({
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
                variant={view === btn.id ? 'default' : 'ghost'}
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
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            {view === 'growth' ? (
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                  }}
                />
                <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                <Area
                  type="monotone"
                  dataKey="growthPoints"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              </AreaChart>
            ) : null}

            {view === 'retention' ? (
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v.toFixed(1)} pts`} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'Retention') return [`${value.toFixed(2)}%`, name];
                    return [`${value.toFixed(2)} pts`, name];
                  }}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="retentionCurrent" name="Retention" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} />
                <Line yAxisId="right" type="monotone" dataKey="retentionVariancePy" name="PY Variance" stroke="hsl(var(--chart-2))" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
              </ComposedChart>
            ) : null}

            {view === 'premium' ? (
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
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
                  formatter={(value: number, name: string) => {
                    if (name === 'YTD Variance') return [`${value.toFixed(2)}%`, name];
                    return [formatCents(value), name];
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="premiumNew" name="New Premium" stackId="premium" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="premiumRenewal" name="Renewal Premium" stackId="premium" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="premiumVarianceYtd" name="YTD Variance" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            ) : null}

            {view === 'loss-ratio' ? (
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
                <ReferenceArea y1={0} y2={40} fill="hsl(142 76% 36%)" fillOpacity={0.05} />
                <ReferenceArea y1={50} y2={100} fill="hsl(0 84% 60%)" fillOpacity={0.05} />
                <Area type="monotone" dataKey="lossRatio12" name="12MM" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.08} strokeWidth={2} />
                <Line type="monotone" dataKey="lossRatio24" name="24MM" stroke="hsl(var(--chart-2))" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2 }} />
              </ComposedChart>
            ) : null}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
