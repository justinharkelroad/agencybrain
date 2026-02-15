import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { AgentSummary } from './types';

interface CallGapsBarChartsProps {
  agents: AgentSummary[];
}

// Truncate long agent names for x-axis
function truncateName(name: string, maxLen = 12): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, 10) + '..';
}

const INBOUND_COLOR = '#1e3a5f';
const OUTBOUND_COLOR = '#4a9edd';

interface CustomTickProps {
  x?: number;
  y?: number;
  payload?: { value: string };
}

function CustomXTick({ x, y, payload }: CustomTickProps) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={12}
        textAnchor="middle"
        fill="currentColor"
        className="text-xs fill-muted-foreground"
      >
        {truncateName(payload?.value || '')}
      </text>
    </g>
  );
}

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border rounded-md px-3 py-2 shadow-md text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function CallGapsBarCharts({ agents }: CallGapsBarChartsProps) {
  const callData = agents.map(a => ({
    name: a.agentName,
    Inbound: a.inboundCalls,
    Outbound: a.outboundCalls,
    total: a.totalCalls,
  }));

  const timeData = agents.map(a => ({
    name: a.agentName,
    Inbound: Math.round(a.inboundTalkSeconds / 60),
    Outbound: Math.round(a.outboundTalkSeconds / 60),
    total: Math.round(a.totalTalkSeconds / 60),
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Call Count</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={callData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
              <XAxis dataKey="name" tick={<CustomXTick />} interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Inbound" stackId="a" fill={INBOUND_COLOR} radius={[0, 0, 0, 0]}>
                {callData.map((_, index) => (
                  <Cell key={`ib-${index}`} fill={INBOUND_COLOR} />
                ))}
              </Bar>
              <Bar dataKey="Outbound" stackId="a" fill={OUTBOUND_COLOR} radius={[4, 4, 0, 0]}>
                <LabelList
                  dataKey="total"
                  position="top"
                  className="fill-foreground text-xs"
                />
                {callData.map((_, index) => (
                  <Cell key={`ob-${index}`} fill={OUTBOUND_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Talk Time (Minutes)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={timeData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
              <XAxis dataKey="name" tick={<CustomXTick />} interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Inbound" stackId="a" fill={INBOUND_COLOR} radius={[0, 0, 0, 0]}>
                {timeData.map((_, index) => (
                  <Cell key={`ib-${index}`} fill={INBOUND_COLOR} />
                ))}
              </Bar>
              <Bar dataKey="Outbound" stackId="a" fill={OUTBOUND_COLOR} radius={[4, 4, 0, 0]}>
                <LabelList
                  dataKey="total"
                  position="top"
                  className="fill-foreground text-xs"
                />
                {timeData.map((_, index) => (
                  <Cell key={`ob-${index}`} fill={OUTBOUND_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
