import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InsightRow } from './InsightRow';
import type { TeamMemberInsights } from '@/types/coaching';

interface TeamMemberInsightCardProps {
  memberInsights: TeamMemberInsights;
}

export function TeamMemberInsightCard({ memberInsights }: TeamMemberInsightCardProps) {
  const { teamMemberName, role, insights, criticalCount, warningCount } = memberInsights;

  return (
    <Card className={criticalCount > 0 ? 'border-red-500/30' : 'border-amber-500/20'}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{teamMemberName}</h3>
            <Badge variant="outline" className="text-xs font-normal">
              {role}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            {criticalCount > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">
                {criticalCount} critical
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
                {warningCount} warning{warningCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y divide-border">
          {insights.map((insight) => (
            <InsightRow key={insight.id} insight={insight} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
