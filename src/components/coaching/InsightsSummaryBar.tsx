import { Users, AlertCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface InsightsSummaryBarProps {
  membersNeedingAttention: number;
  totalCritical: number;
  totalWarnings: number;
  teamPassRate: number;
  isLoading: boolean;
}

const metrics = [
  {
    key: 'attention' as const,
    label: 'Needs Attention',
    icon: Users,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
  {
    key: 'critical' as const,
    label: 'Critical Issues',
    icon: AlertCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
  },
  {
    key: 'warnings' as const,
    label: 'Warnings',
    icon: AlertTriangle,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
  },
  {
    key: 'passRate' as const,
    label: 'Team Pass Rate (30d)',
    icon: TrendingUp,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
  },
];

export function InsightsSummaryBar({
  membersNeedingAttention,
  totalCritical,
  totalWarnings,
  teamPassRate,
  isLoading,
}: InsightsSummaryBarProps) {
  const values: Record<string, string> = {
    attention: membersNeedingAttention.toString(),
    critical: totalCritical.toString(),
    warnings: totalWarnings.toString(),
    passRate: `${teamPassRate.toFixed(0)}%`,
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <Card key={metric.key} className={`${metric.bgColor} ${metric.borderColor} border backdrop-blur-sm`}>
            <CardContent className="p-4">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-12" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`p-1.5 rounded-md ${metric.bgColor}`}>
                      <Icon className={`h-4 w-4 ${metric.color}`} />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {metric.label}
                    </span>
                  </div>
                  <div className={`text-2xl font-bold ${metric.color}`}>
                    {values[metric.key]}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
