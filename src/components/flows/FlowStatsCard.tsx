import { useFlowStats, Milestone } from '@/hooks/useFlowStats';
import { Card, CardContent } from '@/components/ui/card';
import { Flame, Trophy, Target, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FlowStatsCard() {
  const stats = useFlowStats();

  if (stats.loading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="animate-pulse flex items-center justify-between">
            <div className="h-20 w-20 bg-muted rounded-full" />
            <div className="flex-1 mx-6 space-y-2">
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
            <div className="h-16 w-32 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const weeklyPercent = Math.min((stats.weeklyProgress / stats.weeklyGoal) * 100, 100);
  const circumference = 2 * Math.PI * 40; // radius = 40
  const strokeDashoffset = circumference - (weeklyPercent / 100) * circumference;

  return (
    <Card className="mb-6 overflow-hidden border-border/10">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row items-stretch">
          {/* Weekly Goal Circle */}
          <div className="flex items-center justify-center p-6 bg-primary/5">
            <div className="relative">
              <svg width="100" height="100" className="transform -rotate-90">
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-muted/30"
                />
                {/* Progress circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="text-primary transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{stats.weeklyProgress}</span>
                <span className="text-xs text-muted-foreground">/ {stats.weeklyGoal}</span>
              </div>
            </div>
          </div>

          {/* Weekly Activity */}
          <div className="flex-1 p-6 border-t sm:border-t-0 sm:border-l border-border/10">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              <span className="text-sm font-medium">This Week</span>
            </div>
            <div className="flex justify-between gap-1">
              {stats.weeklyActivity.map((day, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">{day.dayLabel}</span>
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all',
                      day.completed > 0
                        ? 'bg-primary text-primary-foreground'
                        : day.isToday
                        ? 'bg-muted/50 border-2 border-dashed border-primary/50'
                        : day.isPast
                        ? 'bg-muted/30 text-muted-foreground'
                        : 'bg-muted/20 text-muted-foreground/50'
                    )}
                  >
                    {day.completed > 0 ? (
                      day.completed > 1 ? day.completed : '✓'
                    ) : day.isToday ? (
                      '•'
                    ) : (
                      ''
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="flex sm:flex-col justify-around p-6 border-t sm:border-t-0 sm:border-l border-border/10 bg-muted/5">
            {/* Current Streak */}
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                stats.currentStreak > 0 ? 'bg-orange-500/20' : 'bg-muted/30'
              )}>
                <Flame className={cn(
                  'h-5 w-5',
                  stats.currentStreak > 0 ? 'text-orange-500' : 'text-muted-foreground'
                )} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.currentStreak}</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            </div>

            {/* Total Flows */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.totalFlows}</p>
                <p className="text-xs text-muted-foreground">Total Flows</p>
              </div>
            </div>
          </div>
        </div>

        {/* Milestones Bar */}
        {stats.longestStreak > 0 && (
          <div className="px-6 py-3 border-t border-border/10 bg-muted/5">
            <div className="flex items-center gap-2 flex-wrap">
              <Trophy className="h-4 w-4 text-yellow-500" strokeWidth={1.5} />
              <span className="text-xs text-muted-foreground">Milestones:</span>
              <div className="flex gap-2 flex-wrap">
                {stats.milestones.map((milestone, idx) => (
                  <MilestoneBadge key={idx} milestone={milestone} />
                ))}
              </div>
              {stats.longestStreak !== stats.currentStreak && (
                <span className="text-xs text-muted-foreground ml-auto">
                  Best: {stats.longestStreak} days
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MilestoneBadge({ milestone }: { milestone: Milestone }) {
  return (
    <div
      className={cn(
        'px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition-all',
        milestone.achieved
          ? 'bg-yellow-500/20 text-yellow-600'
          : 'bg-muted/30 text-muted-foreground/50'
      )}
      title={milestone.achieved ? `${milestone.label} achieved!` : `Reach ${milestone.days} days`}
    >
      <span>{milestone.icon}</span>
      <span>{milestone.label}</span>
    </div>
  );
}
