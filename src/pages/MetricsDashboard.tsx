import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TrendingUp, Users, Target, Award, CalendarIcon, Eye, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import TeamPerformanceRings from "@/components/rings/TeamPerformanceRings";
import { Link } from "react-router-dom";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { DashboardError } from "@/components/DashboardError";
import { useDashboardDataWithFallback } from "@/hooks/useVersionedDashboardData";
import { useAgencyProfile } from "@/hooks/useAgencyProfile";
import { useKpis } from "@/hooks/useKpis";

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

  const [role, setRole] = useState<Role>("Sales");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  // Fixed metrics based on default KPIs - no user selection needed
  const quotedLabel = "households";
  const soldMetric = "items";

  // Load agency profile data
  const {
    data: agencyProfile,
    isLoading: agencyLoading,
    error: agencyError,
  } = useAgencyProfile(user?.id, role);

  // Load dashboard data
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard,
    isFetching: dashboardFetching,
  } = useDashboardDataWithFallback(
    agencyProfile?.agencySlug || "",
    role,
    { consolidateVersions: false }
  );

  // Load KPIs for the current agency - temporarily disabled to prevent 404s
  const kpisData = null;
  const kpisLoading = false;

  // Show loading skeleton on first load
  if (agencyLoading || (dashboardLoading && !dashboardData)) {
    return <DashboardSkeleton />;
  }

  // Show error state with retry
  if (agencyError) {
    return (
      <DashboardError 
        error={agencyError} 
        onRetry={() => window.location.reload()} 
      />
    );
  }

  if (dashboardError) {
    return (
      <DashboardError 
        error={dashboardError} 
        onRetry={refetchDashboard}
        isRetrying={dashboardFetching}
      />
    );
  }

  // Always render content with data fallbacks
  const tiles = dashboardData?.tiles || {
    outbound_calls: 0,
    talk_minutes: 0,
    quoted: 0,
    sold_items: 0,
    sold_policies: 0,
    sold_premium_cents: 0,
    pass_rate: 0,
  };
  
  const rows = dashboardData?.table || [];
  const contest = dashboardData?.contest || [];
  const contestEnabled = !!dashboardData?.meta?.contest_board_enabled;
  const agencyName = agencyProfile?.agencyName || dashboardData?.meta?.agencyName || "";
  const agencyId = agencyProfile?.agencyId || "";
  const scorecardRules = agencyProfile?.scorecardRules;

  const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Get role-based metric labels using versioned data (label_at_submit wins)
  const getMetricConfig = () => {
    const selectedMetrics = scorecardRules?.selected_metric_slugs || scorecardRules?.selected_metrics || [];
    const ringMetrics = scorecardRules?.ring_metrics || [];
    const isService = role === 'Service';
    
    // Create label map from versioned metrics data (uses label_at_submit)
    const labelMap = new Map<string, string>();
    if (dashboardData?.metrics) {
      dashboardData.metrics.forEach((metric: any) => {
        if (metric.kpi_key && metric.kpi_label) {
          labelMap.set(metric.kpi_key, metric.kpi_label);
        }
      });
    }
    
    // Get KPI label from versioned data first, fallback to slug
    const getKpiLabel = (slug: string) => {
      return labelMap.get(slug) || slug;
    };
    
    return {
      selectedMetrics: selectedMetrics.filter(Boolean),
      ringMetrics: ringMetrics.filter(Boolean),
      isService,
      quotedLabel: isService ? 'cross_sells_uncovered' : 'quoted_count',
      soldLabel: isService ? 'mini_reviews' : 'sold_items',
      quotedTitle: isService ? getKpiLabel('cross_sells_uncovered') : getKpiLabel('quoted_count'), 
      soldTitle: isService ? getKpiLabel('mini_reviews') : getKpiLabel('sold_items'),
      getKpiLabel,
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Dashboard Controls</CardTitle>
            {dashboardFetching && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Refreshing...</span>
              </div>
            )}
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {metricConfig.selectedMetrics.includes('outbound_calls') && (
            <MetricTile title={metricConfig.getKpiLabel('outbound_calls')} value={tiles.outbound_calls} icon={<Target className="h-5 w-5" />} />
          )}
          {metricConfig.selectedMetrics.includes('talk_minutes') && (
            <MetricTile title={metricConfig.getKpiLabel('talk_minutes')} value={tiles.talk_minutes} icon={<Users className="h-5 w-5" />} />
          )}
          {metricConfig.selectedMetrics.includes('quoted_count') && role === 'Sales' && (
            <MetricTile title={metricConfig.quotedTitle} value={tiles.quoted} icon={<TrendingUp className="h-5 w-5" />} />
          )}
          {metricConfig.selectedMetrics.includes('sold_items') && role === 'Sales' && (
            <MetricTile title={metricConfig.soldTitle} value={tiles.sold_items} icon={<Award className="h-5 w-5" />} />
          )}
          {metricConfig.selectedMetrics.includes('cross_sells_uncovered') && role === 'Service' && tiles.cross_sells_uncovered !== undefined && (
            <MetricTile title={metricConfig.quotedTitle} value={tiles.cross_sells_uncovered || 0} icon={<TrendingUp className="h-5 w-5" />} />
          )}
          {metricConfig.selectedMetrics.includes('mini_reviews') && role === 'Service' && tiles.mini_reviews !== undefined && (
            <MetricTile title={metricConfig.soldTitle} value={tiles.mini_reviews || 0} icon={<Award className="h-5 w-5" />} />
          )}
        </div>

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
                    {metricConfig.selectedMetrics.includes('outbound_calls') && <Th>{metricConfig.getKpiLabel('outbound_calls')}</Th>}
                    {metricConfig.selectedMetrics.includes('talk_minutes') && <Th>{metricConfig.getKpiLabel('talk_minutes')}</Th>}
                    {metricConfig.selectedMetrics.includes('quoted_count') && role === 'Sales' && <Th>{metricConfig.quotedTitle}</Th>}
                    {metricConfig.selectedMetrics.includes('sold_items') && role === 'Sales' && <Th>{metricConfig.soldTitle}</Th>}
                    {metricConfig.selectedMetrics.includes('cross_sells_uncovered') && role === 'Service' && <Th>{metricConfig.quotedTitle}</Th>}
                    {metricConfig.selectedMetrics.includes('mini_reviews') && role === 'Service' && <Th>{metricConfig.soldTitle}</Th>}
                    <Th>Pass Days</Th>
                    <Th>Score</Th>
                    <Th>Streak</Th>
                  </tr>
                </thead>
                <tbody>
                   {rows.map((r, index) => (
                     <tr key={`${r.team_member_id}-${index}`} className="border-b border-border/50">
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
          {dashboardFetching && (
            <div className="flex items-center gap-2 mt-4">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Refreshing dashboard data...</span>
            </div>
          )}
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
                   <li key={`${r.team_member_id}-${i}`} className="flex items-center justify-between p-3 bg-card/50 rounded-lg border border-border/50">
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