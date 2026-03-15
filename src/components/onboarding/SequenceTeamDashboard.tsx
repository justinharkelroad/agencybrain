import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PhoneCall,
  Voicemail,
  PhoneMissed,
  PhoneOff,
  PhoneForwarded,
  TrendingUp,
  Loader2,
  Workflow,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSequenceTeamStats } from '@/hooks/useSequenceTeamStats';
import type { TeamMemberStats, CallOutcomeBreakdown } from '@/hooks/useSequenceTeamStats';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// ─── Progress Ring Component ────────────────────────────────────

interface ProgressRingProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  centerValue?: string;
  animated?: boolean;
}

function ProgressRing({
  value,
  size = 100,
  strokeWidth = 6,
  label,
  sublabel,
  centerValue,
  animated = true,
}: ProgressRingProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const clampedValue = Math.min(100, Math.max(0, value));

  useEffect(() => {
    if (!animated) {
      setAnimatedValue(clampedValue);
      return;
    }
    const duration = 1200;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedValue(clampedValue * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [clampedValue, animated]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedValue / 100) * circumference;

  // Color gradient based on completion
  const getColor = () => {
    if (clampedValue >= 80) return { stroke: 'url(#team-ring-green)', glow: 'rgba(16,185,129,0.3)' };
    if (clampedValue >= 50) return { stroke: 'url(#team-ring-amber)', glow: 'rgba(245,158,11,0.25)' };
    if (clampedValue >= 1) return { stroke: 'url(#team-ring-red)', glow: 'rgba(239,68,68,0.25)' };
    return { stroke: 'hsl(var(--muted-foreground))', glow: 'none' };
  };

  const colors = getColor();

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
          style={{ filter: clampedValue > 0 ? `drop-shadow(0 0 12px ${colors.glow})` : undefined }}
        >
          <defs>
            <linearGradient id="team-ring-green" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
            <linearGradient id="team-ring-amber" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#84CC16" />
            </linearGradient>
            <linearGradient id="team-ring-red" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            className="stroke-foreground/8"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold text-foreground leading-none">
            {centerValue ?? `${Math.round(animatedValue)}%`}
          </span>
          {sublabel && (
            <span className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</span>
          )}
        </div>
      </div>
      {label && (
        <span className="text-xs font-medium text-muted-foreground mt-1.5">{label}</span>
      )}
    </div>
  );
}

// ─── Mini Stat Pill ─────────────────────────────────────────────

function StatPill({ icon: Icon, value, label, color }: {
  icon: React.ElementType;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', color)}>
      <Icon className="h-3 w-3" />
      <span>{value}</span>
      <span className="hidden sm:inline opacity-70">{label}</span>
    </div>
  );
}

// ─── Call Outcome Bar ───────────────────────────────────────────

const OUTCOME_CONFIG = [
  { key: 'connected' as const, label: 'Connected', icon: PhoneCall, color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400' },
  { key: 'voicemail' as const, label: 'Voicemail', icon: Voicemail, color: 'bg-blue-500', textColor: 'text-blue-600 dark:text-blue-400' },
  { key: 'no_answer' as const, label: 'No Answer', icon: PhoneMissed, color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400' },
  { key: 'callback_requested' as const, label: 'Callback', icon: PhoneForwarded, color: 'bg-purple-500', textColor: 'text-purple-600 dark:text-purple-400' },
  { key: 'wrong_number' as const, label: 'Wrong #', icon: PhoneOff, color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400' },
];

function CallOutcomeBar({ outcomes }: { outcomes: CallOutcomeBreakdown }) {
  const total = Object.values(outcomes).reduce((s, v) => s + v, 0);
  if (total === 0) return null;

  return (
    <div className="space-y-1.5">
      {/* Stacked bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-foreground/5">
        {OUTCOME_CONFIG.map(({ key, color, label }) => {
          const pct = (outcomes[key] / total) * 100;
          if (pct === 0) return null;
          return (
            <TooltipProvider key={key}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn('h-full', color)} style={{ width: `${pct}%` }} />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{label}: {outcomes[key]} ({Math.round(pct)}%)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {OUTCOME_CONFIG.map(({ key, label, icon: Icon, textColor }) => {
          if (outcomes[key] === 0) return null;
          return (
            <div key={key} className={cn('flex items-center gap-1 text-[10px]', textColor)}>
              <Icon className="h-3 w-3" />
              <span>{outcomes[key]} {label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Team Member Row ────────────────────────────────────────────

function TeamMemberRow({ member, onDrillDown }: { member: TeamMemberStats; onDrillDown?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const totalCalls = Object.values(member.call_outcomes).reduce((s, v) => s + v, 0);
  const hasOverdue = member.overdue > 0;
  const totalActionable = member.due_today + member.overdue + member.completed_today;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div
        className={cn(
          'rounded-lg border transition-all',
          hasOverdue ? 'border-red-200 dark:border-red-500/30' : 'border-border',
        )}
      >
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors rounded-lg text-left">
            {/* Ring */}
            <ProgressRing
              value={member.completion_rate}
              size={56}
              strokeWidth={4}
              centerValue={`${member.completion_rate}%`}
            />

            {/* Name + stats */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm truncate">{member.name}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {member.type === 'staff' ? 'Staff' : 'Owner'}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {member.overdue > 0 && (
                  <StatPill icon={AlertTriangle} value={member.overdue} label="overdue" color="bg-red-500/10 text-red-600 dark:text-red-400" />
                )}
                <StatPill
                  icon={Clock}
                  value={member.due_today}
                  label="due"
                  color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                />
                <StatPill
                  icon={CheckCircle2}
                  value={member.completed_today}
                  label="done"
                  color="bg-green-500/10 text-green-600 dark:text-green-400"
                />
                {totalCalls > 0 && (
                  <StatPill icon={PhoneCall} value={totalCalls} label="calls" color="bg-purple-500/10 text-purple-600 dark:text-purple-400" />
                )}
              </div>
            </div>

            {/* Completion fraction */}
            <div className="text-right shrink-0">
              <p className="text-lg font-bold">
                {member.completed_today}
                <span className="text-muted-foreground font-normal text-sm">/{totalActionable}</span>
              </p>
              <p className="text-[10px] text-muted-foreground">completed</p>
            </div>

            <div className="shrink-0 text-muted-foreground">
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-3 pt-1 border-t border-border/50 space-y-3">
            {/* Detailed stats */}
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-red-500">{member.overdue}</p>
                <p className="text-[10px] text-muted-foreground">Past Due</p>
              </div>
              <div>
                <p className="text-lg font-bold text-blue-500">{member.due_today}</p>
                <p className="text-[10px] text-muted-foreground">Due Today</p>
              </div>
              <div>
                <p className="text-lg font-bold text-green-500">{member.completed_today}</p>
                <p className="text-[10px] text-muted-foreground">Completed</p>
              </div>
              <div>
                <p className="text-lg font-bold text-muted-foreground">{member.upcoming}</p>
                <p className="text-[10px] text-muted-foreground">Upcoming</p>
              </div>
            </div>

            {/* Call outcomes */}
            {totalCalls > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Call Outcomes</p>
                <CallOutcomeBar outcomes={member.call_outcomes} />
              </div>
            )}

            {/* View tasks button */}
            {onDrillDown && (
              <button
                onClick={(e) => { e.stopPropagation(); onDrillDown(); }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                View {member.name.split(' ')[0]}'s tasks
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────

interface SequenceTeamDashboardProps {
  agencyId: string | null;
  onFilterByMember?: (memberId: string, memberType: 'staff' | 'user') => void;
  onFilterBySequence?: (sequenceName: string) => void;
}

export function SequenceTeamDashboard({ agencyId, onFilterByMember, onFilterBySequence }: SequenceTeamDashboardProps) {
  const [sortBy, setSortBy] = useState<'overdue' | 'completion' | 'name'>('overdue');
  const { data: stats, isLoading } = useSequenceTeamStats(agencyId);

  const sortedMembers = useMemo(() => {
    if (!stats?.team_members) return [];
    const members = [...stats.team_members];

    switch (sortBy) {
      case 'overdue':
        return members.sort((a, b) => b.overdue - a.overdue || a.completion_rate - b.completion_rate);
      case 'completion':
        return members.sort((a, b) => a.completion_rate - b.completion_rate);
      case 'name':
        return members.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return members;
    }
  }, [stats?.team_members, sortBy]);

  // Aggregate call outcomes across team
  const teamCallOutcomes = useMemo((): CallOutcomeBreakdown => {
    if (!stats?.team_members) return { connected: 0, voicemail: 0, no_answer: 0, wrong_number: 0, callback_requested: 0 };
    return stats.team_members.reduce((acc, m) => ({
      connected: acc.connected + m.call_outcomes.connected,
      voicemail: acc.voicemail + m.call_outcomes.voicemail,
      no_answer: acc.no_answer + m.call_outcomes.no_answer,
      wrong_number: acc.wrong_number + m.call_outcomes.wrong_number,
      callback_requested: acc.callback_requested + m.call_outcomes.callback_requested,
    }), { connected: 0, voicemail: 0, no_answer: 0, wrong_number: 0, callback_requested: 0 });
  }, [stats?.team_members]);

  const totalCalls = Object.values(teamCallOutcomes).reduce((s, v) => s + v, 0);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.team_members.length === 0) {
    return null; // Don't show dashboard if no team members have tasks
  }

  const { totals, by_sequence } = stats;
  // Total actionable = remaining due + remaining overdue + already completed today
  const totalActionable = totals.due_today + totals.overdue + totals.completed_today;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Team Accountability
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sort:</span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="h-7 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overdue">Most Overdue</SelectItem>
                <SelectItem value="completion">Lowest Rate</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Team Overview Rings ── */}
        <div className="flex items-center justify-center gap-6 flex-wrap py-2">
          <ProgressRing
            value={totals.completion_rate}
            size={110}
            strokeWidth={7}
            label="Completion"
            sublabel={`${totals.completed_today}/${totalActionable}`}
          />
          {totals.overdue > 0 && (
            <div className="flex flex-col items-center">
              <div className="relative" style={{ width: 80, height: 80 }}>
                <svg
                  width={80}
                  height={80}
                  className="transform -rotate-90"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(239,68,68,0.3))' }}
                >
                  <circle
                    cx={40} cy={40} r={35}
                    fill="none"
                    className="stroke-foreground/8"
                    strokeWidth={5}
                  />
                  <circle
                    cx={40} cy={40} r={35}
                    fill="none" stroke="#EF4444" strokeWidth={5}
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 35}
                    strokeDashoffset={0}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-red-500">{totals.overdue}</span>
                  <span className="text-[10px] text-muted-foreground">tasks</span>
                </div>
              </div>
              <span className="text-xs font-medium text-red-500 mt-1.5">Past Due</span>
            </div>
          )}
          {totalCalls > 0 && (
            <div className="flex flex-col items-center">
              <ProgressRing
                value={teamCallOutcomes.connected > 0 ? (teamCallOutcomes.connected / totalCalls) * 100 : 0}
                size={80}
                strokeWidth={5}
                centerValue={String(teamCallOutcomes.connected)}
                sublabel={`/${totalCalls}`}
                label="Calls Connected"
              />
            </div>
          )}
        </div>

        {/* ── Team Call Outcomes ── */}
        {totalCalls > 0 && (
          <div className="px-1">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <PhoneCall className="h-3.5 w-3.5" />
              Team Call Outcomes
            </p>
            <CallOutcomeBar outcomes={teamCallOutcomes} />
          </div>
        )}

        {/* ── By Sequence Type ── */}
        {by_sequence.length > 0 && (
          <div className="px-1">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Workflow className="h-3.5 w-3.5" />
              By Sequence
            </p>
            <div className="grid gap-1.5">
              {by_sequence.map((seq) => {
                const seqTotal = seq.due_today + seq.overdue + seq.completed_today;
                const seqRate = seqTotal > 0 ? Math.round((seq.completed_today / seqTotal) * 100) : 0;
                return (
                  <div
                    key={`${seq.type}-${seq.name}`}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30',
                      onFilterBySequence && 'cursor-pointer hover:bg-muted/60 transition-colors'
                    )}
                    onClick={() => onFilterBySequence?.(seq.name)}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">{seq.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs shrink-0">
                      {seq.overdue > 0 && (
                        <span className="text-red-500 font-medium">{seq.overdue} overdue</span>
                      )}
                      <span className="text-muted-foreground">
                        {seq.completed_today}/{seqTotal} done
                      </span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[10px] px-1.5',
                          seqRate >= 80 ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                          seqRate >= 50 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                          'bg-red-500/10 text-red-600 dark:text-red-400'
                        )}
                      >
                        {seqRate}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Per-Member Breakdown ── */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5 px-1">
            <TrendingUp className="h-3.5 w-3.5" />
            Team Members ({sortedMembers.length})
          </p>
          <div className="space-y-2">
            {sortedMembers.map((member) => (
              <TeamMemberRow
                key={member.id}
                member={member}
                onDrillDown={onFilterByMember ? () => onFilterByMember(member.id, member.type) : undefined}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
