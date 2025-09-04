import { useEffect, useState } from "react";
import { supa } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RING_COLORS, RING_LABELS } from "./colors";
import { useRef } from "react";
import { Check, X } from "lucide-react";

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

    setDashArray(0);
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
        className="absolute inset-0 flex items-center justify-center"
        style={{ fontSize: `${size * 0.18}px`, lineHeight: 1 }}
      >
        <span 
          className="font-semibold tabular-nums"
          style={{ color }}
        >
          {actual}
        </span>
      </div>
    </div>
  );
}

export default function TeamPerformanceRings({ 
  agencyId, 
  role, 
  date 
}: { 
  agencyId: string; 
  role: string; 
  date: string; 
}) {
  const [loading, setLoading] = useState(true);
  const [teamData, setTeamData] = useState<TeamMemberRings[]>([]);
  const [ringMetrics, setRingMetrics] = useState<string[]>([]);
  const [nRequired, setNRequired] = useState(2);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Get ring metrics and n_required from scorecard rules
        const { data: rules } = await supa
          .from('scorecard_rules')
          .select('ring_metrics, n_required')
          .eq('agency_id', agencyId)
          .eq('role', role)
          .single();

        const metrics = rules?.ring_metrics || (role === 'Sales' 
          ? ['outbound_calls', 'talk_minutes', 'quoted_count', 'sold_items']
          : ['outbound_calls', 'talk_minutes', 'cross_sells_uncovered', 'mini_reviews']);
        setRingMetrics(metrics);
        setNRequired(rules?.n_required || 2);

        // Get team metrics for the date
        const { data: teamMetrics } = await supa
          .rpc('get_team_metrics_for_day', {
            p_agency: agencyId,
            p_role: role,
            p_date: date
          });

        // Get targets for each member and metric
        const { data: targets } = await supa
          .from('targets')
          .select('team_member_id, metric_key, value_number')
          .eq('agency_id', agencyId);

        // Role-based default targets and metrics
        const getDefaultTarget = (metricKey: string) => {
          const defaults = role === 'Sales' 
            ? { outbound_calls: 100, talk_minutes: 180, quoted_count: 5, sold_items: 2, sold_policies: 1, sold_premium: 500 }
            : { outbound_calls: 30, talk_minutes: 180, cross_sells_uncovered: 2, mini_reviews: 5 };
          return (defaults as any)[metricKey] || 0;
        };

        // Filter metrics based on role - reordered to show Quoted first, then Sold
        const roleMetrics = role === 'Sales' 
          ? ['quoted_count', 'sold_items', 'outbound_calls', 'talk_minutes']
          : ['cross_sells_uncovered', 'mini_reviews', 'outbound_calls', 'talk_minutes'];
        
        const filteredMetrics = metrics.filter(m => roleMetrics.includes(m));

        // Build team data with rings and pass/fail calculation
        const team: TeamMemberRings[] = (teamMetrics || []).map((member: any) => {
          const memberMetrics: RingMetric[] = filteredMetrics.map((metricKey: string) => {
            const actual = member[metricKey] || 0;
            
            // Get target: member-specific first, then agency default, then role default
            const memberTarget = targets?.find(t => 
              t.team_member_id === member.team_member_id && t.metric_key === metricKey
            )?.value_number;
            
            const agencyTarget = targets?.find(t => 
              t.team_member_id === null && t.metric_key === metricKey
            )?.value_number;
            
            const target = memberTarget || agencyTarget || getDefaultTarget(metricKey);
            
            return {
              key: metricKey,
              label: RING_LABELS[metricKey] || metricKey,
              progress: target > 0 ? Math.min(actual / target, 1) : 0,
              color: RING_COLORS[metricKey] || "#9ca3af",
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
            name: member.name,
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
  }, [agencyId, role, date]);

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
            <Card key={member.id} className="flex-shrink-0 min-w-[200px]">
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
    </Card>
  );
}