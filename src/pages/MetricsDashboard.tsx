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
import { useDashboardDaily } from "@/hooks/useDashboardDaily";
import { useAgencyProfile } from "@/hooks/useAgencyProfile";
import { useKpiLabels } from "@/hooks/useKpiLabels";
import { RING_LABELS } from "@/components/rings/colors";
import { HelpButton } from '@/components/HelpButton';
import { AgencyDailyGoals } from '@/components/dashboard/AgencyDailyGoals';


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

interface StaffAgencyProfile {
  agencyId: string;
  agencySlug: string;
  agencyName: string;
}

interface MetricsDashboardProps {
  staffAgencyProfile?: StaffAgencyProfile | null;
  defaultDate?: Date;
}

export default function MetricsDashboard({ staffAgencyProfile, defaultDate }: MetricsDashboardProps) {
  const { user } = useAuth();
  const isStaffMode = !!staffAgencyProfile;
  
  // For staff users, skip the redirect - they authenticate differently
  if (!user && !isStaffMode) {
    return <Navigate to="/auth" replace />;
  }

  const [role, setRole] = useState<Role>("Sales");
  const [selectedDate, setSelectedDate] = useState<Date>(defaultDate || new Date());
  // Fixed metrics based on default KPIs - no user selection needed
  const quotedLabel = "households";
  const soldMetric = "items";

  // Load agency profile data - use staffAgencyProfile for staff users
  const {
    data: agencyProfile,
    isLoading: agencyLoading,
    error: agencyError,
  } = useAgencyProfile(isStaffMode ? undefined : user?.id, role, staffAgencyProfile || undefined);

  // Load dashboard data for the selected date only
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard,
    isFetching: dashboardFetching,
  } = useDashboardDaily(
    agencyProfile?.agencySlug || "",
    role,
    selectedDate
  );

  // Load KPI labels from database (replaces hardcoded labels)
  // Pass role to get role-specific labels (e.g., Service's "Life Referrals" vs Sales's "Outbound Calls")
  const { data: kpiLabels } = useKpiLabels(agencyProfile?.agencyId, role);

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
  const contest = [];
  const contestEnabled = false;
  const agencyName = agencyProfile?.agencyName || "";
  const agencyId = agencyProfile?.agencyId || "";
  const scorecardRules = agencyProfile?.scorecardRules;

  // Transform tiles array to object format for backward compatibility
  const tilesObject = (dashboardData?.tiles || []).reduce((acc, tile) => {
    switch(tile.title) {
      case 'Outbound Calls':
        acc.outbound_calls = tile.value;
        break;
      case 'Talk Minutes':
        acc.talk_minutes = tile.value;
        break;
      case 'Quoted':
        acc.quoted = tile.value;
        break;
      case 'Sold Items':
        acc.sold_items = tile.value;
        break;
      case 'Cross-Sells Uncovered':
        acc.cross_sells_uncovered = tile.value;
        break;
      case 'Mini Reviews':
        acc.mini_reviews = tile.value;
        break;
    }
    return acc;
  }, {
    outbound_calls: 0,
    talk_minutes: 0,
    quoted: 0,
    sold_items: 0,
    cross_sells_uncovered: 0,
    mini_reviews: 0,
  });

  const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Get role-based metric labels using database labels (from kpi_versions)
  const getMetricConfig = () => {
    const selectedMetrics = (scorecardRules?.selected_metric_slugs?.length > 0 
      ? scorecardRules.selected_metric_slugs 
      : scorecardRules?.selected_metrics) || [];
    const ringMetrics = (scorecardRules?.ring_metrics?.length > 0 
      ? scorecardRules.ring_metrics 
      : scorecardRules?.selected_metrics) || [];
    const isService = role === 'Service';
    
    // Get KPI label from database first, fallback to RING_LABELS, then slug
    const getKpiLabel = (slug: string) => {
      return kpiLabels?.[slug] || RING_LABELS[slug] || slug;
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
        {/* Setup component removed - now available at admin route only */}
        
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
            <TrendingUp className="h-4 w-4" />
            <span>Metrics Dashboard</span>
            <HelpButton videoKey="metrics-overview" />
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
                      <span>{selectedDate ? format(selectedDate, "PPP") : "Pick a date"}</span>
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

        {/* Agency Daily Goals */}
        {agencyId && (
          <AgencyDailyGoals agencyId={agencyId} date={format(selectedDate, "yyyy-MM-dd")} showDate />
        )}

        {/* Team Member Performance Rings */}
        {agencyId && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Team Performance Overview</h2>
              <Link to={isStaffMode ? "/staff/team-rings" : "/team-rings"}>
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
            <MetricTile title={metricConfig.getKpiLabel('outbound_calls')} value={tilesObject.outbound_calls} icon={<Target className="h-5 w-5" />} />
          )}
          {metricConfig.selectedMetrics.includes('talk_minutes') && (
            <MetricTile title={metricConfig.getKpiLabel('talk_minutes')} value={tilesObject.talk_minutes} icon={<Users className="h-5 w-5" />} />
          )}
          {(metricConfig.selectedMetrics.includes('quoted_count') || metricConfig.selectedMetrics.includes('quoted_households')) && role === 'Sales' && (
            <MetricTile title={metricConfig.quotedTitle} value={tilesObject.quoted} icon={<TrendingUp className="h-5 w-5" />} />
          )}
          {(metricConfig.selectedMetrics.includes('sold_items') || metricConfig.selectedMetrics.includes('items_sold')) && role === 'Sales' && (
            <MetricTile title={metricConfig.soldTitle} value={tilesObject.sold_items} icon={<Award className="h-5 w-5" />} />
          )}
          {metricConfig.selectedMetrics.includes('cross_sells_uncovered') && role === 'Service' && tilesObject.cross_sells_uncovered !== undefined && (
            <MetricTile title={metricConfig.quotedTitle} value={tilesObject.cross_sells_uncovered || 0} icon={<TrendingUp className="h-5 w-5" />} />
          )}
          {metricConfig.selectedMetrics.includes('mini_reviews') && role === 'Service' && tilesObject.mini_reviews !== undefined && (
            <MetricTile title={metricConfig.soldTitle} value={tilesObject.mini_reviews || 0} icon={<Award className="h-5 w-5" />} />
          )}
        </div>

        {/* Table */}
        <Card className="glass-surface">
          <CardHeader>
            <CardTitle className="text-lg">Team Member Performance</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Column names reflect KPI labels from most recent submissions • Renamed KPIs update after next submission
            </p>
          </CardHeader>
           <CardContent>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <Th>Rep</Th>
                    {metricConfig.selectedMetrics.includes('outbound_calls') && <Th>{metricConfig.getKpiLabel('outbound_calls')}</Th>}
                    {metricConfig.selectedMetrics.includes('talk_minutes') && <Th>{metricConfig.getKpiLabel('talk_minutes')}</Th>}
                    {(metricConfig.selectedMetrics.includes('quoted_count') || metricConfig.selectedMetrics.includes('quoted_households')) && role === 'Sales' && <Th>{metricConfig.quotedTitle}</Th>}
                    {(metricConfig.selectedMetrics.includes('sold_items') || metricConfig.selectedMetrics.includes('items_sold')) && role === 'Sales' && <Th>{metricConfig.soldTitle}</Th>}
                    {metricConfig.selectedMetrics.includes('cross_sells_uncovered') && role === 'Service' && <Th>{metricConfig.quotedTitle}</Th>}
                    {metricConfig.selectedMetrics.includes('mini_reviews') && role === 'Service' && <Th>{metricConfig.soldTitle}</Th>}
                    <Th>Pass Days</Th>
                    <Th>Score</Th>
                    <Th>Streak</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-3">
                          <div className="text-4xl opacity-50">📝</div>
                          <div className="text-lg font-medium">No submissions for selected date</div>
                          <div className="text-sm">Select a different date or check back after team members submit their scorecards.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, index) => (
                      <tr key={`${r.team_member_id}-${r.date || index}`} className="border-b border-border/50">
                        <Td className="font-medium">{r.name || r.rep_name}</Td>
                        {metricConfig.selectedMetrics.includes('outbound_calls') && <Td>{r.outbound_calls}</Td>}
                        {metricConfig.selectedMetrics.includes('talk_minutes') && <Td>{r.talk_minutes}</Td>}
                        {(metricConfig.selectedMetrics.includes('quoted_count') || metricConfig.selectedMetrics.includes('quoted_households')) && role === 'Sales' && <Td>{r.quoted_count}</Td>}
                        {(metricConfig.selectedMetrics.includes('sold_items') || metricConfig.selectedMetrics.includes('items_sold')) && role === 'Sales' && <Td>{r.sold_items}</Td>}
                        {metricConfig.selectedMetrics.includes('cross_sells_uncovered') && role === 'Service' && <Td>{r.cross_sells_uncovered || 0}</Td>}
                        {metricConfig.selectedMetrics.includes('mini_reviews') && role === 'Service' && <Td>{r.mini_reviews || 0}</Td>}
                        <Td>
                          <Badge variant={r.pass ? "default" : "secondary"}>
                            {r.pass ? 1 : 0}
                          </Badge>
                        </Td>
                        <Td>{r.daily_score}</Td>
                        <Td>
                          <Badge variant="secondary">
                            0
                          </Badge>
                        </Td>
                      </tr>
                    ))
                  )}
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