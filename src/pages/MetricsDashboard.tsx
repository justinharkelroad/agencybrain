import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { supa } from "@/lib/supabase";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Target, Award } from "lucide-react";
import TeamPerformanceRings from "@/components/rings/TeamPerformanceRings";

type Role = "Sales" | "Service";
type Tiles = {
  outbound_calls: number; 
  talk_minutes: number; 
  quoted: number;
  sold_items: number; 
  sold_policies: number; 
  sold_premium_cents: number;
  pass_rate: number;
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
  // Default to previous business day only
  const getPreviousBusinessDay = () => {
    const yesterday = new Date(Date.now() - 86400000);
    return yesterday.toISOString().slice(0, 10);
  };
  const [start, setStart] = useState<string>(getPreviousBusinessDay());
  const [end, setEnd] = useState<string>(getPreviousBusinessDay());
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

  // Get agency slug from user profile
  useEffect(() => {
    const fetchAgencySlug = async () => {
      if (!user) return;
      const { data: profile } = await supa
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();
        
      if (profile?.agency_id) {
        const { data: agency } = await supa
          .from('agencies')
          .select('slug, name')
          .eq('id', profile.agency_id)
          .single();
        if (agency?.slug) {
          setAgencySlug(agency.slug);
          setAgencyName(agency.name || "");
          setAgencyId(profile.agency_id);
        }
      }
    };
    fetchAgencySlug();
  }, [user]);

  const fetchData = async () => {
    if (!agencySlug) return;
    
    setLoading(true);
    setErr(null);
    
    try {
      const { data: session } = await supa.auth.getSession();
      const token = session?.session?.access_token;
      
      const res = await supa.functions.invoke('get_dashboard', {
        body: { agencySlug, role, start, end, quotedLabel, soldMetric },
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
  };

  useEffect(() => {
    if (agencySlug) {
      fetchData();
    }
  }, [agencySlug, role, start, end]);

  const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
            <div className="grid gap-4 md:grid-cols-3">
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
                <label className="text-sm font-medium">Start Date</label>
                <input 
                  className="border border-input bg-background px-3 py-2 rounded-md text-sm"
                  type="date" 
                  value={start} 
                  onChange={e => setStart(e.target.value)} 
                />
              </div>
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <input 
                  className="border border-input bg-background px-3 py-2 rounded-md text-sm"
                  type="date" 
                  value={end} 
                  onChange={e => setEnd(e.target.value)} 
                />
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
          <TeamPerformanceRings 
            agencyId={agencyId}
            role={role}
            date={end} // Use end date since it's the most recent in the range
          />
        )}

        {/* Tiles - Default 4 KPIs only */}
        {tiles && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricTile title="Outbound Calls" value={tiles.outbound_calls} icon={<Target className="h-5 w-5" />} />
            <MetricTile title="Talk Minutes" value={tiles.talk_minutes} icon={<Users className="h-5 w-5" />} />
            <MetricTile title="Quoted Households" value={tiles.quoted} icon={<TrendingUp className="h-5 w-5" />} />
            <MetricTile title="Items Sold" value={tiles.sold_items} icon={<Award className="h-5 w-5" />} />
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
                    <Th>Outbound</Th>
                    <Th>Talk</Th>
                     <Th>Quoted Households</Th>
                     <Th>Items Sold</Th>
                    <Th>Pass Days</Th>
                    <Th>Score</Th>
                    <Th>Streak</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.team_member_id} className="border-b border-border/50">
                      <Td className="font-medium">{r.team_member_name}</Td>
                      <Td>{r.outbound_calls}</Td>
                      <Td>{r.talk_minutes}</Td>
                       <Td>{r.quoted_count}</Td>
                       <Td>{r.sold_items}</Td>
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