import { useState } from 'react';
import { AlertTriangle, AlertCircle, ChevronDown, ChevronRight, Lightbulb, CircleHelp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

function getTypeDescription(type: CoachingInsight['type']): string {
  switch (type) {
    case 'low_quote_rate':
      return 'This rep is quoting less than expected from their lead volume in the current activity window.';
    case 'low_close_rate':
      return 'This rep is converting a smaller share of quoted leads compared to team/target expectations.';
    case 'objection_pattern':
      return 'This objection is appearing repeatedly and likely deserves focused coaching.';
    case 'low_call_volume':
      return 'This rep has fewer outbound calls than expected for the same period.';
    case 'low_talk_time':
      return 'This rep is spending less phone time than expected, which may signal rushed or low-depth calls.';
    case 'declining_pass_rate':
      return 'This rep has a sustained decline in pass-rate across recent buckets.';
    case 'declining_metric':
      return 'A related metric is trending lower over consecutive periods.';
    default:
      return '';
  }
}

export function InsightRow({ insight }: InsightRowProps) {
  const [open, setOpen] = useState(false);
  const isCritical = insight.severity === 'critical';

  return (
    <TooltipProvider delayDuration={250}>
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    role="button"
                    tabIndex={0}
                    className="inline-flex text-muted-foreground/80 hover:text-foreground transition-colors"
                    aria-label={`${getTypeLabel(insight.type)} help`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <CircleHelp className="h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-64">
                  <p className="text-xs">{getTypeDescription(insight.type)}</p>
                </TooltipContent>
              </Tooltip>
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
    </TooltipProvider>
  );
}
