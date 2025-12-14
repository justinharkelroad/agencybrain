import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { 
  DollarSign, 
  Phone, 
  TrendingUp, 
  Building, 
  Mic,
  Brain
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
} from 'recharts';

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
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [agencyCosts, setAgencyCosts] = useState<AgencyCosts[]>([]);
  const [dailyCosts, setDailyCosts] = useState<DailyCosts[]>([]);
  const [recentCalls, setRecentCalls] = useState<CallRecord[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    
    // Fetch overall summary
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
      .eq('status', 'analyzed');

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

      // Group by day (last 30 days)
      const dailyMap = new Map<string, DailyCosts>();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      typedCalls
        .filter(c => new Date(c.created_at) >= thirtyDaysAgo)
        .forEach(call => {
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

      // Recent calls with costs
      const recent = typedCalls
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);
      setRecentCalls(recent);
    }

    setLoading(false);
  };

  const formatCurrency = (value: number) => `$${value.toFixed(4)}`;
  const formatCurrencyShort = (value: number) => `$${value.toFixed(2)}`;

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

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
              Using call scoring
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
            <CardTitle className="text-sm">Daily Costs (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyCosts}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="date" 
                    className="text-muted-foreground"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis className="text-muted-foreground" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  <Line type="monotone" dataKey="cost" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Calls per Day Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Calls per Day (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
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
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  <Bar dataKey="calls" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
              <p className="text-muted-foreground text-center py-4">No data yet</p>
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
                      No calls with cost data yet
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
