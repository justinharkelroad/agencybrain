import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useLeadSourceAnalytics } from '@/hooks/useLeadSourceAnalytics';
import { TrendingUp, TrendingDown, DollarSign, Target, Users, Download, Calendar } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { exportToCSV } from '@/utils/exportUtils';

export function LeadSourceAnalytics() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    endDate: new Date().toISOString().split('T')[0] // today
  });
  const [selectedPeriod, setSelectedPeriod] = useState('30');

  const { analytics, loading, refetch } = useLeadSourceAnalytics(dateRange.startDate, dateRange.endDate);

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    const days = parseInt(period);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();
    
    setDateRange({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });
  };

  const handleExport = () => {
    if (!analytics?.leadSources.length) return;
    
    const exportData = analytics.leadSources.map(ls => ({
      'Lead Source': ls.name,
      'Total Leads': ls.totalLeads,
      'Quoted Leads': ls.quotedLeads,
      'Sold Items': ls.soldItems,
      'Sold Policies': ls.soldPolicies,
      'Premium Sold': ls.premiumSold / 100, // Convert cents to dollars
      'Conversion Rate': `${ls.conversionRate}%`,
      'Quote Rate': `${ls.quoteRate}%`,
      'Cost Per Lead': ls.costPerLead / 100,
      'Cost Per Quote': ls.costPerQuote / 100,
      'Cost Per Sale': ls.costPerSale / 100,
      'ROI': `${ls.roi}%`,
      'Revenue Per Lead': ls.revenuePerLead / 100,
      'Total Spend': ls.totalSpend / 100
    }));

    exportToCSV(exportData, `lead-source-analytics-${dateRange.startDate}-to-${dateRange.endDate}.csv`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent className="animate-pulse">
                <div className="h-8 bg-muted rounded w-1/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lead Source Analytics</CardTitle>
          <CardDescription>No data available for the selected period</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Date Range & Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Quick Select</Label>
              <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <div className="flex gap-2">
                <Button onClick={refetch} variant="outline" size="sm">
                  Refresh
                </Button>
                <Button onClick={handleExport} variant="outline" size="sm" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(analytics.totals.totalLeads)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(analytics.totals.quotedLeads)} quoted ({analytics.totals.overallQuoteRate}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totals.overallConversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(analytics.totals.soldItems)} items sold
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.totals.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(analytics.totals.soldPolicies)} policies
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall ROI</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totals.overallROI}%</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(analytics.totals.totalSpend)} total spend
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lead Source Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lead Source Performance</CardTitle>
          <CardDescription>
            Detailed breakdown of each lead source's performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Lead Source</th>
                  <th className="text-left p-3 font-medium">Leads</th>
                  <th className="text-left p-3 font-medium">Quote Rate</th>
                  <th className="text-left p-3 font-medium">Conversion</th>
                  <th className="text-left p-3 font-medium">Revenue</th>
                  <th className="text-left p-3 font-medium">Cost/Lead</th>
                  <th className="text-left p-3 font-medium">Cost/Sale</th>
                  <th className="text-left p-3 font-medium">ROI</th>
                  <th className="text-left p-3 font-medium">Rev/Lead</th>
                </tr>
              </thead>
              <tbody>
                {analytics.leadSources.map((ls) => (
                  <tr key={ls.name} className="border-b hover:bg-muted/50">
                    <td className="p-3 font-medium">{ls.name}</td>
                    <td className="p-3">
                      <div className="text-sm">
                        <div>{formatNumber(ls.totalLeads)}</div>
                        <div className="text-muted-foreground text-xs">
                          {formatNumber(ls.quotedLeads)} quoted
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant={ls.quoteRate >= 50 ? 'default' : ls.quoteRate >= 25 ? 'secondary' : 'destructive'}>
                        {ls.quoteRate}%
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {ls.conversionRate >= 10 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span className={ls.conversionRate >= 10 ? 'text-green-600' : 'text-red-600'}>
                          {ls.conversionRate}%
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-sm">
                        <div className="font-medium">{formatCurrency(ls.premiumSold)}</div>
                        <div className="text-muted-foreground text-xs">
                          {formatNumber(ls.soldItems)} items, {formatNumber(ls.soldPolicies)} policies
                        </div>
                      </div>
                    </td>
                    <td className="p-3">{formatCurrency(ls.costPerLead)}</td>
                    <td className="p-3">
                      {ls.soldItems > 0 ? formatCurrency(ls.costPerSale) : '—'}
                    </td>
                    <td className="p-3">
                      <Badge variant={ls.roi >= 100 ? 'default' : ls.roi >= 0 ? 'secondary' : 'destructive'}>
                        {ls.roi}%
                      </Badge>
                    </td>
                    <td className="p-3">{formatCurrency(ls.revenuePerLead)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {analytics.leadSources.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No lead source data available for the selected period
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}