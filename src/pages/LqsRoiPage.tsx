import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, Users, DollarSign, Percent, Target, Info, CalendarIcon, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { hasSalesBetaAccess } from '@/lib/salesBetaAccess';
import { useAgencyProfile } from '@/hooks/useAgencyProfile';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  useLqsRoiAnalytics,
  DateRangePreset,
  getDateRangeFromPreset,
  LeadSourceRoiRow
} from '@/hooks/useLqsRoiAnalytics';
import { useLqsRoiExport } from '@/hooks/useLqsRoiExport';
import { LqsRoiBucketTable } from '@/components/lqs/LqsRoiBucketTable';
import { LqsProducerBreakdown } from '@/components/lqs/LqsProducerBreakdown';
import { useLqsProducerBreakdown } from '@/hooks/useLqsProducerBreakdown';
import { LqsLeadSourceDetailSheet } from '@/components/lqs/LqsLeadSourceDetailSheet';
import { LqsGoalsHeader } from '@/components/lqs/LqsGoalsHeader';
import { LqsSameMonthConversion } from '@/components/lqs/LqsSameMonthConversion';
import { LqsRoiSpendBubbleChart } from '@/components/lqs/LqsRoiSpendBubbleChart';
import { LqsPerformanceTrendChart } from '@/components/lqs/LqsPerformanceTrendChart';
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

export default function LqsRoiPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [datePreset, setDatePreset] = useState<DateRangePreset | 'custom'>('all');
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [commissionRate, setCommissionRate] = useState<string>('22');
  const [isSavingRate, setIsSavingRate] = useState(false);

  // Lead source detail sheet state
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedLeadSourceId, setSelectedLeadSourceId] = useState<string | null | undefined>(undefined);

  // Handler for lead source click
  const handleLeadSourceClick = (leadSourceId: string | null) => {
    setSelectedLeadSourceId(leadSourceId);
    setDetailSheetOpen(true);
  };

  // Get date range from preset or use custom
  const dateRange = datePreset === 'custom' 
    ? customDateRange 
    : getDateRangeFromPreset(datePreset as DateRangePreset);
  
  const { data: agencyProfile, isLoading: agencyLoading } = useAgencyProfile(user?.id, 'Manager');
  
  const { data: analytics, isLoading: analyticsLoading, error, refetch } = useLqsRoiAnalytics(
    agencyProfile?.agencyId ?? null,
    dateRange
  );

  // Producer breakdown data
  const { data: producerData, isLoading: producerLoading } = useLqsProducerBreakdown(
    agencyProfile?.agencyId ?? null,
    dateRange
  );

  // Fetch agency goals
  const agencyGoalsQuery = useQuery({
    queryKey: ['lqs-agency-goals', agencyProfile?.agencyId],
    enabled: !!agencyProfile?.agencyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agencies')
        .select('daily_quoted_households_target, daily_sold_items_target')
        .eq('id', agencyProfile!.agencyId)
        .single();

      if (error) throw error;
      return {
        dailyQuotedHouseholdsTarget: data?.daily_quoted_households_target ?? null,
        dailySoldItemsTarget: data?.daily_sold_items_target ?? null,
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
  const hasAccess = hasSalesBetaAccess(agencyProfile?.agencyId ?? null);
  
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

      {/* Goals Header */}
      <LqsGoalsHeader
        summary={analytics?.summary ?? null}
        agencyGoals={agencyGoalsQuery.data ?? null}
        daysInPeriod={daysInPeriod}
        isLoading={analyticsLoading || agencyGoalsQuery.isLoading}
      />

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
          {/* Quote Rate - hide in activity view */}
          {!summary.isActivityView && (
            <SummaryCard
              title="Quote Rate"
              value={summary.quoteRate !== null ? formatPercent(summary.quoteRate) : '—'}
              icon={Percent}
              tooltip="Percentage of total leads that received a quote"
            />
          )}
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

      {/* Funnel and Table Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
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

        {/* Performance Insights */}
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
              // Use correct counts based on view type
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
                  {/* Lead → Sale Rate - hide in activity view since it's not meaningful */}
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

      {/* Charts Row: Bubble Chart + Trend Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ROI vs Spend Bubble Chart */}
        <LqsRoiSpendBubbleChart
          data={analytics?.byLeadSource || []}
          isLoading={analyticsLoading}
        />

        {/* Performance Trend Chart */}
        <LqsPerformanceTrendChart agencyId={agencyProfile?.agencyId ?? null} />
      </div>

      {/* Marketing ROI by Bucket Table */}
      <LqsRoiBucketTable
        data={analytics?.byLeadSource || []}
        isLoading={analyticsLoading}
        onLeadSourceClick={handleLeadSourceClick}
      />

      {/* Producer Breakdown (Quoted By / Sold By) */}
      <LqsProducerBreakdown
        data={producerData}
        isLoading={producerLoading}
      />

      {/* Same-Month Conversion Metric */}
      <LqsSameMonthConversion
        agencyId={agencyProfile?.agencyId ?? null}
        dateRange={dateRange}
      />

      {/* Legacy Lead Source ROI Table (flat view) */}
      <LeadSourceTable
        data={analytics?.byLeadSource || []}
        isLoading={analyticsLoading}
      />

      {/* Lead Source Detail Sheet */}
      <LqsLeadSourceDetailSheet
        agencyId={agencyProfile?.agencyId ?? null}
        leadSourceId={selectedLeadSourceId}
        dateRange={dateRange}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
      />
    </div>
  );
}