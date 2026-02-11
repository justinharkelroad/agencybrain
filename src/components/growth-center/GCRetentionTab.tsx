import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { BusinessMetricsReport, BusinessMetricsSnapshot } from '@/lib/growth-center/types';

interface GCRetentionTabProps {
  snapshots: BusinessMetricsSnapshot[];
  reports: BusinessMetricsReport[];
}

type ParsedLineRetention = {
  label: string;
  current: number | null;
  variance: number | null;
};

type ParsedMonthRetention = {
  reportMonth: string;
  lines: Record<string, ParsedLineRetention>;
};

const EXCLUDED_LINE_KEYS = new Set(['total_pc', 'total_personal_lines']);

function toMonthLabel(value: string): string {
  const d = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function toPercent(v: number | null | undefined): string {
  if (v === null || v === undefined) return '--';
  return `${(v * 100).toFixed(2)}%`;
}

function toPoints(v: number | null | undefined): string {
  if (v === null || v === undefined) return '--';
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)} pts`;
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

function parseRetentionByMonth(reports: BusinessMetricsReport[]): ParsedMonthRetention[] {
  return reports
    .filter((report) => report.parse_status === 'parsed')
    .map((report) => {
      const parsedData = getRecord(report.parsed_data);
      const lines = getRecord(parsedData?.lines);
      if (!lines) return null;

      const monthLines: Record<string, ParsedLineRetention> = {};

      for (const [lineKey, rawLine] of Object.entries(lines)) {
        if (EXCLUDED_LINE_KEYS.has(lineKey)) continue;

        const line = getRecord(rawLine);
        if (!line) continue;

        const retention = getRecord(line.retention);

        monthLines[lineKey] = {
          label: formatLineLabel(lineKey, line.label),
          current: getNumber(retention?.current_month),
          variance: getNumber(retention?.point_variance_py),
        };
      }

      return {
        reportMonth: report.report_month,
        lines: monthLines,
      };
    })
    .filter((v): v is ParsedMonthRetention => v !== null)
    .sort((a, b) => a.reportMonth.localeCompare(b.reportMonth));
}

function heatmapClass(value: number | null): string {
  if (value === null) return 'bg-muted/10 text-muted-foreground';
  const points = value * 100;
  if (points >= 1.0) return 'bg-emerald-500/20 text-emerald-400';
  if (points >= 0) return 'bg-emerald-500/10 text-emerald-400';
  if (points >= -0.5) return 'bg-amber-500/10 text-amber-400';
  if (points < -5.0) return 'bg-red-500/30 text-red-300 font-bold';
  return 'bg-red-500/20 text-red-400';
}

export function GCRetentionTab({ snapshots, reports }: GCRetentionTabProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>('latest');
  const parsedMonths = useMemo(() => parseRetentionByMonth(reports), [reports]);

  const selectedMonthData = useMemo(() => {
    if (parsedMonths.length === 0) return null;
    if (selectedMonth === 'latest') return parsedMonths[parsedMonths.length - 1];
    return parsedMonths.find((m) => m.reportMonth === selectedMonth) ?? parsedMonths[parsedMonths.length - 1];
  }, [parsedMonths, selectedMonth]);

  const latestTwoSnapshots = useMemo(
    () => [...snapshots].sort((a, b) => a.report_month.localeCompare(b.report_month)).slice(-2),
    [snapshots]
  );

  const retentionBars = useMemo(() => {
    if (!selectedMonthData) return [];

    return Object.entries(selectedMonthData.lines)
      .map(([key, values]) => ({
        key,
        label: values.label,
        current: values.current,
        variance: values.variance,
      }))
      .sort((a, b) => Math.abs(b.current ?? 0) - Math.abs(a.current ?? 0));
  }, [selectedMonthData]);

  const biggestGaps = useMemo(
    () =>
      [...retentionBars]
        .filter((row) => row.variance !== null)
        .sort((a, b) => (a.variance ?? Number.POSITIVE_INFINITY) - (b.variance ?? Number.POSITIVE_INFINITY))
        .slice(0, 3),
    [retentionBars]
  );

  const heatmapMonths = parsedMonths.slice(-12);

  const heatmapLines = useMemo(() => {
    const keyToLabel = new Map<string, string>();

    for (const month of heatmapMonths) {
      for (const [key, values] of Object.entries(month.lines)) {
        if (!keyToLabel.has(key)) {
          keyToLabel.set(key, values.label);
        }
      }
    }

    return Array.from(keyToLabel.entries()).map(([key, label]) => ({ key, label }));
  }, [heatmapMonths]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-medium">Retention by Line of Business</CardTitle>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[170px] h-8">
                <SelectValue placeholder="Latest" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Latest</SelectItem>
                {parsedMonths.map((m) => (
                  <SelectItem key={m.reportMonth} value={m.reportMonth}>
                    {toMonthLabel(m.reportMonth)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {retentionBars.map((row) => {
            const pct = row.current ? Math.max(0, Math.min(100, row.current * 100)) : 0;
            const positive = (row.variance ?? 0) >= 0;
            return (
              <div key={row.key} className="grid grid-cols-[160px_1fr_auto_auto] gap-3 items-center">
                <div className="text-sm font-medium">{row.label}</div>
                <div className="h-6 rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className="h-6 rounded-full bg-primary/70"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-sm font-medium tabular-nums w-20 text-right">
                  {toPercent(row.current)}
                </div>
                <Badge variant="secondary" className={cn('tabular-nums', positive ? 'text-emerald-400' : 'text-red-400')}>
                  {toPoints(row.variance)}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Retention by Tenure</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">0-2 Years</TableHead>
                <TableHead className="text-right">2-5 Years</TableHead>
                <TableHead className="text-right">5+ Years</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {latestTwoSnapshots.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{toMonthLabel(s.report_month)}</TableCell>
                  <TableCell className="text-right tabular-nums">{toPercent(s.retention_0_2_years)}</TableCell>
                  <TableCell className="text-right tabular-nums">{toPercent(s.retention_2_5_years)}</TableCell>
                  <TableCell className="text-right tabular-nums">{toPercent(s.retention_5_plus_years)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Retention PY Variance Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-xs border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="text-left sticky left-0 bg-background z-10 p-2 w-[160px]">Line</th>
                  {heatmapMonths.map((m) => (
                    <th key={m.reportMonth} className="text-center p-2 min-w-[60px]">{toMonthLabel(m.reportMonth).split(' ')[0]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapLines.map((line) => (
                  <tr key={line.key}>
                    <td className="text-left text-sm font-medium sticky left-0 bg-background z-10 p-2">{line.label}</td>
                    {heatmapMonths.map((m) => {
                      const variance = m.lines[line.key]?.variance ?? null;
                      return (
                        <td
                          key={`${line.key}-${m.reportMonth}`}
                          className={cn('h-10 text-center tabular-nums rounded', heatmapClass(variance))}
                        >
                          {toPoints(variance)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Biggest Retention Gaps (Latest Month)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {biggestGaps.map((row, index) => (
            <div key={row.key} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-lg font-bold text-muted-foreground/40 w-8">{index + 1}.</div>
                <div className="font-medium">{row.label}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className={cn('tabular-nums', (row.variance ?? 0) < 0 ? 'text-red-400' : 'text-emerald-400')}>
                  {toPoints(row.variance)} vs PY
                </Badge>
                <div className="text-sm text-muted-foreground tabular-nums w-24 text-right">
                  {toPercent(row.current)}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
