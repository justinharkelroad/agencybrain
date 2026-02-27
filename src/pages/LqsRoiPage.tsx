import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Percent,
  Target,
  Info,
  CalendarIcon,
  Download,
  Settings2,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HelpButton } from '@/components/HelpButton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { hasSalesAccess } from '@/lib/salesBetaAccess';
import { useAgencyProfile } from '@/hooks/useAgencyProfile';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  useLqsRoiAnalytics,
  DateRangePreset,
  getDateRangeFromPreset,
  LeadSourceRoiRow,
  ZipRoiRow,
} from '@/hooks/useLqsRoiAnalytics';
import { useLqsRoiExport } from '@/hooks/useLqsRoiExport';
import { LqsRoiBucketTable } from '@/components/lqs/LqsRoiBucketTable';
import { LqsProducerBreakdown } from '@/components/lqs/LqsProducerBreakdown';
import { useLqsProducerBreakdown } from '@/hooks/useLqsProducerBreakdown';
import { LqsLeadSourceDetailSheet } from '@/components/lqs/LqsLeadSourceDetailSheet';
import { LqsProducerDetailSheet } from '@/components/lqs/LqsProducerDetailSheet';
import type { ProducerViewMode } from '@/hooks/useLqsProducerDetail';
import { LqsGoalsHeader } from '@/components/lqs/LqsGoalsHeader';
import { LqsSameMonthConversion } from '@/components/lqs/LqsSameMonthConversion';
import { LqsRoiSpendBubbleChart } from '@/components/lqs/LqsRoiSpendBubbleChart';
import { LqsPerformanceTrendChart } from '@/components/lqs/LqsPerformanceTrendChart';
import { LqsTimeToCloseAnalytics } from '@/components/lqs/LqsTimeToCloseAnalytics';
import { LqsProducerLeadSourceCrossTab } from '@/components/lqs/LqsProducerLeadSourceCrossTab';
import { useLqsProducerLeadSourceCrossTab } from '@/hooks/useLqsProducerLeadSourceCrossTab';
import { LqsObjectionAnalysis } from '@/components/lqs/LqsObjectionAnalysis';
import { StaffRankingTable } from '@/components/lqs/StaffRankingTable';
import { ZipCodePerformanceTable } from '@/components/lqs/ZipCodePerformanceTable';
import { ActivityHistoryTable } from '@/components/lqs/ActivityHistoryTable';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { differenceInDays } from 'date-fns';

// Format currency from cents
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

// Format percentage
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Format ROI
function formatRoi(value: number | null): string {
  if (value === null) return '∞';
  return `${value.toFixed(2)}x`;
}

type LeaderboardMetric = 'closeRate' | 'premiumCents' | 'writtenPolicies' | 'writtenItems' | 'policyAcqCost' | 'itemAcqCost';

type LeaderboardDirection = 'high' | 'low';

interface MetricOption {
  value: LeaderboardMetric;
  label: string;
  direction: LeaderboardDirection;
}

const LEADERBOARD_METRICS: MetricOption[] = [
  { value: 'closeRate', label: 'Close Rate', direction: 'high' },
  { value: 'premiumCents', label: 'Premium Sold', direction: 'high' },
  { value: 'writtenPolicies', label: 'Policies Sold', direction: 'high' },
  { value: 'writtenItems', label: 'Items Sold', direction: 'high' },
  { value: 'policyAcqCost', label: 'Cost / Policy', direction: 'low' },
  { value: 'itemAcqCost', label: 'Cost / Item', direction: 'low' },
];

const LEADERBOARD_METRIC_OPTIONS = {
  leadSource: LEADERBOARD_METRICS,
  zip: LEADERBOARD_METRICS,
};

const TOP_LEADERBOARD_COUNT = 5;
const TOP_LEADERBOARD_MAX_COUNT = 20;
const ROI_FLAG_SETTINGS_STORAGE_KEY = 'lqs-roi-auto-flag-settings';

interface RoiFlagSettings {
  enabled: boolean;
  leadSourceMetric: LeaderboardMetric;
  zipMetric: LeaderboardMetric;
  leadSourceMinimumSample: number;
  zipMinimumSample: number;
  topCount: number;
  showPriorityZipBadges: boolean;
}

const DEFAULT_ROI_FLAG_SETTINGS: RoiFlagSettings = {
  enabled: true,
  leadSourceMetric: 'closeRate',
  zipMetric: 'closeRate',
  leadSourceMinimumSample: 3,
  zipMinimumSample: 5,
  topCount: 5,
  showPriorityZipBadges: true,
};

function isValidLeaderboardMetric(value: unknown): value is LeaderboardMetric {
  return (
    value === 'closeRate' ||
    value === 'premiumCents' ||
    value === 'writtenPolicies' ||
    value === 'writtenItems' ||
    value === 'policyAcqCost' ||
    value === 'itemAcqCost'
  );
}

function sanitizeNumber(value: unknown, fallback: number, min = 1) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  return Math.floor(parsed);
}

function getFlagsSettingsStorageKey(agencyId: string | null) {
  return `${ROI_FLAG_SETTINGS_STORAGE_KEY}-${agencyId || 'global'}`;
}

function parseBoundedIntegerInput(value: string, fallback: number, min = 1) {
  const trimmed = value.trim();
  if (trimmed.length === 0) return fallback;
  const parsed = parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, parsed);
}

const LEAD_SOURCE_MINIMUMS = {
  closeRate: (row: LeadSourceRoiRow) => row.totalQuotes,
  premiumCents: (row: LeadSourceRoiRow) => row.totalSales,
  writtenPolicies: (row: LeadSourceRoiRow) => row.totalSales,
  writtenItems: (row: LeadSourceRoiRow) => row.totalSales,
  policyAcqCost: (row: LeadSourceRoiRow) => row.writtenPolicies,
  itemAcqCost: (row: LeadSourceRoiRow) => row.writtenItems,
};

const ZIP_MINIMUMS = {
  closeRate: (row: ZipRoiRow) => row.totalQuotes,
  premiumCents: (row: ZipRoiRow) => row.totalSales,
  writtenPolicies: (row: ZipRoiRow) => row.totalSales,
  writtenItems: (row: ZipRoiRow) => row.totalSales,
  policyAcqCost: (row: ZipRoiRow) => row.writtenPolicies,
  itemAcqCost: (row: ZipRoiRow) => row.writtenItems,
};

function getLeadSourceMetricValue(row: LeadSourceRoiRow, metric: LeaderboardMetric): number | null {
  switch (metric) {
    case 'closeRate':
      return row.closeRatio;
    case 'premiumCents':
      return row.premiumCents;
    case 'writtenPolicies':
      return row.writtenPolicies;
    case 'writtenItems':
      return row.writtenItems;
    case 'policyAcqCost':
      return row.policyAcqCost;
    case 'itemAcqCost':
      return row.itemAcqCost;
    default:
      return null;
  }
}

function getZipMetricValue(row: ZipRoiRow, metric: LeaderboardMetric): number | null {
  switch (metric) {
    case 'closeRate':
      return row.closeRatio;
    case 'premiumCents':
      return row.premiumCents;
    case 'writtenPolicies':
      return row.writtenPolicies;
    case 'writtenItems':
      return row.writtenItems;
    case 'policyAcqCost':
      return row.policyAcqCost;
    case 'itemAcqCost':
      return row.itemAcqCost;
    default:
      return null;
  }
}

function formatLeaderboardValue(metric: LeaderboardMetric, value: number): string {
  switch (metric) {
    case 'closeRate':
      return formatPercent(value);
    case 'premiumCents':
      return formatCurrency(value);
    case 'writtenPolicies':
    case 'writtenItems':
      return value.toLocaleString();
    case 'policyAcqCost':
    case 'itemAcqCost':
      return formatCurrency(value);
  }
}

function getTopRows<T>(
  data: T[],
  metric: LeaderboardMetric,
  getValue: (row: T, metric: LeaderboardMetric) => number | null,
  getMinimum: (row: T, metric: LeaderboardMetric) => number,
  direction: LeaderboardDirection,
  minimumSample = 3,
  maxCount = TOP_LEADERBOARD_COUNT,
) {
  const withValue = data
    .map((row) => ({
      row,
      value: getValue(row, metric),
      minimum: getMinimum(row, metric),
    }))
    .filter(item => {
      if (item.value === null || Number.isNaN(item.value)) return false;
      if (item.value <= 0) return false;
      if (item.minimum < minimumSample) return false;
      return true;
    })
    .sort((a, b) => {
      if (direction === 'high') {
        return b.value! - a.value!;
      }
      return a.value! - b.value!;
    });

  return withValue.slice(0, maxCount);
}

function TopLeadSourceCallout({
  data,
  metric,
  isLoading,
  onMetricChange,
  flaggedRows,
  minimumSample = 3,
  maxRows = TOP_LEADERBOARD_COUNT,
}: {
  data: LeadSourceRoiRow[];
  metric: LeaderboardMetric;
  isLoading: boolean;
  onMetricChange: (metric: LeaderboardMetric) => void;
  flaggedRows?: Set<string | null>;
  minimumSample?: number;
  maxRows?: number;
}) {
  const metricConfig = LEADERBOARD_METRIC_OPTIONS.leadSource.find((m) => m.value === metric) ?? LEADERBOARD_METRIC_OPTIONS.leadSource[0];
  const topRows = getTopRows(
    data,
    metric,
    getLeadSourceMetricValue,
    (row, metricId) => LEAD_SOURCE_MINIMUMS[metricId](row),
    metricConfig.direction,
    minimumSample,
    maxRows,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Top {maxRows} Lead Sources by {metricConfig.label}
          </span>
          <div className="flex items-center gap-2">
            <Label htmlFor="lead-source-metric" className="text-sm text-muted-foreground whitespace-nowrap">
              Sort by:
            </Label>
            <Select
              value={metric}
              onValueChange={(value) => onMetricChange(value as LeaderboardMetric)}
            >
              <SelectTrigger id="lead-source-metric" className="w-[205px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEADERBOARD_METRIC_OPTIONS.leadSource.map((metricOption) => (
                  <SelectItem key={`lead-${metricOption.value}`} value={metricOption.value}>
                    {metricOption.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
            <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Lead Source</TableHead>
                <TableHead className="text-right">{metricConfig.label}</TableHead>
                <TableHead className="w-20 text-right">Auto-flag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: Math.max(1, maxRows) }).map((_, i) => (
                  <TableRow key={`lead-skeleton-${i}`}>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : topRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    No lead-source data available
                  </TableCell>
                </TableRow>
              ) : (
                topRows.map((item, index) => (
                  <TableRow key={item.row.leadSourceId || `unattributed-${index}`}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{item.row.leadSourceName}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatLeaderboardValue(metric, item.value!)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(flaggedRows?.has(item.row.leadSourceId) ?? false) && (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Priority
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function TopZipCallout({
  data,
  metric,
  isLoading,
  onMetricChange,
  minimumSample = 3,
  maxRows = TOP_LEADERBOARD_COUNT,
  flaggedRows,
}: {
  data: ZipRoiRow[];
  metric: LeaderboardMetric;
  isLoading: boolean;
  onMetricChange: (metric: LeaderboardMetric) => void;
  minimumSample?: number;
  maxRows?: number;
  flaggedRows?: Set<string>;
}) {
  const metricConfig = LEADERBOARD_METRIC_OPTIONS.zip.find((m) => m.value === metric) ?? LEADERBOARD_METRIC_OPTIONS.zip[0];
  const topRows = getTopRows(
    data,
    metric,
    getZipMetricValue,
    (row, metricId) => ZIP_MINIMUMS[metricId](row),
    metricConfig.direction,
    minimumSample,
    maxRows,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Top {maxRows} ZIP Codes by {metricConfig.label}
          </span>
          <div className="flex items-center gap-2">
            <Label htmlFor="zip-metric" className="text-sm text-muted-foreground whitespace-nowrap">
              Sort by:
            </Label>
            <Select
              value={metric}
              onValueChange={(value) => onMetricChange(value as LeaderboardMetric)}
            >
              <SelectTrigger id="zip-metric" className="w-[205px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEADERBOARD_METRIC_OPTIONS.zip.map((metricOption) => (
                  <SelectItem key={`zip-${metricOption.value}`} value={metricOption.value}>
                    {metricOption.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-muted-foreground">Spend shown is lead-source allocated</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
            <TableRow>
                <TableHead>#</TableHead>
                <TableHead>ZIP</TableHead>
                <TableHead className="text-right">{metricConfig.label}</TableHead>
                <TableHead className="w-20 text-right">Auto-flag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: Math.max(1, maxRows) }).map((_, i) => (
                  <TableRow key={`zip-skeleton-${i}`}>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : topRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    No ZIP-code data available
                  </TableCell>
                </TableRow>
              ) : (
                topRows.map((item, index) => (
                  <TableRow key={`zip-${item.row.zipCode}-${index}`}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{item.row.zipCode}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatLeaderboardValue(metric, item.value!)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(flaggedRows?.has(item.row.zipCode) ?? false) && (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Priority
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// Conversion Funnel Component - Uses openLeads (status='lead') not total households
function ConversionFunnel({ 
  openLeads, 
  quotedHouseholds, 
  soldHouseholds, 
  quoteRate, 
  closeRate,
  isActivityView,
  leadsReceived,
  quotesCreated,
  salesClosed,
}: { 
  openLeads: number; 
  quotedHouseholds: number; 
  soldHouseholds: number; 
  quoteRate: number | null; 
  closeRate: number | null;
  isActivityView: boolean;
  leadsReceived: number;
  quotesCreated: number;
  salesClosed: number;
}) {
  // Use appropriate values based on view mode
  const topValue = isActivityView ? leadsReceived : openLeads;
  const midValue = isActivityView ? quotesCreated : quotedHouseholds;
  const botValue = isActivityView ? salesClosed : soldHouseholds;
  
  // Labels based on view mode
  const topLabel = isActivityView ? 'LEADS RECEIVED' : 'OPEN LEADS';
  const midLabel = isActivityView ? 'QUOTES CREATED' : 'QUOTED HH';
  const botLabel = isActivityView ? 'SALES CLOSED' : 'SOLD HH';

  // Calculate widths based on the largest value
  const maxCount = Math.max(topValue, midValue, botValue, 1);
  const topWidth = 100;
  const midWidth = Math.max(30, (midValue / maxCount) * 100);
  const botWidth = Math.max(20, (botValue / maxCount) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {isActivityView ? 'Activity Summary' : 'Conversion Funnel'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center space-y-3">
          {/* Top of funnel */}
          <div 
            className="bg-blue-500/20 border border-blue-500/40 rounded-lg py-4 px-6 text-center transition-all"
            style={{ width: `${topWidth}%` }}
          >
            <div className="text-2xl font-bold text-blue-400">{topValue.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">{topLabel}</div>
          </div>
          
          {/* Arrow with quote rate - hide in activity view */}
          {!isActivityView && quoteRate !== null && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-blue-500/50"></div>
              <span className="text-sm font-medium">{formatPercent(quoteRate)} quote rate</span>
            </div>
          )}
          {isActivityView && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-blue-500/50"></div>
            </div>
          )}
          
          {/* Middle of funnel */}
          <div 
            className="bg-amber-500/20 border border-amber-500/40 rounded-lg py-4 px-6 text-center transition-all"
            style={{ width: `${midWidth}%` }}
          >
            <div className="text-2xl font-bold text-amber-400">{midValue.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">{midLabel}</div>
          </div>
          
          {/* Arrow with close rate - hide in activity view */}
          {!isActivityView && closeRate !== null && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-amber-500/50"></div>
              <span className="text-sm font-medium">{formatPercent(closeRate)} close rate</span>
            </div>
          )}
          {isActivityView && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-amber-500/50"></div>
            </div>
          )}
          
          {/* Bottom of funnel */}
          <div 
            className="bg-green-500/20 border border-green-500/40 rounded-lg py-4 px-6 text-center transition-all"
            style={{ width: `${botWidth}%` }}
          >
            <div className="text-2xl font-bold text-green-400">{botValue.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">{botLabel}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Summary Card Component with optional tooltip
function SummaryCard({
  title,
  value,
  icon: Icon,
  variant = 'default',
  tooltip,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  variant?: 'default' | 'success' | 'warning' | 'info';
  tooltip?: string;
}) {
  const variantStyles = {
    default: 'text-foreground',
    success: 'text-green-500',
    warning: 'text-amber-500',
    info: 'text-blue-500',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              {tooltip && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-[200px]">{tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className={`text-2xl font-bold ${variantStyles[variant]}`}>{value}</p>
          </div>
          <Icon className={`h-8 w-8 ${variantStyles[variant]} opacity-50`} />
        </div>
      </CardContent>
    </Card>
  );
}

// Lead Source ROI Table Component
function LeadSourceTable({ data, isLoading }: { data: LeadSourceRoiRow[]; isLoading: boolean }) {
  const [sortField, setSortField] = useState<keyof LeadSourceRoiRow>('premiumCents');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortField] ?? 0;
    const bVal = b[sortField] ?? 0;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === 'asc' 
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  const handleSort = (field: keyof LeadSourceRoiRow) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lead Source ROI</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Lead Source ROI
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('leadSourceName')}
                >
                  Lead Source {sortField === 'leadSourceName' && (sortDir === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('spendCents')}
                >
                  Spend {sortField === 'spendCents' && (sortDir === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('totalLeads')}
                >
                  Leads {sortField === 'totalLeads' && (sortDir === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('totalQuotes')}
                >
                  Quoted HH {sortField === 'totalQuotes' && (sortDir === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('totalSales')}
                >
                  Sales {sortField === 'totalSales' && (sortDir === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('premiumCents')}
                >
                  Premium {sortField === 'premiumCents' && (sortDir === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('roi')}
                >
                  ROI {sortField === 'roi' && (sortDir === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('costPerSale')}
                >
                  Cost/Sale {sortField === 'costPerSale' && (sortDir === 'asc' ? '↑' : '↓')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No data available for the selected period
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((row) => (
                  <TableRow key={row.leadSourceId || 'unattributed'}>
                    <TableCell className="font-medium">
                      {row.leadSourceName}
                      {row.leadSourceId === null && (
                        <span className="ml-2 text-xs text-muted-foreground">(no source assigned)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(row.spendCents)}</TableCell>
                    <TableCell className="text-right">{row.totalLeads.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{row.totalQuotes.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{row.totalSales.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium text-green-500">
                      {formatCurrency(row.premiumCents)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={row.roi !== null && row.roi >= 1 ? 'text-green-500' : row.roi !== null ? 'text-amber-500' : ''}>
                        {formatRoi(row.roi)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.costPerSale !== null ? formatCurrency(row.costPerSale) : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

const ROI_TABS = ['overview', 'lead-sources', 'zip-codes', 'producers', 'activity', 'insights'] as const;
type RoiTab = typeof ROI_TABS[number];

export default function LqsRoiPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = (ROI_TABS.includes(searchParams.get('tab') as RoiTab)
    ? searchParams.get('tab')
    : 'overview') as RoiTab;

  const handleTabChange = (value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value === 'overview') {
        next.delete('tab');
      } else {
        next.set('tab', value);
      }
      return next;
    }, { replace: true });
  };
  
  const [datePreset, setDatePreset] = useState<DateRangePreset | 'custom'>('all');
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [commissionRate, setCommissionRate] = useState<string>('22');
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [roiFlagSettings, setRoiFlagSettings] = useState<RoiFlagSettings>(DEFAULT_ROI_FLAG_SETTINGS);
  const [roiFlagInputValues, setRoiFlagInputValues] = useState({
    topCount: String(DEFAULT_ROI_FLAG_SETTINGS.topCount),
    leadSourceMinimumSample: String(DEFAULT_ROI_FLAG_SETTINGS.leadSourceMinimumSample),
    zipMinimumSample: String(DEFAULT_ROI_FLAG_SETTINGS.zipMinimumSample),
  });

  // Lead source detail sheet state
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedLeadSourceId, setSelectedLeadSourceId] = useState<string | null | undefined>(undefined);

  // Producer detail sheet state
  const [producerDetailSheetOpen, setProducerDetailSheetOpen] = useState(false);
  const [selectedProducerId, setSelectedProducerId] = useState<string | null | undefined>(undefined);
  const [producerViewMode, setProducerViewMode] = useState<ProducerViewMode>('quotedBy');

  // Handler for lead source click
  const handleLeadSourceClick = (leadSourceId: string | null) => {
    setSelectedLeadSourceId(leadSourceId);
    setDetailSheetOpen(true);
  };

  // Handler for producer click
  const handleProducerClick = (teamMemberId: string | null, viewMode: ProducerViewMode) => {
    setSelectedProducerId(teamMemberId);
    setProducerViewMode(viewMode);
    setProducerDetailSheetOpen(true);
  };

  // Get date range from preset or use custom
  const dateRange = datePreset === 'custom' 
    ? customDateRange 
    : getDateRangeFromPreset(datePreset as DateRangePreset);
  
  const { data: agencyProfile, isLoading: agencyLoading } = useAgencyProfile(user?.id, 'Manager');
  const flagSettingsKey = getFlagsSettingsStorageKey(agencyProfile?.agencyId ?? null);

  useEffect(() => {
    if (!flagSettingsKey) return;
    try {
      const raw = localStorage.getItem(flagSettingsKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;

      setRoiFlagSettings({
        enabled: Boolean(parsed.enabled),
        leadSourceMetric: isValidLeaderboardMetric(parsed.leadSourceMetric)
          ? parsed.leadSourceMetric
          : DEFAULT_ROI_FLAG_SETTINGS.leadSourceMetric,
        zipMetric: isValidLeaderboardMetric(parsed.zipMetric)
          ? parsed.zipMetric
          : DEFAULT_ROI_FLAG_SETTINGS.zipMetric,
        leadSourceMinimumSample: sanitizeNumber(parsed.leadSourceMinimumSample, DEFAULT_ROI_FLAG_SETTINGS.leadSourceMinimumSample, 1),
        zipMinimumSample: sanitizeNumber(parsed.zipMinimumSample, DEFAULT_ROI_FLAG_SETTINGS.zipMinimumSample, 1),
        topCount: Math.min(
          TOP_LEADERBOARD_MAX_COUNT,
          sanitizeNumber(parsed.topCount, DEFAULT_ROI_FLAG_SETTINGS.topCount, 1),
        ),
        showPriorityZipBadges: typeof parsed.showPriorityZipBadges === 'boolean'
          ? parsed.showPriorityZipBadges
          : DEFAULT_ROI_FLAG_SETTINGS.showPriorityZipBadges,
      });
    } catch {
      // Keep defaults if localStorage is malformed
    }
  }, [flagSettingsKey]);

  useEffect(() => {
    setRoiFlagInputValues({
      topCount: String(roiFlagSettings.topCount),
      leadSourceMinimumSample: String(roiFlagSettings.leadSourceMinimumSample),
      zipMinimumSample: String(roiFlagSettings.zipMinimumSample),
    });
  }, [roiFlagSettings.topCount, roiFlagSettings.leadSourceMinimumSample, roiFlagSettings.zipMinimumSample]);

  useEffect(() => {
    if (!flagSettingsKey) return;
    localStorage.setItem(flagSettingsKey, JSON.stringify(roiFlagSettings));
  }, [roiFlagSettings, flagSettingsKey]);
  
  const { data: analytics, isLoading: analyticsLoading, error, refetch } = useLqsRoiAnalytics(
    agencyProfile?.agencyId ?? null,
    dateRange
  );

  const leadSourceAutoFlags = useMemo(() => {
    if (!analytics?.byLeadSource) return [];
    const metric = roiFlagSettings.leadSourceMetric;
    const metricConfig = LEADERBOARD_METRIC_OPTIONS.leadSource.find((m) => m.value === metric) ?? LEADERBOARD_METRICS[0];
    return getTopRows(
      analytics.byLeadSource,
      metric,
      getLeadSourceMetricValue,
      (row, metricId) => LEAD_SOURCE_MINIMUMS[metricId](row),
      metricConfig.direction,
      roiFlagSettings.leadSourceMinimumSample,
      roiFlagSettings.topCount
    );
  }, [analytics?.byLeadSource, roiFlagSettings]);

  const zipAutoFlags = useMemo(() => {
    if (!analytics?.byZipCode) return [];
    const metric = roiFlagSettings.zipMetric;
    const metricConfig = LEADERBOARD_METRIC_OPTIONS.zip.find((m) => m.value === metric) ?? LEADERBOARD_METRICS[0];
    return getTopRows(
      analytics.byZipCode,
      metric,
      getZipMetricValue,
      (row, metricId) => ZIP_MINIMUMS[metricId](row),
      metricConfig.direction,
      roiFlagSettings.zipMinimumSample,
      roiFlagSettings.topCount
    );
  }, [analytics?.byZipCode, roiFlagSettings]);

  const flaggedLeadSourceIds = useMemo(
    () => new Set(leadSourceAutoFlags.map(item => item.row.leadSourceId)),
    [leadSourceAutoFlags]
  );

  const flaggedZipCodes = useMemo(
    () => zipAutoFlags.map(item => item.row.zipCode),
    [zipAutoFlags]
  );

  const flaggedZipCodeSet = useMemo(
    () => new Set(flaggedZipCodes),
    [flaggedZipCodes]
  );

  const priorityZipRanks = useMemo(() => {
    return zipAutoFlags.reduce<Record<string, number>>((acc, item, index) => {
      acc[item.row.zipCode] = index + 1;
      return acc;
    }, {});
  }, [zipAutoFlags]);

  // Producer breakdown data
  const { data: producerData, isLoading: producerLoading } = useLqsProducerBreakdown(
    agencyProfile?.agencyId ?? null,
    dateRange
  );

  // Cross-tab data for per-staff lead source rows
  const { buildCrossTab } = useLqsProducerLeadSourceCrossTab(
    agencyProfile?.agencyId ?? null,
    dateRange
  );

  // Build cross-tab by lead source (not bucket) for per-staff expandable rows
  const crossTabBySource = useMemo(
    () => buildCrossTab(false),
    [buildCrossTab]
  );

  // Fetch agency goals
  const agencyGoalsQuery = useQuery({
    queryKey: ['lqs-agency-goals', agencyProfile?.agencyId],
    enabled: !!agencyProfile?.agencyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agencies')
        .select('daily_quoted_households_target, daily_sold_items_target, daily_written_premium_target_cents')
        .eq('id', agencyProfile!.agencyId)
        .single();

      if (error) throw error;
      return {
        dailyQuotedHouseholdsTarget: data?.daily_quoted_households_target ?? null,
        dailySoldItemsTarget: data?.daily_sold_items_target ?? null,
        dailyWrittenPremiumTargetCents: data?.daily_written_premium_target_cents ?? null,
      };
    },
  });

  // Calculate days in period
  const daysInPeriod = dateRange
    ? Math.max(1, differenceInDays(dateRange.end, dateRange.start) + 1)
    : 365; // Default to 1 year for "all time"

  // Export functionality
  const { exportSummary, exportDetails } = useLqsRoiExport(
    agencyProfile?.agencyId ?? null,
    dateRange
  );

  // Check access via agency whitelist
  const hasAccess = hasSalesAccess(agencyProfile?.agencyId ?? null);
  
  // Load commission rate from agency when available
  useEffect(() => {
    if (analytics?.summary?.commissionRate) {
      setCommissionRate(analytics.summary.commissionRate.toString());
    }
  }, [analytics?.summary?.commissionRate]);
  
  useEffect(() => {
    if (!authLoading && !agencyLoading && user && agencyProfile && !hasAccess) {
      toast.error('This feature is currently in development');
      navigate('/dashboard', { replace: true });
    }
  }, [authLoading, agencyLoading, user, agencyProfile, hasAccess, navigate]);

  // Save commission rate handler
  const handleSaveCommissionRate = async () => {
    if (!agencyProfile?.agencyId) return;
    
    const rate = parseFloat(commissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error('Please enter a valid rate between 0 and 100');
      return;
    }
    
    setIsSavingRate(true);
    try {
      const { error } = await supabase
        .from('agencies')
        .update({ default_commission_rate: rate })
        .eq('id', agencyProfile.agencyId);
      
      if (error) throw error;
      
      toast.success('Commission rate saved');
      // Invalidate queries to refresh data with new rate
      queryClient.invalidateQueries({ queryKey: ['agency-commission-rate'] });
      queryClient.invalidateQueries({ queryKey: ['lqs-roi-households'] });
      refetch();
    } catch (err) {
      console.error('Failed to save commission rate:', err);
      toast.error('Failed to save commission rate');
    } finally {
      setIsSavingRate(false);
    }
  };

  // Show loading during auth check
  if (authLoading || agencyLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  // Don't render if no access (will redirect)
  if (!user || !hasAccess) {
    return null;
  }

  if (!agencyProfile) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Unable to load agency information.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">Failed to load analytics: {error.message}</p>
      </div>
    );
  }

  const summary = analytics?.summary;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">ROI Analytics</h1>
            <HelpButton videoKey="LQS_Analytics" />
          </div>
          <p className="text-muted-foreground mt-1">
            Analyze marketing performance across the LQS pipeline
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Commission Rate Input */}
          <div className="flex items-center gap-2">
            <Label htmlFor="commission-rate" className="text-sm text-muted-foreground whitespace-nowrap">
              Commission Rate:
            </Label>
            <div className="flex items-center gap-1">
              <Input
                id="commission-rate"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                className="w-20 h-8"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleSaveCommissionRate}
              disabled={isSavingRate}
              className="h-8"
            >
              {isSavingRate ? 'Saving...' : 'Save'}
            </Button>
          </div>
          
          {/* Date Range Selector */}
          <div className="flex items-center gap-2">
            <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DateRangePreset | 'custom')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select period">
                  {datePreset === 'custom' && customDateRange
                    ? `${format(customDateRange.start, 'MMM d')} - ${format(customDateRange.end, 'MMM d, yyyy')}`
                    : undefined
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last30">Last 30 Days</SelectItem>
                <SelectItem value="last60">Last 60 Days</SelectItem>
                <SelectItem value="last90">Last 90 Days</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="ytd">Year to Date</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Custom Date Range Picker */}
            {datePreset === 'custom' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'justify-start text-left font-normal h-9',
                      !customDateRange && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDateRange?.start && customDateRange?.end ? (
                      <>
                        {format(customDateRange.start, 'MMM d')} - {format(customDateRange.end, 'MMM d, yyyy')}
                      </>
                    ) : (
                      <span>Pick dates</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    selected={customDateRange ? { from: customDateRange.start, to: customDateRange.end } : undefined}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setCustomDateRange({ start: range.from, end: range.to });
                      } else if (range?.from) {
                        setCustomDateRange({ start: range.from, end: range.from });
                      }
                    }}
                    numberOfMonths={2}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
          
          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportSummary(analytics?.byLeadSource || [])}>
                Export Summary (Lead Source ROI)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportDetails()}>
                Export Details (All Households)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Commission rate helper text */}
      <p className="text-xs text-muted-foreground -mt-4">
        Used for ROI calculations (Commission Earned = Premium × Rate)
      </p>

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lead-sources">Lead Sources</TabsTrigger>
          <TabsTrigger value="zip-codes">Zip Codes</TabsTrigger>
          <TabsTrigger value="producers">Producers</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* ====== Tab 1: Overview ====== */}
        <TabsContent value="overview" className="space-y-6">
          {/* Goals Header */}
          <LqsGoalsHeader
            summary={analytics?.summary ?? null}
            agencyGoals={agencyGoalsQuery.data ?? null}
            daysInPeriod={daysInPeriod}
            isLoading={analyticsLoading || agencyGoalsQuery.isLoading}
            commissionRate={parseFloat(commissionRate) || 0}
            agencyId={agencyProfile?.agencyId ?? ''}
            onGoalsUpdated={() => {
              queryClient.invalidateQueries({ queryKey: ['lqs-agency-goals'] });
            }}
          />

          {/* ROI Flag Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  ROI Flag Settings
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => setRoiFlagSettings(DEFAULT_ROI_FLAG_SETTINGS)}
                >
                  Reset
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Enable Auto-Flags</p>
                  <p className="text-xs text-muted-foreground">
                    Marks top rows and highlights households in matching ZIP codes.
                  </p>
                </div>
                <Switch
                  checked={roiFlagSettings.enabled}
                  onCheckedChange={(checked) => setRoiFlagSettings(prev => ({
                    ...prev,
                    enabled: checked,
                  }))}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-2">
                  <Label>List size</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={roiFlagInputValues.topCount}
                    onChange={(event) =>
                      setRoiFlagInputValues((prev) => ({
                        ...prev,
                        topCount: event.target.value,
                      }))
                    }
                    onBlur={() => {
                      const nextTopCount = Math.min(
                        TOP_LEADERBOARD_MAX_COUNT,
                        parseBoundedIntegerInput(roiFlagInputValues.topCount, DEFAULT_ROI_FLAG_SETTINGS.topCount, 1),
                      );
                      setRoiFlagSettings(prev => ({
                        ...prev,
                        topCount: nextTopCount,
                      }));
                      setRoiFlagInputValues((prev) => ({
                        ...prev,
                        topCount: String(nextTopCount),
                      }));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        (event.target as HTMLInputElement).blur();
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="show-priority-zip-badges" className="text-sm">
                    Show Priority ZIP badges in detail
                  </Label>
                  <div className="pt-2">
                    <Switch
                      id="show-priority-zip-badges"
                      checked={roiFlagSettings.showPriorityZipBadges}
                      onCheckedChange={(checked) =>
                        setRoiFlagSettings(prev => ({
                          ...prev,
                          showPriorityZipBadges: checked,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-source-flag-metric">Lead source metric</Label>
                  <Select
                    value={roiFlagSettings.leadSourceMetric}
                    onValueChange={(value) =>
                      setRoiFlagSettings(prev => ({
                        ...prev,
                        leadSourceMetric: value as LeaderboardMetric,
                      }))
                    }
                  >
                    <SelectTrigger id="lead-source-flag-metric" className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEADERBOARD_METRIC_OPTIONS.leadSource.map((metricOption) => (
                        <SelectItem key={`settings-lead-${metricOption.value}`} value={metricOption.value}>
                          {metricOption.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-source-flag-sample">Lead source sample minimum</Label>
                  <Input
                    id="lead-source-flag-sample"
                    type="number"
                    min={1}
                    value={roiFlagInputValues.leadSourceMinimumSample}
                    onChange={(event) =>
                      setRoiFlagInputValues((prev) => ({
                        ...prev,
                        leadSourceMinimumSample: event.target.value,
                      }))
                    }
                    onBlur={() => {
                      const nextLeadSourceMinimumSample = parseBoundedIntegerInput(
                        roiFlagInputValues.leadSourceMinimumSample,
                        DEFAULT_ROI_FLAG_SETTINGS.leadSourceMinimumSample,
                        1,
                      );
                      setRoiFlagSettings(prev => ({
                        ...prev,
                        leadSourceMinimumSample: nextLeadSourceMinimumSample,
                      }));
                      setRoiFlagInputValues((prev) => ({
                        ...prev,
                        leadSourceMinimumSample: String(nextLeadSourceMinimumSample),
                      }));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        (event.target as HTMLInputElement).blur();
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip-flag-metric">ZIP metric</Label>
                  <Select
                    value={roiFlagSettings.zipMetric}
                    onValueChange={(value) =>
                      setRoiFlagSettings(prev => ({
                        ...prev,
                        zipMetric: value as LeaderboardMetric,
                      }))
                    }
                  >
                    <SelectTrigger id="zip-flag-metric" className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEADERBOARD_METRIC_OPTIONS.zip.map((metricOption) => (
                        <SelectItem key={`settings-zip-${metricOption.value}`} value={metricOption.value}>
                          {metricOption.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip-flag-sample">ZIP sample minimum</Label>
                  <Input
                    id="zip-flag-sample"
                    type="number"
                    min={1}
                    value={roiFlagInputValues.zipMinimumSample}
                    onChange={(event) =>
                      setRoiFlagInputValues((prev) => ({
                        ...prev,
                        zipMinimumSample: event.target.value,
                      }))
                    }
                    onBlur={() => {
                      const nextZipMinimumSample = parseBoundedIntegerInput(
                        roiFlagInputValues.zipMinimumSample,
                        DEFAULT_ROI_FLAG_SETTINGS.zipMinimumSample,
                        1,
                      );
                      setRoiFlagSettings(prev => ({
                        ...prev,
                        zipMinimumSample: nextZipMinimumSample,
                      }));
                      setRoiFlagInputValues((prev) => ({
                        ...prev,
                        zipMinimumSample: String(nextZipMinimumSample),
                      }));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        (event.target as HTMLInputElement).blur();
                      }
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Marketing Top Callouts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Marketing callouts
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">
                Tip: values are filtered by minimum sample size so one-off entries don't surface as top performers.
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TopLeadSourceCallout
              data={analytics?.byLeadSource || []}
              metric={roiFlagSettings.leadSourceMetric}
              flaggedRows={roiFlagSettings.enabled ? flaggedLeadSourceIds : undefined}
              minimumSample={roiFlagSettings.leadSourceMinimumSample}
              maxRows={roiFlagSettings.topCount}
              onMetricChange={(next) => setRoiFlagSettings(prev => ({
                ...prev,
                leadSourceMetric: next,
              }))}
              isLoading={analyticsLoading}
            />
            <TopZipCallout
              data={analytics?.byZipCode || []}
              metric={roiFlagSettings.zipMetric}
              flaggedRows={roiFlagSettings.enabled ? flaggedZipCodeSet : undefined}
              minimumSample={roiFlagSettings.zipMinimumSample}
              maxRows={roiFlagSettings.topCount}
              onMetricChange={(next) => setRoiFlagSettings(prev => ({
                ...prev,
                zipMetric: next,
              }))}
              isLoading={analyticsLoading}
            />
          </div>

          {/* Summary Cards */}
          {analyticsLoading || !summary ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SummaryCard
                title={summary.isActivityView ? "Leads Received" : "Open Leads"}
                value={(summary.isActivityView ? summary.leadsReceived : summary.openLeads).toLocaleString()}
                icon={Users}
                variant="info"
                tooltip={summary.isActivityView ? "Leads that entered during this period" : "Leads not yet quoted"}
              />
              <SummaryCard
                title={summary.isActivityView ? "Quotes Created" : "Quoted Households"}
                value={(summary.isActivityView ? summary.quotesCreated : summary.quotedHouseholds).toLocaleString()}
                icon={Target}
                variant="warning"
                tooltip={summary.isActivityView ? "Unique households quoted during this period" : "Households with at least one quote"}
              />
              <SummaryCard
                title={summary.isActivityView ? "Sales Closed" : "Sold Households"}
                value={(summary.isActivityView ? summary.salesClosed : summary.soldHouseholds).toLocaleString()}
                icon={TrendingUp}
                variant="success"
                tooltip={summary.isActivityView ? "Unique households sold during this period" : "Households with at least one policy"}
              />
              <SummaryCard
                title="Premium Sold"
                value={formatCurrency(summary.premiumSoldCents)}
                icon={DollarSign}
                variant="success"
              />
              <SummaryCard
                title="Quote Rate"
                value={summary.quoteRate !== null ? formatPercent(summary.quoteRate) : '—'}
                icon={Percent}
                tooltip={summary.isActivityView ? "Quotes Created ÷ Leads Received" : "Percentage of total leads that received a quote"}
              />
              <SummaryCard
                title="Close Rate"
                value={summary.closeRate !== null ? formatPercent(summary.closeRate) : '—'}
                icon={Percent}
                tooltip={summary.isActivityView ? "Sales Closed ÷ Quotes Created" : "Percentage of quoted households that resulted in a sale"}
              />
              <SummaryCard
                title="Total Spend"
                value={formatCurrency(summary.totalSpendCents)}
                icon={DollarSign}
              />
              <SummaryCard
                title="Overall ROI"
                value={formatRoi(summary.overallRoi)}
                icon={BarChart3}
                variant={summary.overallRoi !== null && summary.overallRoi >= 1 ? 'success' : 'default'}
                tooltip="Commission Earned ÷ Total Spend"
              />
            </div>
          )}

          {/* Funnel and Insights Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {analyticsLoading || !summary ? (
              <Skeleton className="h-80" />
            ) : (
              <ConversionFunnel
                openLeads={summary.openLeads}
                quotedHouseholds={summary.quotedHouseholds}
                soldHouseholds={summary.soldHouseholds}
                quoteRate={summary.quoteRate}
                closeRate={summary.closeRate}
                isActivityView={summary.isActivityView}
                leadsReceived={summary.leadsReceived}
                quotesCreated={summary.quotesCreated}
                salesClosed={summary.salesClosed}
              />
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Performance Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsLoading || !summary ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-6" />
                    ))}
                  </div>
                ) : (() => {
                  const salesCount = summary.isActivityView ? summary.salesClosed : summary.soldHouseholds;
                  const leadsCount = summary.isActivityView ? summary.leadsReceived : summary.totalLeads;

                  const avgPremiumPerSale = salesCount > 0
                    ? formatCurrency(summary.premiumSoldCents / salesCount)
                    : '—';
                  const avgCostPerLead = leadsCount > 0
                    ? formatCurrency(summary.totalSpendCents / leadsCount)
                    : '—';
                  const avgCostPerSale = salesCount > 0
                    ? formatCurrency(summary.totalSpendCents / salesCount)
                    : '—';

                  return (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-border">
                        <span className="text-muted-foreground">Avg Premium per Sale</span>
                        <span className="font-semibold">{avgPremiumPerSale}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border">
                        <span className="text-muted-foreground">Commission Earned</span>
                        <span className="font-semibold text-green-500">
                          {formatCurrency(summary.commissionEarned)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border">
                        <span className="text-muted-foreground">Avg Cost per Lead</span>
                        <span className="font-semibold">{avgCostPerLead}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border">
                        <span className="text-muted-foreground">Avg Cost per Sale</span>
                        <span className="font-semibold">{avgCostPerSale}</span>
                      </div>
                      {!summary.isActivityView && (
                        <div className="flex justify-between items-center py-2">
                          <span className="text-muted-foreground">Lead → Sale Rate</span>
                          <span className="font-semibold">
                            {summary.totalLeads > 0
                              ? formatPercent((summary.soldHouseholds / summary.totalLeads) * 100)
                              : '—'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ====== Tab 2: Lead Sources ====== */}
        <TabsContent value="lead-sources" className="space-y-6">
          <LqsRoiSpendBubbleChart
            data={analytics?.byLeadSource || []}
            isLoading={analyticsLoading}
          />

          <LqsRoiBucketTable
            data={analytics?.byLeadSource || []}
            isLoading={analyticsLoading}
            onLeadSourceClick={handleLeadSourceClick}
            crossTabData={crossTabBySource}
          />

          <LeadSourceTable
            data={analytics?.byLeadSource || []}
            isLoading={analyticsLoading}
          />
        </TabsContent>

        {/* ====== Tab 3: Zip Codes ====== */}
        <TabsContent value="zip-codes" className="space-y-6">
          <TopZipCallout
            data={analytics?.byZipCode || []}
            metric={roiFlagSettings.zipMetric}
            flaggedRows={roiFlagSettings.enabled ? flaggedZipCodeSet : undefined}
            minimumSample={roiFlagSettings.zipMinimumSample}
            maxRows={10}
            onMetricChange={(next) => setRoiFlagSettings(prev => ({
              ...prev,
              zipMetric: next,
            }))}
            isLoading={analyticsLoading}
          />

          <ZipCodePerformanceTable
            data={analytics?.byZipCode || []}
            isLoading={analyticsLoading}
          />
        </TabsContent>

        {/* ====== Tab 4: Producers ====== */}
        <TabsContent value="producers" className="space-y-6">
          <StaffRankingTable
            data={producerData}
            isLoading={producerLoading}
            onProducerClick={handleProducerClick}
          />

          <LqsProducerBreakdown
            data={producerData}
            isLoading={producerLoading}
            onProducerClick={handleProducerClick}
          />

          <LqsProducerLeadSourceCrossTab
            agencyId={agencyProfile?.agencyId ?? null}
            dateRange={dateRange}
          />
        </TabsContent>

        {/* ====== Tab 5: Activity ====== */}
        <TabsContent value="activity" className="space-y-6">
          <ActivityHistoryTable
            agencyId={agencyProfile?.agencyId ?? null}
            dateRange={dateRange}
          />
        </TabsContent>

        {/* ====== Tab 6: Insights ====== */}
        <TabsContent value="insights" className="space-y-6">
          <LqsTimeToCloseAnalytics
            agencyId={agencyProfile?.agencyId ?? null}
            dateRange={dateRange}
          />

          <LqsPerformanceTrendChart agencyId={agencyProfile?.agencyId ?? null} />

          <LqsSameMonthConversion
            agencyId={agencyProfile?.agencyId ?? null}
            dateRange={dateRange}
          />

          <LqsObjectionAnalysis
            agencyId={agencyProfile?.agencyId ?? null}
            dateRange={dateRange}
          />
        </TabsContent>
      </Tabs>

      {/* Detail Sheets (shared across all tabs) */}
      <LqsLeadSourceDetailSheet
        agencyId={agencyProfile?.agencyId ?? null}
        leadSourceId={selectedLeadSourceId}
        dateRange={dateRange}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        priorityZipCodes={roiFlagSettings.enabled && roiFlagSettings.showPriorityZipBadges ? flaggedZipCodes : []}
        priorityZipRanks={roiFlagSettings.enabled && roiFlagSettings.showPriorityZipBadges ? priorityZipRanks : undefined}
      />

      <LqsProducerDetailSheet
        agencyId={agencyProfile?.agencyId ?? null}
        teamMemberId={selectedProducerId}
        viewMode={producerViewMode}
        dateRange={dateRange}
        open={producerDetailSheetOpen}
        onOpenChange={setProducerDetailSheetOpen}
      />
    </div>
  );
}
