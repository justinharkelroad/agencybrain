import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar } from 'lucide-react';

interface ProgressStatsProps {
  currentWeek: number;
  totalWeeks?: number;
  completedLessons: number;
  totalLessons: number;
  progressPercent: number;
  daysRemaining?: number;
  endDate?: string;
  isActive?: boolean;
  variant?: 'cards' | 'inline';
}

/**
 * Progress statistics display for the Sales Experience.
 * Shows current week, lesson completion, and optionally days remaining.
 */
export function ProgressStats({
  currentWeek,
  totalWeeks = 8,
  completedLessons,
  totalLessons,
  progressPercent,
  daysRemaining,
  endDate,
  isActive,
  variant = 'cards',
}: ProgressStatsProps) {
  if (variant === 'inline') {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Current Week</p>
              <p className="text-3xl font-bold">{currentWeek}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Completed</p>
              <p className="text-3xl font-bold">
                {completedLessons}/{totalLessons}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Progress</p>
              <div className="flex items-center gap-2">
                <Progress value={progressPercent} className="h-2 flex-1" />
                <span className="text-sm font-medium">{progressPercent}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Current Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">{currentWeek}</span>
            <span className="text-muted-foreground">of {totalWeeks}</span>
          </div>
          {isActive && (
            <Badge
              variant="outline"
              className="mt-2 bg-green-500/10 text-green-600 border-green-500/30"
            >
              Active
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Overall Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-bold">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {completedLessons} of {totalLessons} lessons completed
          </p>
        </CardContent>
      </Card>

      {(daysRemaining !== undefined || endDate) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Days Remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{daysRemaining ?? 0}</span>
              <span className="text-muted-foreground">days</span>
            </div>
            {endDate && (
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Ends {endDate}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
