import { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BusinessMetricsReport, BusinessMetricsSnapshot } from '@/lib/growth-center/types';

interface GCLossRatioTabProps {
  snapshots: BusinessMetricsSnapshot[];
  reports: BusinessMetricsReport[];
}

type LobLossRow = {
  key: string;
  label: string;
  ratio12: number | null;
  ratio24: number | null;
};

const EXCLUDED_LINE_KEYS = new Set(['total_pc', 'total_personal_lines']);

function sortByReportMonthAsc<T extends { report_month: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.report_month.localeCompare(b.report_month));
}

function sortByReportMonthDesc<T extends { report_month: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.report_month.localeCompare(a.report_month));
}

function toMonthLabel(reportMonth: string): string {
  const d = new Date(`${reportMonth}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return reportMonth;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function toPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '--';
  return `${(value * 100).toFixed(2)}%`;
}

function toCurrency(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function getRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatLineLabel(key: string, rawLabel?: unknown): string {
  if (typeof rawLabel === 'string' && rawLabel.trim().length > 0 && rawLabel !== key) {
    return rawLabel;
  }
  return key
    .split('_')
    .map((part) => (part.length ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(' ');
}

function barColor(ratio: number | null): string {
  if (ratio === null) return 'bg-muted/30';
  if (ratio < 0.4) return 'bg-emerald-500/70';
  if (ratio <= 0.5) return 'bg-amber-500/70';
  return 'bg-red-500/70';
}

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  color: 'hsl(var(--popover-foreground))',
};

export function GCLossRatioTab({ snapshots, reports }: GCLossRatioTabProps) {
  const trendData = useMemo(
    () =>
      sortByReportMonthAsc(snapshots).map((s) => ({
        month: toMonthLabel(s.report_month),
        lossRatio12: (s.loss_ratio_12mm ?? 0) * 100,
        lossRatio24: (s.loss_ratio_24mm ?? 0) * 100,
        earnedPremium12: s.premium_12mm_earned ?? 0,
        paidLosses12: s.adj_paid_losses_12mm ?? 0,
      })),
    [snapshots]
  );

  const parsedReports = useMemo(
    () => sortByReportMonthDesc(reports.filter((report) => report.parse_status === 'parsed')),
    [reports]
  );

  const latestReport = parsedReports[0] ?? null;
  const latestParsedLines = useMemo(() => {
    const parsedData = getRecord(latestReport?.parsed_data);
    return getRecord(parsedData?.lines);
  }, [latestReport]);

  const lobRows = useMemo<LobLossRow[]>(() => {
    if (!latestParsedLines) return [];

    return Object.entries(latestParsedLines)
      .filter(([lineKey]) => !EXCLUDED_LINE_KEYS.has(lineKey))
      .map(([lineKey, rawLine]) => {
        const lineObj = getRecord(rawLine);
        const loss = getRecord(lineObj?.loss_ratio);

        return {
          key: lineKey,
          label: formatLineLabel(lineKey, lineObj?.label),
          ratio12: getNumber(loss?.adj_loss_ratio_12mm),
          ratio24: getNumber(loss?.adj_loss_ratio_24mm),
        };
      })
      .sort((a, b) => (b.ratio12 ?? -1) - (a.ratio12 ?? -1));
  }, [latestParsedLines]);

  const alertRows = lobRows.filter((row) => (row.ratio12 ?? 0) > 0.5);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Loss Ratio Trend</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `${value.toFixed(2)}%`} />
                <ReferenceArea y1={0} y2={40} fill="hsl(142 76% 36%)" fillOpacity={0.08} />
                <ReferenceArea y1={50} y2={100} fill="hsl(0 84% 60%)" fillOpacity={0.08} />
                <Area type="monotone" dataKey="lossRatio12" stroke="hsl(188 87% 47%)" fill="hsl(188 87% 47%)" fillOpacity={0.12} strokeWidth={2.2} />
                <Line type="monotone" dataKey="lossRatio24" stroke="hsl(31 95% 55%)" strokeWidth={2.2} strokeDasharray="5 5" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Math.round(v / 100000)}K`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => toCurrency(value)} />
                <Area type="monotone" dataKey="earnedPremium12" stroke="hsl(214 89% 60%)" fill="hsl(214 89% 60%)" fillOpacity={0.18} />
                <Line type="monotone" dataKey="paidLosses12" stroke="hsl(355 78% 60%)" strokeWidth={2.2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Line-of-Business Loss Ratios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {lobRows.map((row) => {
            const width = Math.max(0, Math.min(100, (row.ratio12 ?? 0) * 100));
            return (
              <div key={row.key} className="grid grid-cols-[180px_1fr_auto_auto] gap-3 items-center">
                <div className="text-sm font-medium">{row.label}</div>
                <div className="h-6 rounded-full bg-muted/30 overflow-hidden">
                  <div className={`${barColor(row.ratio12)} h-6 rounded-full`} style={{ width: `${width}%` }} />
                </div>
                <div className="text-sm tabular-nums w-24 text-right">{toPercent(row.ratio12)}</div>
                <div className="text-sm tabular-nums w-24 text-right text-muted-foreground">{toPercent(row.ratio24)}</div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {alertRows.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Loss ratio alert</AlertTitle>
          <AlertDescription>
            {alertRows.map((row) => `${row.label} (${toPercent(row.ratio12)})`).join(', ')} exceeded 50% in latest 12MM view.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
