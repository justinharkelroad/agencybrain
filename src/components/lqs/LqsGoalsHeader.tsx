import { Target, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { LqsRoiSummary } from '@/hooks/useLqsRoiAnalytics';

interface LqsGoalsHeaderProps {
  summary: LqsRoiSummary | null;
  agencyGoals: {
    dailyQuotedHouseholdsTarget: number | null;
    dailySoldItemsTarget: number | null;
  } | null;
  daysInPeriod: number;
  isLoading?: boolean;
}

// Format currency from cents
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

// Goal metric card
function GoalMetric({
  label,
  current,
  target,
  format = 'number',
  icon: Icon,
}: {
  label: string;
  current: number;
  target: number | null;
  format?: 'number' | 'currency';
  icon: React.ElementType;
}) {
  const hasTarget = target !== null && target > 0;
  const progress = hasTarget ? Math.min((current / target) * 100, 100) : 0;
  const isAhead = hasTarget && current >= target;
  const displayCurrent = format === 'currency' ? formatCurrency(current) : current.toLocaleString();
  const displayTarget = hasTarget
    ? format === 'currency'
      ? formatCurrency(target)
      : target.toLocaleString()
    : 'No target set';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', isAhead ? 'text-green-500' : 'text-muted-foreground')} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn(
                'text-sm font-bold',
                isAhead ? 'text-green-500' : hasTarget ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {displayCurrent}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Target: {displayTarget}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {hasTarget ? (
        <div className="flex items-center gap-2">
          <Progress value={progress} className="h-2 flex-1" />
          <span className={cn(
            'text-xs font-medium',
            isAhead ? 'text-green-500' : progress >= 75 ? 'text-amber-500' : 'text-muted-foreground'
          )}>
            {progress.toFixed(0)}%
          </span>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          No target configured
        </div>
      )}
    </div>
  );
}

export function LqsGoalsHeader({
  summary,
  agencyGoals,
  daysInPeriod,
  isLoading,
}: LqsGoalsHeaderProps) {
  if (isLoading || !summary) {
    return null;
  }

  // Calculate period targets from daily targets
  const quotedHHTarget = agencyGoals?.dailyQuotedHouseholdsTarget
    ? agencyGoals.dailyQuotedHouseholdsTarget * daysInPeriod
    : null;

  const soldItemsTarget = agencyGoals?.dailySoldItemsTarget
    ? agencyGoals.dailySoldItemsTarget * daysInPeriod
    : null;

  // Get current values based on view type
  const quotedHH = summary.isActivityView ? summary.quotesCreated : summary.quotedHouseholds;
  const soldItems = summary.isActivityView ? summary.salesClosed : summary.soldHouseholds;

  // If no goals are set, don't show the header
  if (!quotedHHTarget && !soldItemsTarget) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Period Goals</h3>
          <span className="text-xs text-muted-foreground">
            ({daysInPeriod} day{daysInPeriod !== 1 ? 's' : ''})
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <GoalMetric
            label="Quoted Households"
            current={quotedHH}
            target={quotedHHTarget}
            icon={Target}
          />
          <GoalMetric
            label="Sold Households"
            current={soldItems}
            target={soldItemsTarget}
            icon={TrendingUp}
          />
          <GoalMetric
            label="Written Premium"
            current={summary.premiumSoldCents}
            target={null} // No premium target in agency settings yet
            format="currency"
            icon={TrendingUp}
          />
          <GoalMetric
            label="Commission Earned"
            current={summary.commissionEarned}
            target={null} // No commission target in agency settings yet
            format="currency"
            icon={TrendingUp}
          />
        </div>
      </CardContent>
    </Card>
  );
}
