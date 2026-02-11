import { useMemo, useState } from 'react';
import { Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { BusinessMetricsSnapshot } from '@/lib/growth-center/types';

type MetricRow = {
  label: string;
  key: string;
  section: 'GROWTH' | 'RETENTION' | 'PREMIUM' | 'LOSS RATIO';
  value: (snapshot: BusinessMetricsSnapshot) => number | null;
  formatter: (value: number | null) => string;
  invertPolarity?: boolean;
};

function monthLabel(reportMonth: string): string {
  const d = new Date(reportMonth);
  if (!Number.isFinite(d.getTime())) return reportMonth;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function numberFmt(value: number | null): string {
  if (value === null) return '--';
  return new Intl.NumberFormat('en-US').format(value);
}

function currencyFmt(value: number | null): string {
  if (value === null) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function percentFmt(value: number | null): string {
  if (value === null) return '--';
  return `${(value * 100).toFixed(2)}%`;
}

function pointsFmt(value: number | null): string {
  if (value === null) return '--';
  return `${(value * 100).toFixed(2)} pts`;
}

function deltaLabel(value: number, formatter: (v: number | null) => string): string {
  const abs = Math.abs(value);
  return `${value >= 0 ? '▲' : '▼'} ${formatter(abs)}`;
}

const METRICS: MetricRow[] = [
  { section: 'GROWTH', key: 'capped_items_total', label: 'Capped Items (Total P&C)', value: (s) => s.capped_items_total, formatter: numberFmt },
  { section: 'GROWTH', key: 'capped_items_new', label: 'New Items', value: (s) => s.capped_items_new, formatter: numberFmt },
  { section: 'GROWTH', key: 'capped_items_renewal', label: 'Renewal Items', value: (s) => s.capped_items_renewal, formatter: numberFmt },
  { section: 'GROWTH', key: 'capped_items_variance_pye', label: 'Variance to PYE', value: (s) => s.capped_items_variance_pye, formatter: numberFmt },
  { section: 'GROWTH', key: 'pif_current', label: 'Policies in Force', value: (s) => s.pif_current, formatter: numberFmt },

  { section: 'RETENTION', key: 'retention_current', label: 'Current Month %', value: (s) => s.retention_current, formatter: percentFmt },
  { section: 'RETENTION', key: 'retention_prior_year', label: 'Prior Year %', value: (s) => s.retention_prior_year, formatter: percentFmt },
  { section: 'RETENTION', key: 'retention_point_variance_py', label: 'Point Variance PY', value: (s) => s.retention_point_variance_py, formatter: pointsFmt },
  { section: 'RETENTION', key: 'net_retention', label: 'Net Retention', value: (s) => s.net_retention, formatter: percentFmt },
  { section: 'RETENTION', key: 'retention_0_2_years', label: '0-2 Year Tenure', value: (s) => s.retention_0_2_years, formatter: percentFmt },
  { section: 'RETENTION', key: 'retention_2_5_years', label: '2-5 Year Tenure', value: (s) => s.retention_2_5_years, formatter: percentFmt },
  { section: 'RETENTION', key: 'retention_5_plus_years', label: '5+ Year Tenure', value: (s) => s.retention_5_plus_years, formatter: percentFmt },

  { section: 'PREMIUM', key: 'premium_current_month_new', label: 'New Business (current month)', value: (s) => s.premium_current_month_new, formatter: currencyFmt },
  { section: 'PREMIUM', key: 'premium_current_month_renewal', label: 'Renewal (current month)', value: (s) => s.premium_current_month_renewal, formatter: currencyFmt },
  { section: 'PREMIUM', key: 'premium_current_month_total', label: 'Total (current month)', value: (s) => s.premium_current_month_total, formatter: currencyFmt },
  { section: 'PREMIUM', key: 'premium_py_same_month', label: 'PY Same Month', value: (s) => s.premium_py_same_month, formatter: currencyFmt },
  { section: 'PREMIUM', key: 'premium_pct_variance_py', label: '% Variance PY (monthly)', value: (s) => s.premium_pct_variance_py, formatter: percentFmt },
  { section: 'PREMIUM', key: 'premium_ytd_total', label: 'YTD Total', value: (s) => s.premium_ytd_total, formatter: currencyFmt },
  { section: 'PREMIUM', key: 'premium_pct_variance_py_ytd', label: '% Variance PY (YTD)', value: (s) => s.premium_pct_variance_py_ytd, formatter: percentFmt },

  { section: 'LOSS RATIO', key: 'loss_ratio_12mm', label: '12MM Loss Ratio', value: (s) => s.loss_ratio_12mm, formatter: percentFmt, invertPolarity: true },
  { section: 'LOSS RATIO', key: 'loss_ratio_24mm', label: '24MM Loss Ratio', value: (s) => s.loss_ratio_24mm, formatter: percentFmt, invertPolarity: true },
];

interface GCComparisonTableProps {
  snapshots: BusinessMetricsSnapshot[];
}

export function GCComparisonTable({ snapshots }: GCComparisonTableProps) {
  const [fromMonth, setFromMonth] = useState<string>('all');
  const [toMonth, setToMonth] = useState<string>('all');

  const monthOptions = useMemo(
    () =>
      snapshots.map((s) => ({
        key: s.report_month,
        label: monthLabel(s.report_month),
      })),
    [snapshots]
  );

  const filteredSnapshots = useMemo(() => {
    if (snapshots.length === 0) return [];
    if (fromMonth === 'all' && toMonth === 'all') return snapshots.slice(-3);

    const fromDate = fromMonth === 'all' ? null : new Date(fromMonth);
    const toDate = toMonth === 'all' ? null : new Date(toMonth);

    const data = snapshots.filter((s) => {
      const d = new Date(s.report_month);
      if (!Number.isFinite(d.getTime())) return false;
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });

    return data.length > 0 ? data : snapshots.slice(-3);
  }, [snapshots, fromMonth, toMonth]);

  const sections: Array<MetricRow['section']> = ['GROWTH', 'RETENTION', 'PREMIUM', 'LOSS RATIO'];
  const headerMonths = filteredSnapshots;
  const last = headerMonths[headerMonths.length - 1] ?? null;
  const prev = headerMonths.length >= 2 ? headerMonths[headerMonths.length - 2] : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm font-medium">Month-over-Month Detail</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={fromMonth} onValueChange={setFromMonth}>
              <SelectTrigger className="w-[150px] h-8">
                <SelectValue placeholder="From" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">From: Auto</SelectItem>
                {monthOptions.map((m) => (
                  <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={toMonth} onValueChange={setToMonth}>
              <SelectTrigger className="w-[150px] h-8">
                <SelectValue placeholder="To" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">To: Auto</SelectItem>
                {monthOptions.map((m) => (
                  <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10">Metric</TableHead>
              {headerMonths.map((s) => (
                <TableHead key={s.id} className="text-right tabular-nums">{monthLabel(s.report_month)}</TableHead>
              ))}
              <TableHead className="text-right tabular-nums">Δ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sections.map((section) => (
              <Fragment key={section}>
                <TableRow className="bg-muted/30">
                  <TableCell className="font-semibold text-xs uppercase tracking-wide" colSpan={headerMonths.length + 2}>
                    {section}
                  </TableCell>
                </TableRow>
                {METRICS.filter((m) => m.section === section).map((metric) => {
                  const latestValue = last ? metric.value(last) : null;
                  const prevValue = prev ? metric.value(prev) : null;
                  const rawDelta =
                    latestValue !== null && prevValue !== null ? latestValue - prevValue : null;

                  const improved = rawDelta !== null
                    ? metric.invertPolarity
                      ? rawDelta < 0
                      : rawDelta > 0
                    : null;

                  return (
                    <TableRow key={`${section}-${metric.key}`}>
                      <TableCell className="sticky left-0 bg-background">{metric.label}</TableCell>
                      {headerMonths.map((s) => (
                        <TableCell key={`${metric.key}-${s.id}`} className="text-right tabular-nums">
                          {metric.formatter(metric.value(s))}
                        </TableCell>
                      ))}
                      <TableCell
                        className={cn(
                          'text-right tabular-nums',
                          improved === true && 'text-emerald-500',
                          improved === false && 'text-red-500'
                        )}
                      >
                        {rawDelta === null ? '--' : deltaLabel(rawDelta, metric.formatter)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
