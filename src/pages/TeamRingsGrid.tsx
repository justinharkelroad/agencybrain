import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MemberRingsCard from "@/components/rings/MemberRingsCard";
import RingLegend from "@/components/rings/RingLegend";
import { RING_COLORS, RING_LABELS } from "@/components/rings/colors";
import { toast } from "sonner";
import PersonSnapshotModal from "@/components/PersonSnapshotModal";
import { useKpiLabels } from "@/hooks/useKpiLabels";
import { ArrowLeft } from "lucide-react";
type TeamMetricRow = {
  team_member_id: string;
  name: string;
  role: string;
  date: string;
  outbound_calls: number;
  talk_minutes: number;
  quoted_count: number;
  quoted_entity: string | null;
  sold_items: number;
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

export default function TeamRingsGrid() {
  const { user } = useAuth();
  const [agencyId, setAgencyId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TeamMetricRow[]>([]);
  const [ringMetrics, setRingMetrics] = useState<string[]>(["outbound_calls", "talk_minutes", "quoted_count", "sold_items"]);
  const [targets, setTargets] = useState<Record<string, Record<string, number>>>({});
  const [selectedRole, setSelectedRole] = useState<"Sales" | "Service">("Sales");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date(Date.now() - 86400000).toISOString().slice(0, 10) // yesterday
  );
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Fetch current KPI labels from database (not hardcoded)
  const { data: kpiLabels } = useKpiLabels(agencyId);

  // Load agency and ring metrics
  useEffect(() => {
    if (user?.id) {
      loadAgencyAndRingMetrics();
    }
  }, [user?.id, selectedRole]);

  // Load team data when date/role changes
  useEffect(() => {
    if (agencyId) {
      loadTeamData();
    }
  }, [agencyId, selectedRole, selectedDate]);

  // Load targets when team data changes
  useEffect(() => {
    if (agencyId && rows.length > 0) {
      loadTargets();
    }
  }, [agencyId, rows]);

  const loadAgencyAndRingMetrics = async () => {
    try {
      // Get user's agency
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user?.id)
        .single();

      if (!profile?.agency_id) {
        toast.error('No agency found for user');
        return;
      }

      setAgencyId(profile.agency_id);

      // Load ring metrics from scorecard rules
      const { data: rules } = await supabase
        .from("scorecard_rules")
        .select("ring_metrics, selected_metrics")
        .eq("agency_id", profile.agency_id)
        .eq("role", selectedRole)
        .maybeSingle();

      if (rules) {
        const metrics = rules.ring_metrics || rules.selected_metrics || ringMetrics;
        setRingMetrics(metrics);
      }
    } catch (error: any) {
      console.error('Error loading agency and ring metrics:', error);
      toast.error('Failed to load ring configuration');
    }
  };

  const loadTeamData = async () => {
    if (!agencyId) return;

    try {
      const { data, error } = await supabase.rpc('get_team_metrics_for_day', {
        p_agency: agencyId,
        p_role: selectedRole,
        p_date: selectedDate
      });

      if (error) throw error;
      setRows(data || []);
    } catch (error: any) {
      console.error('Error loading team data:', error);
      toast.error('Failed to load team metrics');
    } finally {
      setLoading(false);
    }
  };

  const loadTargets = async () => {
    if (!agencyId) return;

    try {
      const { data: targetRows, error } = await supabase
        .from("targets")
        .select("team_member_id, metric_key, value_number")
        .eq("agency_id", agencyId);

      if (error) throw error;

      // Build resolved targets map (global + per-member overrides)
      const targetsMap: Record<string, Record<string, number>> = {};
      const globalTargets: Record<string, number> = {};

      // First, collect global targets (where team_member_id is null)
      targetRows
        ?.filter((t) => !t.team_member_id)
        .forEach((t) => {
          globalTargets[t.metric_key] = Number(t.value_number || 0);
        });

      // Then, for each team member, start with global targets and apply member-specific overrides
      const memberIds = new Set(rows.map((r) => r.team_member_id));
      memberIds.forEach((memberId) => {
        targetsMap[memberId] = { ...globalTargets };
        
        targetRows
          ?.filter((t) => t.team_member_id === memberId)
          .forEach((t) => {
            targetsMap[memberId][t.metric_key] = Number(t.value_number || 0);
          });
      });

      setTargets(targetsMap);
    } catch (error: any) {
      console.error('Error loading targets:', error);
      toast.error('Failed to load performance targets');
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
            case "outbound_calls": return row.outbound_calls;
            case "talk_minutes": return row.talk_minutes;
            case "quoted_count": return row.quoted_count;
            case "sold_items": return row.sold_items;
            case "sold_policies": return row.sold_policies;
            case "sold_premium": return Math.round((row.sold_premium_cents || 0) / 100);
            case "cross_sells_uncovered": return row.cross_sells_uncovered;
            case "mini_reviews": return row.mini_reviews;
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
          // Use database labels first, fallback to RING_LABELS, then slug
          label: kpiLabels?.[key] || RING_LABELS[key] || key,
          progress,
          color: RING_COLORS[key] || "#9ca3af",
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
  }, [rows, targets, ringMetrics, kpiLabels]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">Loading team rings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Link to="/metrics" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Metrics
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Team Performance Rings</CardTitle>
            <div className="flex flex-wrap items-center gap-4">
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
      </div>
      
      <PersonSnapshotModal
        open={snapshotOpen}
        onOpenChange={setSnapshotOpen}
        memberId={selectedMemberId}
      />
    </div>
  );
}