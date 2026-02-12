import { useEffect, useId, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { 
  DollarSign, 
  Phone, 
  TrendingUp, 
  Building, 
  Mic,
  Brain,
  CalendarIcon,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceDot,
} from 'recharts';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays, subMonths, addMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { PulseMarker } from '@/components/charts/PulseMarker';

type DatePreset = 'this-month' | 'last-month' | 'this-week' | 'last-30-days' | 'custom';

interface CostSummary {
  total_calls: number;
  total_whisper_cost: number;
  total_gpt_cost: number;
  total_cost: number;
  avg_cost_per_call: number;
  avg_call_minutes: number;
  total_minutes: number;
}

interface AgencyCosts {
  agency_name: string;
  agency_id: string;
  total_calls: number;
  total_cost: number;
  avg_cost_per_call: number;
}

interface DailyCosts {
  date: string;
  calls: number;
  cost: number;
}

interface CallRecord {
  id: string;
  call_duration_seconds: number | null;
  whisper_cost: number | null;
  gpt_cost: number | null;
  gpt_input_tokens: number | null;
  gpt_output_tokens: number | null;
  total_cost: number | null;
  status: string;
  created_at: string;
  agency_id: string;
  original_filename: string | null;
  agencies: { name: string } | null;
}

const AdminCallScoringDashboard = () => {
  const chartId = useId().replace(/:/g, '');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [agencyCosts, setAgencyCosts] = useState<AgencyCosts[]>([]);
  const [dailyCosts, setDailyCosts] = useState<DailyCosts[]>([]);
  const [recentCalls, setRecentCalls] = useState<CallRecord[]>([]);
  
  // Date range state - default to current month
  const [startDate, setStartDate] = useState<Date>(() => startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(() => endOfMonth(new Date()));
  const [activePreset, setActivePreset] = useState<DatePreset>('this-month');
  const latestCostPoint = [...dailyCosts].reverse().find((row) => typeof row.cost === 'number');

  useEffect(() => {
    fetchDashboardData();
  }, [startDate, endDate]);

  const applyPreset = (preset: DatePreset) => {
    const now = new Date();
    setActivePreset(preset);
    
    switch (preset) {
      case 'this-month':
        setStartDate(startOfMonth(now));
        setEndDate(endOfMonth(now));
        break;
      case 'last-month': {
        const lastMonth = subMonths(now, 1);
        setStartDate(startOfMonth(lastMonth));
        setEndDate(endOfMonth(lastMonth));
        break;
      }
      case 'this-week':
        setStartDate(startOfWeek(now, { weekStartsOn: 0 }));
        setEndDate(endOfWeek(now, { weekStartsOn: 0 }));
        break;
      case 'last-30-days':
        setStartDate(subDays(now, 30));
        setEndDate(now);
        break;
      case 'custom':
        // Keep current dates, just mark as custom
        break;
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newStart = direction === 'prev' 
      ? startOfMonth(subMonths(startDate, 1))
      : startOfMonth(addMonths(startDate, 1));
    const newEnd = endOfMonth(newStart);
    
    setStartDate(newStart);
    setEndDate(newEnd);
    setActivePreset('custom');
  };

  const handleCustomDateChange = (type: 'start' | 'end', date: Date | undefined) => {
    if (!date) return;
    
    if (type === 'start') {
      setStartDate(date);
    } else {
      // Set end date to end of day
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      setEndDate(endOfDay);
    }
    setActivePreset('custom');
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    
    // Format dates for query - ensure end date includes full day
    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();
    
    // Fetch calls within date range
    const { data: calls } = await supabase
      .from('agency_calls')
      .select(`
        id,
        call_duration_seconds,
        whisper_cost,
        gpt_cost,
        gpt_input_tokens,
        gpt_output_tokens,
        total_cost,
        status,
        created_at,
        agency_id,
        original_filename,
        agencies(name)
      `)
      .eq('status', 'analyzed')
      .gte('created_at', startISO)
      .lte('created_at', endISO);

    if (calls) {
      const typedCalls = calls as CallRecord[];
      
      // Calculate summary
      const totalCalls = typedCalls.length;
      const totalWhisperCost = typedCalls.reduce((sum, c) => sum + (c.whisper_cost || 0), 0);
      const totalGptCost = typedCalls.reduce((sum, c) => sum + (c.gpt_cost || 0), 0);
      const totalCost = typedCalls.reduce((sum, c) => sum + (c.total_cost || 0), 0);
      const totalMinutes = typedCalls.reduce((sum, c) => sum + ((c.call_duration_seconds || 0) / 60), 0);

      setSummary({
        total_calls: totalCalls,
        total_whisper_cost: totalWhisperCost,
        total_gpt_cost: totalGptCost,
        total_cost: totalCost,
        avg_cost_per_call: totalCalls > 0 ? totalCost / totalCalls : 0,
        avg_call_minutes: totalCalls > 0 ? totalMinutes / totalCalls : 0,
        total_minutes: totalMinutes,
      });

      // Group by agency
      const agencyMap = new Map<string, AgencyCosts>();
      typedCalls.forEach(call => {
        const agencyName = call.agencies?.name || 'Unknown';
        const existing = agencyMap.get(call.agency_id) || {
          agency_name: agencyName,
          agency_id: call.agency_id,
          total_calls: 0,
          total_cost: 0,
          avg_cost_per_call: 0,
        };
        existing.total_calls += 1;
        existing.total_cost += call.total_cost || 0;
        agencyMap.set(call.agency_id, existing);
      });
      
      const agencyData = Array.from(agencyMap.values()).map(a => ({
        ...a,
        avg_cost_per_call: a.total_calls > 0 ? a.total_cost / a.total_calls : 0,
      })).sort((a, b) => b.total_cost - a.total_cost);
      
      setAgencyCosts(agencyData);

      // Group by day within selected range
      const dailyMap = new Map<string, DailyCosts>();
      
      typedCalls.forEach(call => {
        const date = new Date(call.created_at).toISOString().split('T')[0];
        const existing = dailyMap.get(date) || { date, calls: 0, cost: 0 };
        existing.calls += 1;
        existing.cost += call.total_cost || 0;
        dailyMap.set(date, existing);
      });
      
      const dailyData = Array.from(dailyMap.values()).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      setDailyCosts(dailyData);

      // Recent calls within range
      const recent = typedCalls
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);
      setRecentCalls(recent);
    } else {
      // No data for selected range
      setSummary({
        total_calls: 0,
        total_whisper_cost: 0,
        total_gpt_cost: 0,
        total_cost: 0,
        avg_cost_per_call: 0,
        avg_call_minutes: 0,
        total_minutes: 0,
      });
      setAgencyCosts([]);
      setDailyCosts([]);
      setRecentCalls([]);
    }

    setLoading(false);
  };

  const formatCurrency = (value: number) => `$${value.toFixed(4)}`;
  const formatCurrencyShort = (value: number) => `$${value.toFixed(2)}`;

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  const presetButtons: { key: DatePreset; label: string }[] = [
    { key: 'this-month', label: 'This Month' },
    { key: 'last-month', label: 'Last Month' },
    { key: 'this-week', label: 'This Week' },
    { key: 'last-30-days', label: 'Last 30 Days' },
  ];

  return (
    <div className="space-y-6">
      {/* Date Range Controls */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-4">
            {/* Quick-select presets */}
            <div className="flex flex-wrap gap-2">
              {presetButtons.map((preset) => (
                <Button
                  key={preset.key}
                  variant={activePreset === preset.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => applyPreset(preset.key)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            
            {/* Date range display and pickers */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateMonth('prev')}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {format(startDate, 'MMM d, yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => handleCustomDateChange('start', date)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                
                <span className="text-muted-foreground">to</span>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {format(endDate, 'MMM d, yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => handleCustomDateChange('end', date)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateMonth('next')}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary ml-2"></div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Calls Analyzed</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total_calls || 0}</div>
            <p className="text-xs text-muted-foreground">
              {summary?.total_minutes.toFixed(1)} total minutes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrencyShort(summary?.total_cost || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Whisper: {formatCurrencyShort(summary?.total_whisper_cost || 0)} | GPT: {formatCurrencyShort(summary?.total_gpt_cost || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Cost per Call</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.avg_cost_per_call || 0)}</div>
            <p className="text-xs text-muted-foreground">
              ~{summary?.avg_call_minutes.toFixed(1)} min avg duration
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Agencies</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agencyCosts.length}</div>
            <p className="text-xs text-muted-foreground">
              In selected period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cost Breakdown Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Whisper (Transcription)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-chart-2">
              {formatCurrencyShort(summary?.total_whisper_cost || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              $0.006 per minute × {summary?.total_minutes.toFixed(0)} minutes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4" />
              GPT-4o (Analysis)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-chart-5">
              {formatCurrencyShort(summary?.total_gpt_cost || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Input + Output tokens
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Daily Costs Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Daily Costs ({format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {dailyCosts.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyCosts}>
                    <defs>
                      <linearGradient id={`${chartId}-daily-cost-line`} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="hsl(var(--chart-1))" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="8 8" className="stroke-border/70" />
                    <XAxis 
                      dataKey="date" 
                      className="text-muted-foreground"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis
                      className="text-muted-foreground"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `$${v.toFixed(2)}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
                      labelFormatter={(label) => new Date(label).toLocaleDateString()}
                    />
                    <Line
                      type="natural"
                      dataKey="cost"
                      stroke="hsl(var(--chart-1))"
                      strokeOpacity={0.22}
                      strokeWidth={7}
                      dot={false}
                      activeDot={false}
                    />
                    <Line
                      type="natural"
                      dataKey="cost"
                      stroke={`url(#${chartId}-daily-cost-line)`}
                      strokeWidth={3.2}
                      dot={false}
                      activeDot={{ r: 5, fill: 'hsl(var(--chart-1))', strokeWidth: 0 }}
                    />
                    {latestCostPoint && (
                      <ReferenceDot
                        x={latestCostPoint.date}
                        y={latestCostPoint.cost}
                        ifOverflow="visible"
                        shape={<PulseMarker color="hsl(var(--chart-1))" />}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No data for selected period
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Calls per Day Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Calls per Day ({format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {dailyCosts.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyCosts}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis 
                      dataKey="date" 
                      className="text-muted-foreground"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis className="text-muted-foreground" tick={{ fontSize: 10 }} />
                    <Tooltip
                      cursor={false}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      labelFormatter={(label) => new Date(label).toLocaleDateString()}
                    />
                    <Bar dataKey="calls" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No data for selected period
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost by Agency */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cost by Agency</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {agencyCosts.map((agency, index) => (
              <div key={agency.agency_id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <div>
                    <p className="font-medium">{agency.agency_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {agency.total_calls} calls • Avg: {formatCurrency(agency.avg_cost_per_call)}/call
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatCurrencyShort(agency.total_cost)}</p>
                </div>
              </div>
            ))}
            {agencyCosts.length === 0 && (
              <p className="text-muted-foreground text-center py-4">No data for selected period</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Calls with Costs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Calls (Cost Details)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2">File</th>
                  <th className="text-left py-2 px-2">Agency</th>
                  <th className="text-right py-2 px-2">Duration</th>
                  <th className="text-right py-2 px-2">Whisper</th>
                  <th className="text-right py-2 px-2">GPT Tokens</th>
                  <th className="text-right py-2 px-2">GPT Cost</th>
                  <th className="text-right py-2 px-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentCalls.map((call) => (
                  <tr key={call.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2 px-2 truncate max-w-[150px]" title={call.original_filename || undefined}>
                      {call.original_filename || '-'}
                    </td>
                    <td className="py-2 px-2">{call.agencies?.name || '-'}</td>
                    <td className="py-2 px-2 text-right">
                      {call.call_duration_seconds ? `${(call.call_duration_seconds / 60).toFixed(1)}m` : '-'}
                    </td>
                    <td className="py-2 px-2 text-right text-chart-2">
                      {call.whisper_cost ? formatCurrency(call.whisper_cost) : '-'}
                    </td>
                    <td className="py-2 px-2 text-right text-muted-foreground">
                      {call.gpt_input_tokens && call.gpt_output_tokens 
                        ? `${call.gpt_input_tokens} / ${call.gpt_output_tokens}`
                        : '-'}
                    </td>
                    <td className="py-2 px-2 text-right text-chart-5">
                      {call.gpt_cost ? formatCurrency(call.gpt_cost) : '-'}
                    </td>
                    <td className="py-2 px-2 text-right font-medium text-chart-1">
                      {call.total_cost ? formatCurrency(call.total_cost) : '-'}
                    </td>
                  </tr>
                ))}
                {recentCalls.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-muted-foreground">
                      No calls in selected period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCallScoringDashboard;
