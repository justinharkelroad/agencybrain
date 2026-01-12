import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, TrendingUp, Users, DollarSign, Percent, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useAgencyProfile } from '@/hooks/useAgencyProfile';
import { 
  useLqsRoiAnalytics, 
  DateRangePreset, 
  getDateRangeFromPreset,
  LeadSourceRoiRow 
} from '@/hooks/useLqsRoiAnalytics';

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

// Conversion Funnel Component
function ConversionFunnel({ 
  leads, 
  quoted, 
  sold, 
  quoteRate, 
  closeRate 
}: { 
  leads: number; 
  quoted: number; 
  sold: number; 
  quoteRate: number; 
  closeRate: number;
}) {
  const maxWidth = 100;
  const quotedWidth = leads > 0 ? Math.max(30, (quoted / leads) * 100) : 30;
  const soldWidth = leads > 0 ? Math.max(20, (sold / leads) * 100) : 20;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Conversion Funnel
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center space-y-3">
          {/* Leads */}
          <div 
            className="bg-blue-500/20 border border-blue-500/40 rounded-lg py-4 px-6 text-center transition-all"
            style={{ width: `${maxWidth}%` }}
          >
            <div className="text-2xl font-bold text-blue-400">{leads.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">LEADS</div>
          </div>
          
          {/* Arrow with quote rate */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-blue-500/50"></div>
            <span className="text-sm font-medium">{formatPercent(quoteRate)} quote rate</span>
          </div>
          
          {/* Quoted */}
          <div 
            className="bg-amber-500/20 border border-amber-500/40 rounded-lg py-4 px-6 text-center transition-all"
            style={{ width: `${quotedWidth}%` }}
          >
            <div className="text-2xl font-bold text-amber-400">{quoted.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">QUOTED</div>
          </div>
          
          {/* Arrow with close rate */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-amber-500/50"></div>
            <span className="text-sm font-medium">{formatPercent(closeRate)} close rate</span>
          </div>
          
          {/* Sold */}
          <div 
            className="bg-green-500/20 border border-green-500/40 rounded-lg py-4 px-6 text-center transition-all"
            style={{ width: `${soldWidth}%` }}
          >
            <div className="text-2xl font-bold text-green-400">{sold.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">SOLD</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Summary Card Component
function SummaryCard({
  title,
  value,
  icon: Icon,
  variant = 'default',
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  variant?: 'default' | 'success' | 'warning' | 'info';
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
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
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
                  Quotes {sortField === 'totalQuotes' && (sortDir === 'asc' ? '↑' : '↓')}
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
  const { user, isAgencyOwner, isKeyEmployee, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all');
  const dateRange = getDateRangeFromPreset(datePreset);
  
  const { data: agencyProfile, isLoading: agencyLoading } = useAgencyProfile(user?.id, 'Manager');
  
  const { data: analytics, isLoading: analyticsLoading, error } = useLqsRoiAnalytics(
    agencyProfile?.agencyId ?? null,
    dateRange
  );

  // Access control - redirect if not authorized
  const hasAccess = isAgencyOwner || isKeyEmployee;
  
  useEffect(() => {
    if (!authLoading && user && !hasAccess) {
      toast.error('Access restricted to agency owners and key employees');
      navigate('/dashboard', { replace: true });
    }
  }, [authLoading, user, hasAccess, navigate]);

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
        
        {/* Date Range Selector */}
        <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DateRangePreset)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last30">Last 30 Days</SelectItem>
            <SelectItem value="last60">Last 60 Days</SelectItem>
            <SelectItem value="last90">Last 90 Days</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="ytd">Year to Date</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
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
            title="Total Leads"
            value={summary.totalLeads.toLocaleString()}
            icon={Users}
            variant="info"
          />
          <SummaryCard
            title="Total Quoted"
            value={summary.totalQuoted.toLocaleString()}
            icon={Target}
            variant="warning"
          />
          <SummaryCard
            title="Total Sold"
            value={summary.totalSold.toLocaleString()}
            icon={TrendingUp}
            variant="success"
          />
          <SummaryCard
            title="Premium Sold"
            value={formatCurrency(summary.premiumSoldCents)}
            icon={DollarSign}
            variant="success"
          />
          <SummaryCard
            title="Quote Rate"
            value={formatPercent(summary.quoteRate)}
            icon={Percent}
          />
          <SummaryCard
            title="Close Rate"
            value={formatPercent(summary.closeRate)}
            icon={Percent}
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
            leads={summary.totalLeads}
            quoted={summary.totalQuoted}
            sold={summary.totalSold}
            quoteRate={summary.quoteRate}
            closeRate={summary.closeRate}
          />
        )}

        {/* Quick Stats or placeholder */}
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
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-6" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Avg Premium per Sale</span>
                  <span className="font-semibold">
                    {summary.totalSold > 0 
                      ? formatCurrency(summary.premiumSoldCents / summary.totalSold) 
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Avg Cost per Lead</span>
                  <span className="font-semibold">
                    {summary.totalLeads > 0 
                      ? formatCurrency(summary.totalSpendCents / summary.totalLeads) 
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Avg Cost per Sale</span>
                  <span className="font-semibold">
                    {summary.totalSold > 0 
                      ? formatCurrency(summary.totalSpendCents / summary.totalSold) 
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Lead → Sale Rate</span>
                  <span className="font-semibold">
                    {summary.totalLeads > 0 
                      ? formatPercent((summary.totalSold / summary.totalLeads) * 100) 
                      : '-'}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lead Source ROI Table */}
      <LeadSourceTable 
        data={analytics?.byLeadSource || []} 
        isLoading={analyticsLoading} 
      />
    </div>
  );
}
