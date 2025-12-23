import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Flame, Zap, Calendar } from 'lucide-react';
import { format, subWeeks, startOfWeek, addDays, isSameWeek } from 'date-fns';
import { cn } from '@/lib/utils';

interface WeeklyHistoryEntry {
  weekStart: Date;
  core4Points: number;
  flowPoints: number;
  combinedPoints: number;
  maxPoints: number;
}

interface WeeklyHistoryCardProps {
  // Core 4 entries with date and points
  core4Entries: Array<{
    date: string;
    points: number; // 0-4
  }>;
  // Flow sessions with completed_at dates
  flowSessions: Array<{
    completed_at: string;
  }>;
  weeksToShow?: number;
}

export function WeeklyHistoryCard({ 
  core4Entries, 
  flowSessions, 
  weeksToShow = 8 
}: WeeklyHistoryCardProps) {
  const [startIndex, setStartIndex] = useState(0);
  const visibleWeeks = 4;

  // Calculate weekly history data
  const weeklyHistory = useMemo(() => {
    const history: WeeklyHistoryEntry[] = [];
    const today = new Date();
    
    for (let i = 0; i < weeksToShow; i++) {
      const weekStart = startOfWeek(subWeeks(today, i), { weekStartsOn: 1 });
      
      // Calculate Core 4 points for this week (max 28)
      let core4Points = 0;
      for (let d = 0; d < 7; d++) {
        const dayDate = format(addDays(weekStart, d), 'yyyy-MM-dd');
        const entry = core4Entries.find(e => e.date === dayDate);
        if (entry) {
          core4Points += entry.points;
        }
      }
      
      // Calculate Flow points for this week (unique days, max 7)
      const flowDaysThisWeek = new Set<string>();
      flowSessions.forEach(session => {
        const sessionDate = new Date(session.completed_at);
        if (isSameWeek(sessionDate, weekStart, { weekStartsOn: 1 })) {
          flowDaysThisWeek.add(format(sessionDate, 'yyyy-MM-dd'));
        }
      });
      const flowPoints = flowDaysThisWeek.size;
      
      history.push({
        weekStart,
        core4Points,
        flowPoints,
        combinedPoints: core4Points + flowPoints,
        maxPoints: 35,
      });
    }
    
    return history;
  }, [core4Entries, flowSessions, weeksToShow]);

  const canGoBack = startIndex + visibleWeeks < weeklyHistory.length;
  const canGoForward = startIndex > 0;

  const visibleHistory = weeklyHistory.slice(startIndex, startIndex + visibleWeeks);

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && canGoBack) {
      setStartIndex(prev => prev + 1);
    } else if (direction === 'next' && canGoForward) {
      setStartIndex(prev => prev - 1);
    }
  };

  const getScoreColor = (score: number, max: number) => {
    const percentage = (score / max) * 100;
    if (percentage >= 80) return 'text-green-500';
    if (percentage >= 60) return 'text-cyan-500';
    if (percentage >= 40) return 'text-yellow-500';
    return 'text-muted-foreground';
  };

  const getProgressWidth = (score: number, max: number) => {
    return Math.min((score / max) * 100, 100);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-semibold">Weekly History</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => handleNavigate('prev')}
              disabled={!canGoBack}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => handleNavigate('next')}
              disabled={!canGoForward}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-3">
          {visibleHistory.map((week, index) => {
            const isCurrentWeek = index === 0 && startIndex === 0;
            const weekLabel = isCurrentWeek 
              ? 'This Week' 
              : index === 1 && startIndex === 0 
                ? 'Last Week'
                : format(week.weekStart, 'MMM d');
            
            return (
              <div 
                key={week.weekStart.toISOString()} 
                className={cn(
                  "p-3 rounded-lg transition-all",
                  isCurrentWeek ? "bg-primary/10 border border-primary/20" : "bg-muted/30"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm font-medium",
                      isCurrentWeek && "text-primary"
                    )}>
                      {weekLabel}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(week.weekStart, 'MMM d')} - {format(addDays(week.weekStart, 6), 'MMM d')}
                    </span>
                  </div>
                  <span className={cn(
                    "text-lg font-bold",
                    getScoreColor(week.combinedPoints, week.maxPoints)
                  )}>
                    {week.combinedPoints}/{week.maxPoints}
                  </span>
                </div>
                
                {/* Progress bar */}
                <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-primary rounded-full transition-all duration-300"
                    style={{ width: `${getProgressWidth(week.combinedPoints, week.maxPoints)}%` }}
                  />
                </div>
                
                {/* Breakdown */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Flame className="h-3 w-3 text-orange-500" />
                      Core: {week.core4Points}/28
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-purple-500" />
                      Flow: {week.flowPoints}/7
                    </span>
                  </div>
                  {week.combinedPoints === week.maxPoints && (
                    <span className="text-green-500 font-medium">Perfect! 🎉</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {weeklyHistory.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">No history data yet</p>
            <p className="text-xs">Complete Core 4 and Flow sessions to build your history</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
