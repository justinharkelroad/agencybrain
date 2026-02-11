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

const LINE_CONFIG: Array<{ key: string; label: string }> = [
  { key: 'standard_auto', label: 'Standard Auto' },
  { key: 'homeowners', label: 'Homeowners' },
  { key: 'renters', label: 'Renters' },
  { key: 'condo', label: 'Condo' },
  { key: 'other_special_property', label: 'Other Special' },
];

function toMonthLabel(reportMonth: string): string {
  const d = new Date(reportMonth);
  if (!Number.isFinite(d.getTime())) return reportMonth;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
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

export function GCPremiumTab({ snapshots, reports }: GCPremiumTabProps) {
  const trendData = useMemo(
    () =>
      snapshots.map((s) => ({
        month: toMonthLabel(s.report_month),
        newPremium: s.premium_current_month_new ?? 0,
        renewalPremium: s.premium_current_month_renewal ?? 0,
      })),
    [snapshots]
  );

  const parsedReports = useMemo(
    () => reports.filter((report) => report.parse_status === 'parsed'),
    [reports]
  );

  const latestReport = parsedReports[0] ?? null;
  const latestParsedLines = useMemo(() => {
    const parsedData = getRecord(latestReport?.parsed_data);
    return getRecord(parsedData?.lines);
  }, [latestReport]);

  const previousReport = parsedReports[1] ?? null;
  const previousParsedLines = useMemo(() => {
    const parsedData = getRecord(previousReport?.parsed_data);
    return getRecord(parsedData?.lines);
  }, [previousReport]);

  const lobRows = useMemo<LobPremiumRow[]>(() => {
    return LINE_CONFIG.map((line) => {
      const currentLine = getRecord(latestParsedLines?.[line.key]);
      const currentPremium = getRecord(currentLine?.premium);
      const currentCents = getNumber(currentPremium?.current_month_total_cents);

      const prevLine = getRecord(previousParsedLines?.[line.key]);
      const prevPremium = getRecord(prevLine?.premium);
      const prevCents = getNumber(prevPremium?.current_month_total_cents);

      const delta = currentCents !== null && prevCents !== null ? currentCents - prevCents : null;
      const pctChange =
        delta !== null && prevCents !== null && prevCents !== 0
          ? delta / prevCents
          : null;

      return {
        key: line.key,
        label: line.label,
        currentMonthCents: currentCents,
        lastMonthCents: prevCents,
        deltaCents: delta,
        pctChange,
      };
    }).sort((a, b) => Math.abs(b.deltaCents ?? 0) - Math.abs(a.deltaCents ?? 0));
  }, [latestParsedLines, previousParsedLines]);

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
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                  }}
                />
                <Area type="monotone" dataKey="newPremium" stackId="premium" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.3} />
                <Area type="monotone" dataKey="renewalPremium" stackId="premium" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.3} />
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
            const widthPct = Math.max(0, Math.min(100, (base / Math.max(...lobRows.map((r) => r.currentMonthCents ?? 0), 1)) * 100));
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
                <TableHead className="text-right">Δ</TableHead>
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
