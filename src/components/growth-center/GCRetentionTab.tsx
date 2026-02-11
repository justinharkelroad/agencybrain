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
  current: number | null;
  variance: number | null;
};

type ParsedMonthRetention = {
  reportMonth: string;
  lines: Record<string, ParsedLineRetention>;
};

const LINE_CONFIG: Array<{ key: string; label: string }> = [
  { key: 'standard_auto', label: 'Standard Auto' },
  { key: 'homeowners', label: 'Homeowners' },
  { key: 'renters', label: 'Renters' },
  { key: 'condo', label: 'Condo' },
  { key: 'other_special_property', label: 'Other Special' },
];

function toMonthLabel(value: string): string {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function toPercent(v: number | null | undefined): string {
  if (v === null || v === undefined) return '--';
  return `${(v * 100).toFixed(2)}%`;
}

function toPoints(v: number | null | undefined): string {
  if (v === null || v === undefined) return '--';
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}`;
}

function getRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseRetentionByMonth(reports: BusinessMetricsReport[]): ParsedMonthRetention[] {
  return reports
    .map((report) => {
      const parsedData = getRecord(report.parsed_data);
      const lines = getRecord(parsedData?.lines);
      if (!lines) return null;

      const monthLines: Record<string, ParsedLineRetention> = {};
      for (const line of LINE_CONFIG) {
        const lineObj = getRecord(lines[line.key]);
        const retention = getRecord(lineObj?.retention);
        monthLines[line.key] = {
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
    .sort((a, b) => new Date(a.reportMonth).getTime() - new Date(b.reportMonth).getTime());
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

  const latestTwoSnapshots = snapshots.slice(-2);
  const retentionBars = useMemo(() => {
    if (!selectedMonthData) return [];
    return LINE_CONFIG.map((line) => ({
      key: line.key,
      label: line.label,
      current: selectedMonthData.lines[line.key]?.current ?? null,
      variance: selectedMonthData.lines[line.key]?.variance ?? null,
    }));
  }, [selectedMonthData]);

  const biggestGaps = useMemo(
    () =>
      [...retentionBars]
        .sort((a, b) => (a.variance ?? Number.POSITIVE_INFINITY) - (b.variance ?? Number.POSITIVE_INFINITY))
        .slice(0, 3),
    [retentionBars]
  );

  const heatmapMonths = parsedMonths.slice(-12);

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
              <div key={row.key} className="grid grid-cols-[140px_1fr_auto_auto] gap-3 items-center">
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
                  <th className="text-left sticky left-0 bg-background z-10 p-2 w-[140px]">Line</th>
                  {heatmapMonths.map((m) => (
                    <th key={m.reportMonth} className="text-center p-2 min-w-[60px]">{toMonthLabel(m.reportMonth).split(' ')[0]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LINE_CONFIG.map((line) => (
                  <tr key={line.key}>
                    <td className="text-left text-sm font-medium sticky left-0 bg-background z-10 p-2">{line.label}</td>
                    {heatmapMonths.map((m) => {
                      const variance = m.lines[line.key]?.variance ?? null;
                      return (
                        <td
                          key={`${line.key}-${m.reportMonth}`}
                          className={cn('h-10 text-center tabular-nums rounded', heatmapClass(variance))}
                        >
                          {variance === null ? '--' : toPoints(variance)}
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
                  {toPoints(row.variance)} pts vs PY
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
