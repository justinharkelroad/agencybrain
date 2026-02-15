import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { BusinessMetricsReport, BusinessMetricsSnapshot } from '@/lib/growth-center/types';

interface GCPremiumTabProps {
  snapshots: BusinessMetricsSnapshot[];
  reports: BusinessMetricsReport[];
}

type LobPremiumRow = {
  key: string;
  label: string;
  currentMonthCents: number | null;
  lastMonthCents: number | null;
  deltaCents: number | null;
  pctChange: number | null;
};

const EXCLUDED_LINE_KEYS = new Set(['total_pc', 'total_personal_lines']);

function toMonthLabel(reportMonth: string): string {
  const d = new Date(`${reportMonth}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return reportMonth;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function sortByReportMonthAsc<T extends { report_month: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.report_month.localeCompare(b.report_month));
}

function sortByReportMonthDesc<T extends { report_month: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.report_month.localeCompare(a.report_month));
}

function toCurrency(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function toPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '--';
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
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

function parseLinePremiums(report: BusinessMetricsReport | null): Record<string, { label: string; currentMonthTotalCents: number | null }> {
  const parsedData = getRecord(report?.parsed_data);
  const lines = getRecord(parsedData?.lines);
  if (!lines) return {};

  const result: Record<string, { label: string; currentMonthTotalCents: number | null }> = {};

  for (const [key, rawLine] of Object.entries(lines)) {
    if (EXCLUDED_LINE_KEYS.has(key)) continue;
    const line = getRecord(rawLine);
    if (!line) continue;
    const premium = getRecord(line.premium);

    result[key] = {
      label: formatLineLabel(key, line.label),
      currentMonthTotalCents: getNumber(premium?.current_month_total_cents),
    };
  }

  return result;
}

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  color: 'hsl(var(--popover-foreground))',
};

export function GCPremiumTab({ snapshots, reports }: GCPremiumTabProps) {
  const trendData = useMemo(
    () =>
      sortByReportMonthAsc(snapshots).map((s) => ({
        month: toMonthLabel(s.report_month),
        newPremium: s.premium_current_month_new ?? 0,
        renewalPremium: s.premium_current_month_renewal ?? 0,
      })),
    [snapshots]
  );

  const parsedReportsDesc = useMemo(
    () => sortByReportMonthDesc(reports.filter((report) => report.parse_status === 'parsed')),
    [reports]
  );

  const latestReport = parsedReportsDesc[0] ?? null;
  const previousReport = parsedReportsDesc[1] ?? null;

  const latestLinePremiums = useMemo(() => parseLinePremiums(latestReport), [latestReport]);
  const previousLinePremiums = useMemo(() => parseLinePremiums(previousReport), [previousReport]);

  const lobRows = useMemo<LobPremiumRow[]>(() => {
    const allKeys = new Set<string>([
      ...Object.keys(latestLinePremiums),
      ...Object.keys(previousLinePremiums),
    ]);

    return Array.from(allKeys)
      .map((key) => {
        const current = latestLinePremiums[key]?.currentMonthTotalCents ?? null;
        const prev = previousLinePremiums[key]?.currentMonthTotalCents ?? null;
        const delta = current !== null && prev !== null ? current - prev : null;
        const pctChange =
          delta !== null && prev !== null && prev !== 0
            ? delta / prev
            : null;

        return {
          key,
          label: latestLinePremiums[key]?.label ?? previousLinePremiums[key]?.label ?? formatLineLabel(key),
          currentMonthCents: current,
          lastMonthCents: prev,
          deltaCents: delta,
          pctChange,
        };
      })
      .sort((a, b) => Math.abs(b.currentMonthCents ?? 0) - Math.abs(a.currentMonthCents ?? 0));
  }, [latestLinePremiums, previousLinePremiums]);

  const maxCurrentCents = Math.max(...lobRows.map((r) => r.currentMonthCents ?? 0), 1);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">New vs Renewal Mix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `$${Math.round(v / 100000)}K`}
                />
                <Tooltip
                  formatter={(value: number) => toCurrency(value)}
                  contentStyle={tooltipStyle}
                />
                <Area type="monotone" dataKey="newPremium" stackId="premium" stroke="hsl(172 70% 45%)" fill="hsl(172 70% 45%)" fillOpacity={0.26} />
                <Area type="monotone" dataKey="renewalPremium" stackId="premium" stroke="hsl(214 89% 60%)" fill="hsl(214 89% 60%)" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Line-of-Business Premium Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {lobRows.map((row) => {
            const base = row.currentMonthCents ?? 0;
            const widthPct = Math.max(0, Math.min(100, (base / maxCurrentCents) * 100));
            return (
              <div key={row.key} className="grid grid-cols-[180px_1fr_auto] gap-3 items-center">
                <div className="text-sm font-medium">{row.label}</div>
                <div className="h-6 rounded-full bg-muted/30 overflow-hidden">
                  <div className="h-6 rounded-full bg-primary/70" style={{ width: `${widthPct}%` }} />
                </div>
                <div className="text-sm tabular-nums text-right w-36">{toCurrency(row.currentMonthCents)}</div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Premium Velocity Table</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Line</TableHead>
                <TableHead className="text-right">This Month</TableHead>
                <TableHead className="text-right">Last Month</TableHead>
                <TableHead className="text-right">Delta</TableHead>
                <TableHead className="text-right">% Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lobRows.map((row) => (
                <TableRow key={`velocity-${row.key}`}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{toCurrency(row.currentMonthCents)}</TableCell>
                  <TableCell className="text-right tabular-nums">{toCurrency(row.lastMonthCents)}</TableCell>
                  <TableCell className="text-right tabular-nums">{toCurrency(row.deltaCents)}</TableCell>
                  <TableCell className="text-right tabular-nums">{toPct(row.pctChange)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
