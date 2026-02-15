import { useState } from 'react';
import { ChevronDown, ChevronRight, PhoneIncoming, PhoneOutgoing, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AgentSummary, CallGap } from './types';

interface CallGapsTableProps {
  agents: AgentSummary[];
  gapThresholdMinutes: number;
}

function formatTime12(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatGapDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hrs} hr ${rem} min`;
  }
  return `${mins} min`;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + '...';
}

export default function CallGapsTable({ agents, gapThresholdMinutes }: CallGapsTableProps) {
  const [isOpen, setIsOpen] = useState(true);

  const thresholdSeconds = gapThresholdMinutes * 60;

  // Collect all gaps over threshold with agent info
  const significantGaps: (CallGap & { _agent: string })[] = [];
  for (const agent of agents) {
    for (const gap of agent.gaps) {
      if (gap.durationSeconds >= thresholdSeconds) {
        significantGaps.push({ ...gap, _agent: agent.agentName });
      }
    }
  }

  // Sort by duration descending
  significantGaps.sort((a, b) => b.durationSeconds - a.durationSeconds);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="px-1" onClick={() => setIsOpen(!isOpen)}>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <CardTitle className="text-base">
              Gaps Over {gapThresholdMinutes} Minutes
            </CardTitle>
            <Badge variant={significantGaps.length > 0 ? 'destructive' : 'secondary'}>
              {significantGaps.length}
            </Badge>
          </div>
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent>
          {significantGaps.length === 0 ? (
            <div className="flex items-center gap-2 text-green-600 py-4 justify-center">
              <CheckCircle2 className="h-5 w-5" />
              <span>No significant gaps found</span>
            </div>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Gap Start</TableHead>
                    <TableHead>Gap End</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Before</TableHead>
                    <TableHead>After</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {significantGaps.map((gap, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{gap._agent}</TableCell>
                      <TableCell>{formatTime12(gap.gapStart)}</TableCell>
                      <TableCell>{formatTime12(gap.gapEnd)}</TableCell>
                      <TableCell className="font-medium">{formatGapDuration(gap.durationSeconds)}</TableCell>
                      <TableCell>
                        {gap.callBefore ? (
                          <div className="flex items-center gap-1 text-sm">
                            {gap.callBefore.direction === 'inbound' ? (
                              <PhoneIncoming className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <PhoneOutgoing className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            <span className="truncate max-w-[120px]">
                              {truncate(gap.callBefore.contactName || gap.callBefore.contactPhone || 'Unknown', 18)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {gap.callAfter ? (
                          <div className="flex items-center gap-1 text-sm">
                            {gap.callAfter.direction === 'inbound' ? (
                              <PhoneIncoming className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <PhoneOutgoing className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            <span className="truncate max-w-[120px]">
                              {truncate(gap.callAfter.contactName || gap.callAfter.contactPhone || 'Unknown', 18)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
