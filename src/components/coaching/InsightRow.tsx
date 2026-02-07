import { useState } from 'react';
import { AlertTriangle, AlertCircle, ChevronDown, ChevronRight, Lightbulb } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { CoachingInsight } from '@/types/coaching';

interface InsightRowProps {
  insight: CoachingInsight;
}

function formatValue(value: number, type: CoachingInsight['type'], metricKey: string): string {
  if (type === 'objection_pattern') return `${value} occurrences`;
  if (metricKey === 'quote_rate' || metricKey === 'close_rate' || metricKey === 'pass_rate') {
    return `${value.toFixed(1)}%`;
  }
  if (metricKey === 'talk_minutes') return `${value.toFixed(1)} min/day`;
  return value.toFixed(1);
}

function getDescription(insight: CoachingInsight): string {
  switch (insight.type) {
    case 'low_quote_rate':
      return `Quote rate: ${formatValue(insight.currentValue, insight.type, insight.metricKey)} vs ${formatValue(insight.benchmark, insight.type, insight.metricKey)} ${insight.benchmarkSource === 'target' ? 'target' : 'team avg'}`;
    case 'low_close_rate':
      return `Close rate: ${formatValue(insight.currentValue, insight.type, insight.metricKey)} vs ${formatValue(insight.benchmark, insight.type, insight.metricKey)} ${insight.benchmarkSource === 'target' ? 'target' : 'team avg'}`;
    case 'objection_pattern':
      return `"${insight.objectionName}" — ${insight.objectionCount} times in 30 days`;
    case 'low_call_volume':
      return `${insight.currentValue.toFixed(1)} calls/day vs ${insight.benchmark.toFixed(1)} ${insight.benchmarkSource === 'target' ? 'target' : 'team avg'}`;
    case 'low_talk_time':
      return `${insight.currentValue.toFixed(1)} min/day vs ${insight.benchmark.toFixed(1)} ${insight.benchmarkSource === 'target' ? 'target' : 'team avg'}`;
    case 'declining_pass_rate':
      return `Pass rate declining for ${insight.trendWeeks} weeks — now at ${insight.currentValue.toFixed(1)}%`;
    case 'declining_metric':
      return `${insight.metricLabel} declining for ${insight.trendWeeks}+ weeks`;
    default:
      return insight.metricLabel;
  }
}

function getTypeLabel(type: CoachingInsight['type']): string {
  switch (type) {
    case 'low_quote_rate': return 'Low Quote Rate';
    case 'low_close_rate': return 'Low Close Rate';
    case 'objection_pattern': return 'Recurring Objection';
    case 'low_call_volume': return 'Low Call Volume';
    case 'low_talk_time': return 'Low Talk Time';
    case 'declining_pass_rate': return 'Declining Pass Rate';
    case 'declining_metric': return 'Declining Metric';
    default: return 'Insight';
  }
}

export function InsightRow({ insight }: InsightRowProps) {
  const [open, setOpen] = useState(false);
  const isCritical = insight.severity === 'critical';

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left">
          {isCritical ? (
            <AlertCircle className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                isCritical
                  ? 'bg-red-500/10 text-red-500'
                  : 'bg-amber-500/10 text-amber-500'
              }`}>
                {getTypeLabel(insight.type)}
              </span>
            </div>
            <p className="text-sm text-foreground mt-1">{getDescription(insight)}</p>
          </div>
          {open ? (
            <ChevronDown className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-7 mb-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <p className="text-sm text-muted-foreground leading-relaxed">{insight.suggestion}</p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
