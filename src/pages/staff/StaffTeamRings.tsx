import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { fetchWithAuth } from "@/lib/staffRequest";
import { getPreviousBusinessDay } from "@/utils/businessDays";
import MemberRingsCard from "@/components/rings/MemberRingsCard";
import RingLegend from "@/components/rings/RingLegend";
import { RING_LABELS, getRingColor } from "@/components/rings/colors";
import PersonSnapshotModal from "@/components/PersonSnapshotModal";
type TeamMetricRow = {
  team_member_id: string;
  name: string;
  role: string;
  date: string;
  outbound_calls: number;
  talk_minutes: number;
  quoted_count?: number;
  quoted_households?: number;
  quoted_entity: string | null;
  sold_items?: number;
  items_sold?: number;
  sold_policies: number;
  sold_premium_cents: number;
  cross_sells_uncovered: number;
  mini_reviews: number;
};

type Target = {
  team_member_id: string | null;
  metric_key: string;
  value_number: number;
};

type ScorecardRule = {
  ring_metrics?: string[];
  selected_metrics?: string[];
};

export default function StaffTeamRings() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TeamMetricRow[]>([]);
  const [ringMetrics, setRingMetrics] = useState<string[]>(["outbound_calls", "talk_minutes", "quoted_count", "sold_items"]);
  const [targets, setTargets] = useState<Record<string, Record<string, number>>>({});
  const [selectedRole, setSelectedRole] = useState<"Sales" | "Service">("Sales");
  const [selectedDate, setSelectedDate] = useState<string>(
    format(getPreviousBusinessDay(), "yyyy-MM-dd")
  );
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [kpiLabels, setKpiLabels] = useState<Record<string, string>>({});

  // Load team rings data via edge function
  useEffect(() => {
    loadTeamRingsData();
  }, [selectedRole, selectedDate]);

  const loadTeamRingsData = async () => {
    setLoading(true);
    
    try {
      const staffToken = localStorage.getItem('staff_session_token');
      
      if (!staffToken) {
        toast.error('No staff session found. Please log in again.');
        return;
      }

      // Use fetchWithAuth to avoid JWT collision when owner is also logged in
      const response = await fetchWithAuth('scorecards_admin', {
        method: 'POST',
        body: { 
          action: 'team_rings_data', 
          role: selectedRole, 
          date: selectedDate 
        },
      });
      
      const data = await response.json();

      if (!response.ok || data?.error) {
        console.error('Edge function error:', data?.error);
        toast.error(data?.error || 'Failed to load team performance data');
        return;
      }

      // Extract data from response
      const { rules, teamMetrics, targets: targetsData, kpiLabels: kpiLabelsData } = data;

      // Set ring metrics from rules
      if (rules) {
        const metrics = (rules.ring_metrics?.length > 0 
          ? rules.ring_metrics 
          : rules.selected_metrics) || ringMetrics;
        setRingMetrics(metrics);
      }

      // Set KPI labels from response
      if (kpiLabelsData) {
        setKpiLabels(kpiLabelsData);
      }

      // Set team metrics
      setRows(teamMetrics || []);

      // Build targets map
      if (targetsData) {
        const targetsMap: Record<string, Record<string, number>> = {};
        const globalTargets: Record<string, number> = {};

        // Collect global targets (where team_member_id is null)
        targetsData
          .filter((t: Target) => !t.team_member_id)
          .forEach((t: Target) => {
            globalTargets[t.metric_key] = Number(t.value_number || 0);
          });

        // For each team member, start with global targets and apply overrides
        const memberIds = new Set((teamMetrics || []).map((r: TeamMetricRow) => r.team_member_id));
        memberIds.forEach((memberId) => {
          targetsMap[memberId as string] = { ...globalTargets };
          
          targetsData
            .filter((t: Target) => t.team_member_id === memberId)
            .forEach((t: Target) => {
              targetsMap[memberId as string][t.metric_key] = Number(t.value_number || 0);
            });
        });

        setTargets(targetsMap);
      }

    } catch (error: any) {
      console.error('Error loading team rings data:', error);
      toast.error('Failed to load team performance data');
    } finally {
      setLoading(false);
    }
  };

  const handleMemberClick = (memberId: string) => {
    setSelectedMemberId(memberId);
    setSnapshotOpen(true);
  };

  const gridData = useMemo(() => {
    return rows.map((row) => {
      const memberTargets = targets[row.team_member_id] || {};
      
      const metrics = ringMetrics.map((key) => {
        // Get actual value for this metric
        const actual = (() => {
          switch (key) {
            case "outbound_calls": return row.outbound_calls || 0;
            case "talk_minutes": return row.talk_minutes || 0;
            case "quoted_count":
            case "quoted_households": 
              return row.quoted_households ?? row.quoted_count ?? 0;
            case "sold_items":
            case "items_sold": 
              return row.items_sold ?? row.sold_items ?? 0;
            case "sold_policies": return row.sold_policies || 0;
            case "sold_premium": return Math.round((row.sold_premium_cents || 0) / 100);
            case "cross_sells_uncovered": return row.cross_sells_uncovered || 0;
            case "mini_reviews": return row.mini_reviews || 0;
            default: return 0;
          }
        })();

        // Get target with role-based fallback
        const targetValue = Number(memberTargets[key]);
        const roleDefaults = selectedRole === "Sales" 
          ? { outbound_calls: 100, talk_minutes: 180, quoted_count: 5, sold_items: 2, sold_policies: 1, sold_premium: 500 }
          : { outbound_calls: 30, talk_minutes: 180, cross_sells_uncovered: 2, mini_reviews: 5 };
        
        const target = targetValue > 0 ? targetValue : (roleDefaults as any)[key] || 0;
        const progress = target > 0 ? Math.min(actual / target, 1) : 0;
        
        return {
          key,
          label: kpiLabels[key] || RING_LABELS[key] || key,
          progress,
          color: getRingColor(key),
          actual,
          target
        };
      });

      return {
        id: row.team_member_id,
        name: row.name,
        date: row.date,
        metrics
      };
    });
  }, [rows, targets, ringMetrics, kpiLabels, selectedRole]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Link to="/staff/metrics" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Metrics
        </Link>
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center gap-3">
              <Users className="h-5 w-5 animate-pulse" />
              <span className="text-muted-foreground">Loading team performance data...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/staff/metrics" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Metrics
      </Link>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Performance Rings
          </CardTitle>
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="role-select">Role:</Label>
              <Select value={selectedRole} onValueChange={(value: "Sales" | "Service") => setSelectedRole(value)}>
                <SelectTrigger id="role-select" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="Service">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="date-select">Date:</Label>
              <Input
                id="date-select"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <RingLegend metrics={ringMetrics} kpiLabels={kpiLabels} />
          
          {gridData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No team members found for the selected role and date.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {gridData.map((member, index) => (
                <MemberRingsCard
                  key={`${member.name}-${index}`}
                  name={member.name}
                  date={member.date}
                  metrics={member.metrics}
                  memberId={member.id}
                  onMemberClick={handleMemberClick}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Member Performance Table */}
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Team Member Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left p-2 font-medium">Rep</th>
                    {ringMetrics.includes('outbound_calls') && (
                      <th className="text-left p-2 font-medium">{kpiLabels['outbound_calls'] || 'Outbound Calls'}</th>
                    )}
                    {ringMetrics.includes('talk_minutes') && (
                      <th className="text-left p-2 font-medium">{kpiLabels['talk_minutes'] || 'Talk Time Minutes'}</th>
                    )}
                    {(ringMetrics.includes('quoted_count') || ringMetrics.includes('quoted_households')) && (
                      <th className="text-left p-2 font-medium">{kpiLabels['quoted_count'] || kpiLabels['quoted_households'] || 'Quoted'}</th>
                    )}
                    {(ringMetrics.includes('sold_items') || ringMetrics.includes('items_sold')) && (
                      <th className="text-left p-2 font-medium">{kpiLabels['sold_items'] || kpiLabels['items_sold'] || 'Sold (Items)'}</th>
                    )}
                    {ringMetrics.includes('cross_sells_uncovered') && (
                      <th className="text-left p-2 font-medium">{kpiLabels['cross_sells_uncovered'] || 'Cross-Sells'}</th>
                    )}
                    {ringMetrics.includes('mini_reviews') && (
                      <th className="text-left p-2 font-medium">{kpiLabels['mini_reviews'] || 'Mini Reviews'}</th>
                    )}
                    <th className="text-left p-2 font-medium">Pass Days</th>
                    <th className="text-left p-2 font-medium">Score</th>
                    <th className="text-left p-2 font-medium">Streak</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    // Calculate if day passed based on metrics meeting targets
                    const memberTargets = targets[row.team_member_id] || {};
                    const roleDefaults = selectedRole === "Sales" 
                      ? { outbound_calls: 100, talk_minutes: 180, quoted_count: 5, sold_items: 2 }
                      : { outbound_calls: 30, talk_minutes: 180, cross_sells_uncovered: 2, mini_reviews: 5 };
                    
                    let metricsMetCount = 0;
                    ringMetrics.forEach((key) => {
                      const actual = (() => {
                        switch (key) {
                          case "outbound_calls": return row.outbound_calls;
                          case "talk_minutes": return row.talk_minutes;
                          case "quoted_count":
                          case "quoted_households": return row.quoted_count;
                          case "sold_items":
                          case "items_sold": return row.sold_items;
                          case "cross_sells_uncovered": return row.cross_sells_uncovered;
                          case "mini_reviews": return row.mini_reviews;
                          default: return 0;
                        }
                      })();
                      const targetValue = Number(memberTargets[key]);
                      const target = targetValue > 0 ? targetValue : (roleDefaults as any)[key] || 0;
                      if (target > 0 && actual >= target) metricsMetCount++;
                    });
                    const passed = metricsMetCount >= 3;
                    const score = Math.round((metricsMetCount / ringMetrics.length) * 100);
                    
                    return (
                      <tr 
                        key={`${row.team_member_id}-${index}`} 
                        className="border-b border-border/50 hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleMemberClick(row.team_member_id)}
                      >
                        <td className="p-2 font-medium">{row.name}</td>
                        {ringMetrics.includes('outbound_calls') && (
                          <td className="p-2">{row.outbound_calls}</td>
                        )}
                        {ringMetrics.includes('talk_minutes') && (
                          <td className="p-2">{row.talk_minutes}</td>
                        )}
                        {(ringMetrics.includes('quoted_count') || ringMetrics.includes('quoted_households')) && (
                          <td className="p-2">{row.quoted_count}</td>
                        )}
                        {(ringMetrics.includes('sold_items') || ringMetrics.includes('items_sold')) && (
                          <td className="p-2">{row.sold_items}</td>
                        )}
                        {ringMetrics.includes('cross_sells_uncovered') && (
                          <td className="p-2">{row.cross_sells_uncovered}</td>
                        )}
                        {ringMetrics.includes('mini_reviews') && (
                          <td className="p-2">{row.mini_reviews}</td>
                        )}
                        <td className="p-2">
                          <Badge variant={passed ? "default" : "secondary"}>{passed ? 1 : 0}</Badge>
                        </td>
                        <td className="p-2">{score}%</td>
                        <td className="p-2">
                          <Badge variant="secondary">—</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      
      <PersonSnapshotModal
        open={snapshotOpen}
        onOpenChange={setSnapshotOpen}
        memberId={selectedMemberId}
      />
    </div>
  );
}
