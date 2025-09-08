import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TrendingUp, Users, Target, Award, CalendarIcon, Eye } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import TeamPerformanceRings from "@/components/rings/TeamPerformanceRings";
import { Link } from "react-router-dom";

type Role = "Sales" | "Service";
type Tiles = {
  outbound_calls: number; 
  talk_minutes: number; 
  quoted: number;
  sold_items: number; 
  sold_policies: number; 
  sold_premium_cents: number;
  pass_rate: number;
  cross_sells_uncovered?: number;
  mini_reviews?: number;
};

type TableRow = {
  team_member_id: string; 
  team_member_name: string; 
  role: Role; 
  date: string;
  outbound_calls: number; 
  talk_minutes: number; 
  quoted_count: number;
  sold_items: number; 
  sold_policies: number; 
  sold_premium_cents: number;
  pass_days: number; 
  score_sum: number; 
  streak: number;
  cross_sells_uncovered?: number;
  mini_reviews?: number;
};

type DailySeries = {
  date: string; 
  outbound_calls: number; 
  talk_minutes: number; 
  quoted_count: number;
  sold_items: number; 
  sold_policies: number; 
  sold_premium_cents: number; 
  pass_count: number;
};

export default function MetricsDashboard() {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const [agencySlug, setAgencySlug] = useState<string>("");
  const [role, setRole] = useState<Role>("Sales");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  // Fixed metrics based on default KPIs - no user selection needed
  const quotedLabel = "households";
  const soldMetric = "items";
  const [tiles, setTiles] = useState<Tiles | null>(null);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [series, setSeries] = useState<DailySeries[]>([]);
  const [contest, setContest] = useState<TableRow[]>([]);
  const [contestEnabled, setContestEnabled] = useState<boolean>(false);
  const [agencyName, setAgencyName] = useState<string>("");
  const [agencyId, setAgencyId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scorecardRules, setScorecardRules] = useState<any>(null);

  // Get agency slug from user profile
  const fetchAgencySlug = useCallback(async () => {
    if (!user) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single();
      
    if (profile?.agency_id) {
      const { data: agency } = await supabase
        .from('agencies')
        .select('slug, name')
        .eq('id', profile.agency_id)
        .single();
      if (agency?.slug) {
        setAgencySlug(agency.slug);
        setAgencyName(agency.name || "");
        setAgencyId(profile.agency_id);
      }
      
      // Fetch scorecard rules for this agency and role
      const { data: rules } = await supabase
        .from('scorecard_rules')
        .select('*')
        .eq('agency_id', profile.agency_id)
        .eq('role', role)
        .single();
      setScorecardRules(rules);
    }
  }, [user, role]);

  useEffect(() => {
    fetchAgencySlug();
  }, [fetchAgencySlug]);

  const fetchData = useCallback(async () => {
    if (!agencySlug || loading) return;
    
    setLoading(true);
    setErr(null);
    
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      
      // Send same date as both start and end for single-day view
      const dateString = format(selectedDate, "yyyy-MM-dd");
      
      const res = await supabase.functions.invoke('get_dashboard', {
        body: { agencySlug, role, start: dateString, end: dateString, quotedLabel, soldMetric },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.error) {
        throw new Error(res.error.message || 'Dashboard fetch failed');
      }

      const data = res.data;
      setTiles(data.tiles);
      setRows(data.table);
      setSeries(data.dailySeries);
      setContest(data.contest);
      setContestEnabled(!!data.meta?.contest_board_enabled);
      if (data.meta?.agencyName) {
        setAgencyName(data.meta.agencyName);
      }
    } catch (error: any) {
      setErr(error.message || "Failed to load dashboard");
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  }, [agencySlug, role, selectedDate, quotedLabel, soldMetric, loading]);

  useEffect(() => {
    if (agencySlug && !loading) {
      fetchData();
    }
  }, [agencySlug, role, selectedDate, fetchData]);

  const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Get role-based metric labels and display logic
  const getMetricConfig = () => {
    if (!scorecardRules) return { selectedMetrics: [], isService: false };
    
    const selectedMetrics = scorecardRules.selected_metrics || [];
    const ringMetrics = scorecardRules.ring_metrics || [];
    const isService = role === 'Service';
    
    return {
      selectedMetrics: selectedMetrics.filter(Boolean), // Filter out any null/undefined values
      ringMetrics: ringMetrics.filter(Boolean), // Filter out any null/undefined values
      isService,
      quotedLabel: isService ? 'cross_sells_uncovered' : 'quoted_count',
      soldLabel: isService ? 'mini_reviews' : 'sold_items',
      quotedTitle: isService ? 'Cross-sells' : 'Quoted Households', 
      soldTitle: isService ? 'Mini Reviews' : 'Items Sold'
    };
  };

  const metricConfig = getMetricConfig();

  return (
    <div className="bg-background" data-testid="metrics-dashboard">
      {/* Remove TopNav since this component is embedded in ScorecardForms which already has TopNav */}

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
            <TrendingUp className="h-4 w-4" />
            <span>Metrics Dashboard</span>
          </div>
          {agencyName && (
            <h1 className="text-3xl font-bold leading-none tracking-tight flex items-center gap-2">
              <span>{`${agencyName}${/[sS]$/.test(agencyName.trim()) ? "'" : "'s"} ${role} Dashboard`}</span>
            </h1>
          )}
        </div>

        {/* Controls */}
        <Card className="glass-surface">
          <CardHeader>
            <CardTitle className="text-lg">Dashboard Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium">Role</label>
                <select 
                  className="border border-input bg-background px-3 py-2 rounded-md text-sm"
                  value={role} 
                  onChange={e => setRole(e.target.value as Role)}
                >
                  <option value="Sales">Sales</option>
                  <option value="Service">Service</option>
                </select>
              </div>
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {loading && (
              <div className="flex items-center gap-2 mt-4">
                <LoadingSpinner />
                <span className="text-sm text-muted-foreground">Loading dashboard data...</span>
              </div>
            )}
            {err && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">Error: {err}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Member Performance Rings */}
        {agencyId && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Team Performance Overview</h2>
              <Link to="/team-rings">
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  View Full Team Performance
                </Button>
              </Link>
            </div>
            <TeamPerformanceRings 
              agencyId={agencyId}
              role={role}
              date={format(selectedDate, "yyyy-MM-dd")}
            />
          </div>
        )}

        {/* Tiles - Dynamic based on role */}
        {tiles && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {metricConfig.selectedMetrics.includes('outbound_calls') && (
              <MetricTile title="Outbound Calls" value={tiles.outbound_calls} icon={<Target className="h-5 w-5" />} />
            )}
            {metricConfig.selectedMetrics.includes('talk_minutes') && (
              <MetricTile title="Talk Minutes" value={tiles.talk_minutes} icon={<Users className="h-5 w-5" />} />
            )}
            {metricConfig.selectedMetrics.includes('quoted_count') && role === 'Sales' && (
              <MetricTile title="Quoted Households" value={tiles.quoted} icon={<TrendingUp className="h-5 w-5" />} />
            )}
            {metricConfig.selectedMetrics.includes('sold_items') && role === 'Sales' && (
              <MetricTile title="Items Sold" value={tiles.sold_items} icon={<Award className="h-5 w-5" />} />
            )}
            {metricConfig.selectedMetrics.includes('cross_sells_uncovered') && role === 'Service' && tiles.cross_sells_uncovered !== undefined && (
              <MetricTile title="Cross-sells" value={tiles.cross_sells_uncovered || 0} icon={<TrendingUp className="h-5 w-5" />} />
            )}
            {metricConfig.selectedMetrics.includes('mini_reviews') && role === 'Service' && tiles.mini_reviews !== undefined && (
              <MetricTile title="Mini Reviews" value={tiles.mini_reviews || 0} icon={<Award className="h-5 w-5" />} />
            )}
          </div>
        )}

        {/* Table */}
        <Card className="glass-surface">
          <CardHeader>
            <CardTitle className="text-lg">Team Member Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <Th>Rep</Th>
                    {metricConfig.selectedMetrics.includes('outbound_calls') && <Th>Outbound</Th>}
                    {metricConfig.selectedMetrics.includes('talk_minutes') && <Th>Talk</Th>}
                    {metricConfig.selectedMetrics.includes('quoted_count') && role === 'Sales' && <Th>Quoted Households</Th>}
                    {metricConfig.selectedMetrics.includes('sold_items') && role === 'Sales' && <Th>Items Sold</Th>}
                    {metricConfig.selectedMetrics.includes('cross_sells_uncovered') && role === 'Service' && <Th>Cross-sells</Th>}
                    {metricConfig.selectedMetrics.includes('mini_reviews') && role === 'Service' && <Th>Mini Reviews</Th>}
                    <Th>Pass Days</Th>
                    <Th>Score</Th>
                    <Th>Streak</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.team_member_id} className="border-b border-border/50">
                      <Td className="font-medium">{r.team_member_name}</Td>
                      {metricConfig.selectedMetrics.includes('outbound_calls') && <Td>{r.outbound_calls}</Td>}
                      {metricConfig.selectedMetrics.includes('talk_minutes') && <Td>{r.talk_minutes}</Td>}
                      {metricConfig.selectedMetrics.includes('quoted_count') && role === 'Sales' && <Td>{r.quoted_count}</Td>}
                      {metricConfig.selectedMetrics.includes('sold_items') && role === 'Sales' && <Td>{r.sold_items}</Td>}
                      {metricConfig.selectedMetrics.includes('cross_sells_uncovered') && role === 'Service' && <Td>{r.cross_sells_uncovered || 0}</Td>}
                      {metricConfig.selectedMetrics.includes('mini_reviews') && role === 'Service' && <Td>{r.mini_reviews || 0}</Td>}
                      <Td>
                        <Badge variant={r.pass_days > 0 ? "default" : "secondary"}>
                          {r.pass_days}
                        </Badge>
                      </Td>
                      <Td>{r.score_sum}</Td>
                      <Td>
                        <Badge variant={r.streak > 0 ? "default" : "secondary"}>
                          {r.streak}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Contest board */}
        {contestEnabled && contest.length > 0 && (
          <Card className="glass-surface">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="h-5 w-5" />
                Contest Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {contest.map((r, i) => (
                  <li key={r.team_member_id} className="flex items-center justify-between p-3 bg-card/50 rounded-lg border border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-muted-foreground">#{i + 1}</span>
                        {i < 3 && <span className="text-xl">{["🥇", "🥈", "🥉"][i]}</span>}
                      </div>
                      <span className="font-medium">{r.team_member_name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Score: <span className="font-medium">{r.score_sum}</span></span>
                      <span>Pass: <span className="font-medium">{r.pass_days}</span></span>
                      <span>Streak: <span className="font-medium">{r.streak}</span></span>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function MetricTile({ 
  title, 
  value, 
  icon, 
  isMonetary = false 
}: { 
  title: string; 
  value: number | string; 
  icon: React.ReactNode;
  isMonetary?: boolean;
}) {
  return (
    <Card className="glass-surface hover-scale">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold text-foreground">
              {isMonetary ? value : typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          </div>
          <div className="text-primary opacity-70">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left p-3 font-medium text-foreground ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`p-3 text-muted-foreground ${className}`}>{children}</td>;
}