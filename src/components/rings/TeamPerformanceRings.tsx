import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RING_COLORS, RING_LABELS, getRingColor } from "./colors";
import { Check, X } from "lucide-react";
import PersonSnapshotModal from "@/components/PersonSnapshotModal";
import { useKpiLabels } from "@/hooks/useKpiLabels";
import { getMetricValue, normalizeMetricKey } from "@/lib/kpiKeyMapping";
import { getTeamRingsData } from "@/lib/scorecardsApi";
import { fetchWithAuth, hasStaffToken } from "@/lib/staffRequest";
import { supabase } from '@/integrations/supabase/client';

type RingMetric = {
  key: string;
  label: string;
  progress: number;
  color: string;
  actual: number;
  target: number;
};

type TeamMemberRings = {
  id: string;
  name: string;
  metrics: RingMetric[];
  passes: boolean;
  hitsCount: number;
  requiredHits: number;
};

function usePrefersReducedMotion() {
  const m = typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
  const [reduced, setReduced] = useState(!!m?.matches);
  
  useEffect(() => {
    if (!m) return;
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    m.addEventListener?.("change", listener);
    return () => m.removeEventListener?.("change", listener);
  }, [m]);
  
  return reduced;
}

function CompactRing({ 
  progress, 
  color, 
  actual,
  size = 80, 
  duration = 900
}: { 
  progress: number; 
  color: string; 
  actual: number;
  size?: number; 
  duration?: number; 
}) {
  const r = size / 2 - 8;
  const circumference = 2 * Math.PI * r;
  const target = Math.max(0, Math.min(progress, 1)) * circumference;
  const [dashArray, setDashArray] = useState(0);
  const reduced = usePrefersReducedMotion();
  const circleRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (reduced) {
      setDashArray(target);
      return;
    }

    // Prevent unnecessary animations by checking if target actually changed
    const currentDashArray = dashArray;
    if (Math.abs(currentDashArray - target) < 0.01) return;

    // Start from current position and animate to target
    const id = requestAnimationFrame(() => {
      if (circleRef.current) {
        circleRef.current.style.transition = `stroke-dasharray ${duration}ms ease-out`;
      }
      setDashArray(target);
    });

    return () => cancelAnimationFrame(id);
  }, [target, reduced, duration]);

  return (
    <div className="relative">
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="hsl(var(--border))"
          strokeOpacity="0.2"
          strokeWidth="8"
          fill="none"
        />
        <circle
          ref={circleRef}
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${dashArray} ${circumference}`}
          strokeLinecap="round"
          fill="none"
          className={progress >= 1 ? "drop-shadow-sm" : ""}
        />
      </svg>
      <div 
        className="absolute inset-0 flex items-center justify-center z-10"
        style={{ fontSize: `${size * 0.2}px`, lineHeight: 1 }}
      >
        <span 
          className="font-bold tabular-nums text-foreground drop-shadow-sm bg-background/80 rounded px-1"
          style={{ color: 'hsl(var(--foreground))' }}
        >
          {actual}
        </span>
      </div>
    </div>
  );
}

interface TeamPerformanceRingsProps {
  agencyId: string;
  agencySlug?: string;
  role: string;
  date: string;
}

export default function TeamPerformanceRings({ 
  agencyId, 
  agencySlug,
  role, 
  date 
}: TeamPerformanceRingsProps) {
  const [loading, setLoading] = useState(true);
  const [teamData, setTeamData] = useState<TeamMemberRings[]>([]);
  const [ringMetrics, setRingMetrics] = useState<string[]>([]);
  const [nRequired, setNRequired] = useState(2);
  
  // Fetch current KPI labels from database (not hardcoded)
  // Pass role to get role-specific labels (e.g., Service's "Life Referrals" vs Sales's "Outbound Calls")
  const { data: kpiLabels } = useKpiLabels(agencyId, role);
  
  // Modal state for PersonSnapshotModal
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const handleMemberClick = (memberId: string) => {
    setSelectedMemberId(memberId);
    setSnapshotOpen(true);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Use the staff-safe API
        const isStaff = hasStaffToken();
        let rules: any = null;
        let teamMetrics: any[] = [];
        let targets: any[] = [];
        let slug = agencySlug;

        if (isStaff) {
          // Staff mode - use edge function
          const data = await getTeamRingsData(role, date, agencyId, agencySlug);
          rules = data.rules;
          teamMetrics = data.teamMetrics || [];
          targets = data.targets || [];
        } else {
          // Owner mode - direct queries
          const { data: rulesData } = await supabase
            .from('scorecard_rules')
            .select('ring_metrics, n_required')
            .eq('agency_id', agencyId)
            .eq('role', role as 'Sales' | 'Service')
            .single();
          rules = rulesData;

          // Get agency slug if not provided
          if (!slug) {
            const { data: agencyData } = await supabase
              .from('agencies')
              .select('slug')
              .eq('id', agencyId)
              .single();
            slug = agencyData?.slug;
          }

          if (slug) {
            const response = await fetchWithAuth("get_dashboard_daily", {
              method: "GET",
              prefer: "supabase",
              queryParams: {
                agencySlug: slug,
                role,
                workDate: date,
              },
            });

            let payload: any = null;
            try {
              payload = await response.json();
            } catch {
              payload = null;
            }

            if (!response.ok) {
              throw new Error(payload?.error || `Failed to fetch dashboard daily (${response.status})`);
            }

            teamMetrics = payload?.rows || [];
          }

          const { data: targetsData } = await supabase
            .from('targets')
            .select('team_member_id, metric_key, value_number')
            .eq('agency_id', agencyId);
          targets = targetsData || [];
        }

        // FIXED: Use standardized keys in fallback
        const rawMetrics = rules?.ring_metrics || (role === 'Sales' 
          ? ['outbound_calls', 'talk_minutes', 'quoted_households', 'items_sold']
          : ['outbound_calls', 'talk_minutes', 'cross_sells_uncovered', 'mini_reviews']);
        
        // Normalize all metric keys to standard format AND dedupe
        // This ensures legacy keys like 'policies_quoted' become 'quoted_households'
        const seen = new Set<string>();
        const normalizedMetrics = rawMetrics
          .map((m: string) => normalizeMetricKey(m))
          .filter((m: string) => {
            if (seen.has(m)) return false;
            seen.add(m);
            return true;
          });
        
        setRingMetrics(normalizedMetrics);
        setNRequired(rules?.n_required || 2);

        // Role-based default targets and metrics (use STANDARD UI keys)
        const getDefaultTarget = (metricKey: string) => {
          const defaults = role === 'Sales'
            ? {
                outbound_calls: 100,
                talk_minutes: 180,
                quoted_households: 5,
                items_sold: 2,
                sold_policies: 1,
                sold_premium_cents: 50000,
              }
            : { outbound_calls: 30, talk_minutes: 180, cross_sells_uncovered: 2, mini_reviews: 5 };

          return (defaults as any)[metricKey] || 0;
        };

        // Build team data with rings and pass/fail calculation
        const team: TeamMemberRings[] = (teamMetrics || []).map((member: any) => {
          const memberMetrics: RingMetric[] = normalizedMetrics.map((metricKey: string) => {
            // Use getMetricValue for graceful fallback between UI keys and column names
            const actual = getMetricValue(member, metricKey);
            
            // Get target: member-specific first, then agency default, then role default
            // NOTE: targets.metric_key may be legacy keys, so normalize before comparing.
            const memberTarget = targets?.find((t: any) =>
              t.team_member_id === member.team_member_id &&
              normalizeMetricKey(t.metric_key) === metricKey
            )?.value_number;

            const agencyTarget = targets?.find((t: any) =>
              t.team_member_id === null &&
              normalizeMetricKey(t.metric_key) === metricKey
            )?.value_number;

            const target = (memberTarget ?? agencyTarget ?? getDefaultTarget(metricKey)) ?? 0;
            
            return {
              key: metricKey,
              // Use database labels first, fallback to RING_LABELS, then slug
              label: kpiLabels?.[metricKey] || RING_LABELS[metricKey] || metricKey,
              progress: target > 0 ? Math.min(actual / target, 1) : 0,
              color: getRingColor(metricKey),
              actual,
              target: target > 0 ? target : 0
            };
          });

          // Calculate how many metrics meet their targets
          const hitsCount = memberMetrics.filter(metric => 
            metric.target > 0 && metric.actual >= metric.target
          ).length;

          // Determine if member passes based on n_required
          const passes = hitsCount >= nRequired;

          return {
            id: member.team_member_id,
            name: member.team_member_name,
            metrics: memberMetrics,
            passes,
            hitsCount,
            requiredHits: nRequired
          };
        });

        setTeamData(team);
      } catch (error) {
        console.error('Error fetching team performance rings:', error);
      } finally {
        setLoading(false);
      }
    };

    if (agencyId && role && date) {
      fetchData();
    }
  }, [agencyId, agencySlug, role, date, kpiLabels]);

  if (loading) {
    return (
      <Card className="glass-surface">
        <CardHeader>
          <CardTitle className="text-lg">Team Member Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <LoadingSpinner />
            <span className="text-sm text-muted-foreground">Loading performance rings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (teamData.length === 0) {
    return (
      <Card className="glass-surface">
        <CardHeader>
          <CardTitle className="text-lg">Team Member Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No team data available for {date}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-surface">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          Team Member Performance
          <span className="text-sm font-normal text-muted-foreground">{date}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 md:flex-row md:gap-6 md:overflow-x-auto pb-2">
          {teamData.map((member) => (
            <Card 
              key={member.id} 
              className="flex-shrink-0 min-w-[200px] cursor-pointer hover:bg-accent/50 transition-colors" 
              onClick={() => handleMemberClick(member.id)}
            >
              <CardContent className="p-4">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground text-center">
                    {member.passes ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-red-600" />
                    )}
                    <span>{member.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({member.hitsCount}/{member.requiredHits})
                    </span>
                  </div>
                  <div className="flex gap-4">
                    {member.metrics.map((metric) => (
                      <div key={metric.key} className="flex flex-col items-center gap-1">
                        <CompactRing
                          progress={metric.progress}
                          color={metric.color}
                          actual={metric.actual}
                        />
                        <div className="text-xs text-muted-foreground text-center">
                          {metric.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
      
      <PersonSnapshotModal 
        open={snapshotOpen} 
        onOpenChange={setSnapshotOpen} 
        memberId={selectedMemberId} 
      />
    </Card>
  );
}
