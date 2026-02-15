import { Phone, Clock, AlertTriangle, Timer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { AgentSummary, OfficeHours } from './types';

interface CallGapsSummaryProps {
  agents: AgentSummary[];
  gapThresholdMinutes: number;
  officeHours: OfficeHours;
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs} hr ${mins} min`;
  return `${mins} min`;
}

export default function CallGapsSummary({
  agents,
  gapThresholdMinutes,
}: CallGapsSummaryProps) {
  const totalCalls = agents.reduce((sum, a) => sum + a.totalCalls, 0);
  const totalInbound = agents.reduce((sum, a) => sum + a.inboundCalls, 0);
  const totalOutbound = agents.reduce((sum, a) => sum + a.outboundCalls, 0);
  const totalTalkSeconds = agents.reduce((sum, a) => sum + a.totalTalkSeconds, 0);
  const avgTalkSeconds = agents.length > 0 ? Math.round(totalTalkSeconds / agents.length) : 0;

  const thresholdSeconds = gapThresholdMinutes * 60;
  const allGaps = agents.flatMap(a => a.gaps);
  const gapsOverThreshold = allGaps.filter(g => g.durationSeconds >= thresholdSeconds);

  let longestGap = 0;
  let longestGapAgent = '';
  for (const gap of allGaps) {
    if (gap.durationSeconds > longestGap) {
      longestGap = gap.durationSeconds;
      longestGapAgent = gap.agentName;
    }
  }

  const cards = [
    {
      icon: Phone,
      label: 'Total Calls',
      value: totalCalls.toLocaleString(),
      subtitle: `${totalInbound} inbound · ${totalOutbound} outbound`,
      color: '',
    },
    {
      icon: Clock,
      label: 'Total Talk Time',
      value: formatDuration(totalTalkSeconds),
      subtitle: `Avg ${formatDuration(avgTalkSeconds)} per agent`,
      color: '',
    },
    {
      icon: AlertTriangle,
      label: 'Gaps Over Threshold',
      value: gapsOverThreshold.length.toString(),
      subtitle: `over ${gapThresholdMinutes} min`,
      color: gapsOverThreshold.length > 0 ? 'text-amber-500' : '',
    },
    {
      icon: Timer,
      label: 'Longest Gap',
      value: longestGap > 0 ? `${Math.round(longestGap / 60)} min` : '—',
      subtitle: longestGapAgent || 'N/A',
      color: longestGap > 1800 ? 'text-red-500' : '',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <card.icon className="h-4 w-4" />
              {card.label}
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{card.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
