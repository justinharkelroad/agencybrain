import { useEffect, useRef, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, Clock, Home, ShoppingCart, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { useDashboardDaily } from "@/hooks/useDashboardDaily";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { RING_COLORS } from "@/components/rings/colors";
import { format, subDays, addDays, isToday, startOfDay } from "date-fns";

// --- Reduced-motion hook (matches MemberRingsCard) ---
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

// --- Ring SVG with optional target (no target = raw stat mode) ---
function MetricRing({
  progress,
  color,
  size = 150,
  icon: Icon,
  value,
  target,
  label,
  dateLabel,
  formatValue,
}: {
  progress: number | null; // null = no progress ring (agency aggregate mode)
  color: string;
  size?: number;
  icon: LucideIcon;
  value: number;
  target: number | null;
  label: string;
  dateLabel: string;
  formatValue?: (v: number) => string;
}) {
  const strokeWidth = 12;
  const r = size / 2 - strokeWidth;
  const circumference = 2 * Math.PI * r;
  const cappedProgress = progress != null ? Math.max(0, Math.min(progress, 1)) : 0;
  const targetDash = cappedProgress * circumference;
  const [dashArray, setDashArray] = useState(0);
  const reduced = usePrefersReducedMotion();
  const circleRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (reduced) {
      setDashArray(targetDash);
      return;
    }
    if (Math.abs(dashArray - targetDash) < 0.01) return;
    const id = requestAnimationFrame(() => {
      if (circleRef.current) {
        circleRef.current.style.transition = `stroke-dasharray 900ms ease-out`;
      }
      setDashArray(targetDash);
    });
    return () => cancelAnimationFrame(id);
  }, [targetDash, reduced]);

  const displayValue = formatValue ? formatValue(value) : String(value);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <svg width={size} height={size} className="rotate-[-90deg]">
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="hsl(var(--border))"
            strokeOpacity="0.25"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress ring — only rendered when we have a target */}
          {progress != null && (
            <circle
              ref={circleRef}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashArray} ${circumference}`}
              strokeLinecap="round"
              fill="none"
              className={progress >= 1 ? "drop-shadow-md" : ""}
            />
          )}
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className="h-4 w-4 mb-0.5" style={{ color }} />
          <span
            className="text-2xl font-bold tabular-nums leading-none"
            style={{ color }}
          >
            {displayValue}
          </span>
          {target != null && (
            <span className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">
              of {formatValue ? formatValue(target) : String(target)}
            </span>
          )}
        </div>
      </div>
      <div className="text-xs font-medium text-muted-foreground text-center">
        {label}
      </div>
      <div className="text-[10px] text-muted-foreground/60 uppercase tracking-widest">
        {dateLabel}
      </div>
    </div>
  );
}

// --- Metric config ---
interface MetricConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  tileTitle: string;
  rowKey: "outbound_calls" | "talk_minutes" | "quoted_count" | "sold_items";
  targetMetricKey: string; // key in `targets` table
  color: string;
  defaultTarget: number;
  formatValue?: (v: number) => string;
}

function formatTalkTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const METRICS: MetricConfig[] = [
  {
    key: "outbound_calls",
    label: "Outbound Calls",
    icon: Phone,
    tileTitle: "Outbound Calls",
    rowKey: "outbound_calls",
    targetMetricKey: "outbound_calls",
    color: RING_COLORS.outbound_calls,
    defaultTarget: 100,
  },
  {
    key: "talk_minutes",
    label: "Total Talk Time",
    icon: Clock,
    tileTitle: "Talk Minutes",
    rowKey: "talk_minutes",
    targetMetricKey: "talk_minutes",
    color: RING_COLORS.talk_minutes,
    defaultTarget: 180,
    formatValue: formatTalkTime,
  },
  {
    key: "quoted_households",
    label: "Quoted Households",
    icon: Home,
    tileTitle: "Quoted",
    rowKey: "quoted_count",
    targetMetricKey: "quoted_households",
    color: RING_COLORS.quoted_households,
    defaultTarget: 15,
  },
  {
    key: "items_sold",
    label: "Items Sold",
    icon: ShoppingCart,
    tileTitle: "Sold Items",
    rowKey: "sold_items",
    targetMetricKey: "items_sold",
    color: RING_COLORS.items_sold,
    defaultTarget: 8,
  },
];

const AGENCY_VALUE = "__agency__";

// --- Main component ---
interface AgencyMetricRingsProps {
  agencySlug: string;
  agencyId: string;
  canFilterByMember?: boolean;
}

export function AgencyMetricRings({
  agencySlug,
  agencyId,
  canFilterByMember = false,
}: AgencyMetricRingsProps) {
  const [selectedMember, setSelectedMember] = useState<string>(AGENCY_VALUE);
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));

  const { data: dashboardData } = useDashboardDaily(agencySlug, "Sales", selectedDate);

  const isTodaySelected = isToday(selectedDate);
  const isFutureBlocked = isTodaySelected; // can't go forward past today

  const goBack = () => setSelectedDate((d) => subDays(d, 1));
  const goForward = () => {
    if (!isFutureBlocked) setSelectedDate((d) => addDays(d, 1));
  };
  const goToday = () => setSelectedDate(startOfDay(new Date()));

  const dateLabel = isTodaySelected ? "Today" : format(selectedDate, "EEE, MMM d");

  // Build sorted member list from dashboard rows
  const members = useMemo(() => {
    if (!dashboardData?.rows) return [];
    const seen = new Map<string, string>();
    for (const row of dashboardData.rows) {
      if (row.team_member_id && !seen.has(row.team_member_id)) {
        seen.set(row.team_member_id, row.rep_name || "Unnamed");
      }
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dashboardData?.rows]);

  // Reset selection if the selected member disappears from data
  const validSelection =
    selectedMember === AGENCY_VALUE || members.some((m) => m.id === selectedMember);
  const activeMember = validSelection ? selectedMember : AGENCY_VALUE;

  const isAgencyView = activeMember === AGENCY_VALUE;

  // Fetch per-member targets from `targets` table (includes agency defaults where team_member_id IS NULL)
  const { data: memberTargets } = useQuery({
    queryKey: ["member-ring-targets", agencyId, activeMember],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("targets")
        .select("metric_key, value_number, team_member_id")
        .eq("agency_id", agencyId)
        .in("metric_key", METRICS.map((m) => m.targetMetricKey))
        .or(`team_member_id.is.null,team_member_id.eq.${activeMember}`);
      if (error) throw error;
      return data;
    },
    enabled: !!agencyId && !isAgencyView,
    staleTime: 5 * 60 * 1000,
  });

  // Resolve targets: per-member override > agency default from targets table > hardcoded default
  const resolvedTargets = useMemo(() => {
    const map = new Map<string, number>();
    if (!memberTargets) return map;
    // First pass: set agency defaults (team_member_id IS NULL)
    for (const t of memberTargets) {
      if (t.team_member_id === null && t.value_number != null && Number(t.value_number) > 0) {
        map.set(t.metric_key, Number(t.value_number));
      }
    }
    // Second pass: override with per-member targets
    for (const t of memberTargets) {
      if (t.team_member_id !== null && t.value_number != null && Number(t.value_number) > 0) {
        map.set(t.metric_key, Number(t.value_number));
      }
    }
    return map;
  }, [memberTargets]);

  // Get the selected member's row
  const memberRow = !isAgencyView
    ? dashboardData?.rows?.find((r) => r.team_member_id === activeMember)
    : null;

  // Aggregate tile map for agency view
  const tileMap = useMemo(() => {
    const map = new Map<string, number>();
    if (dashboardData?.tiles) {
      for (const tile of dashboardData.tiles) {
        map.set(tile.title, tile.value);
      }
    }
    return map;
  }, [dashboardData?.tiles]);

  return (
    <Card>
      <CardContent className="py-6 px-4">
        {/* Controls row: date nav + member selector */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
          {/* Date navigation */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={goToday}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors min-w-[120px] text-center"
            >
              {isTodaySelected ? "Today" : format(selectedDate, "EEE, MMM d")}
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goForward}
              disabled={isFutureBlocked}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Member selector */}
          {canFilterByMember && (
            <Select value={activeMember} onValueChange={setSelectedMember}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Viewing..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AGENCY_VALUE}>Entire Agency</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 place-items-center">
          {METRICS.map((metric) => {
            let value: number;
            let target: number | null;
            let progress: number | null;

            if (isAgencyView) {
              // Agency aggregate — raw numbers, no targets
              value = tileMap.get(metric.tileTitle) ?? 0;
              target = null;
              progress = null;
            } else {
              // Individual member — show progress toward per-member targets
              value = memberRow ? (memberRow[metric.rowKey] || 0) : 0;
              target = resolvedTargets.get(metric.targetMetricKey) ?? metric.defaultTarget;
              progress = target > 0 ? value / target : 0;
            }

            return (
              <MetricRing
                key={metric.key}
                progress={progress}
                color={metric.color}
                icon={metric.icon}
                value={value}
                target={target}
                label={metric.label}
                dateLabel={dateLabel}
                formatValue={metric.formatValue}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
