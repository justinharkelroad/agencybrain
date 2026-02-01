import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfDay, startOfWeek, addDays, addWeeks, isToday, isBefore, isWeekend } from 'date-fns';
import { cn } from '@/lib/utils';
import type { OnboardingTask } from '@/hooks/useOnboardingTasks';

interface SevenDayOutlookProps {
  tasks: OnboardingTask[];
  onDayClick?: (date: Date) => void;
  selectedDate?: Date | null;
}

/**
 * Get the business days (Mon-Fri) for the current week
 */
function getCurrentWeekBusinessDays(today: Date): Date[] {
  // Get Monday of current week (weekStartsOn: 1 = Monday)
  const monday = startOfWeek(today, { weekStartsOn: 1 });

  const days: Date[] = [];
  for (let i = 0; i < 5; i++) {
    days.push(addDays(monday, i));
  }

  return days;
}

/**
 * Count tasks for a specific date (incomplete only)
 */
function getTasksForDate(tasks: OnboardingTask[], date: Date) {
  const dateStr = format(date, 'yyyy-MM-dd');
  return tasks.filter(task => {
    const taskDate = task.due_date.split('T')[0];
    return taskDate === dateStr && task.status !== 'completed';
  });
}

/**
 * Check if a date is in the past (before today)
 */
function isPastDate(date: Date, today: Date): boolean {
  return isBefore(startOfDay(date), startOfDay(today));
}

export function SevenDayOutlook({ tasks, onDayClick, selectedDate }: SevenDayOutlookProps) {
  const today = useMemo(() => startOfDay(new Date()), []);

  // If today is a weekend, default to showing next week (offset +1)
  const defaultOffset = useMemo(() => isWeekend(today) ? 1 : 0, [today]);
  const [weekOffset, setWeekOffset] = useState(defaultOffset);

  // Get Mon-Fri of the selected week (current week + offset)
  const baseDate = useMemo(() => addWeeks(today, weekOffset), [today, weekOffset]);
  const businessDays = useMemo(() => getCurrentWeekBusinessDays(baseDate), [baseDate]);

  // Calculate task counts per day
  const dayCounts = useMemo(() => {
    return businessDays.map(date => {
      const dayTasks = getTasksForDate(tasks, date);
      const isPast = isPastDate(date, today);
      const hasIncompleteTasks = dayTasks.length > 0;

      return {
        date,
        tasks: dayTasks,
        count: dayTasks.length,
        isPast,
        // Past days with incomplete tasks are "missed"
        isMissed: isPast && hasIncompleteTasks,
      };
    });
  }, [businessDays, tasks, today]);

  // Count all missed (past + incomplete) tasks
  const missedCount = dayCounts
    .filter(d => d.isMissed)
    .reduce((sum, d) => sum + d.count, 0);

  // Total incomplete for the week
  const weekTotal = dayCounts.reduce((sum, day) => sum + day.count, 0);

  // Get week range for header
  const weekStart = businessDays[0];
  const weekEnd = businessDays[4];
  const weekLabel = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`;

  // Determine week title
  const getWeekTitle = () => {
    if (weekOffset === 0) return 'This Week';
    if (weekOffset === 1) return isWeekend(today) ? 'This Week' : 'Next Week';
    if (weekOffset === -1) return 'Last Week';
    if (weekOffset > 1) return `${weekOffset} Weeks Ahead`;
    return `${Math.abs(weekOffset)} Weeks Ago`;
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setWeekOffset(prev => prev - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">{getWeekTitle()}</CardTitle>
            <span className="text-sm text-muted-foreground">({weekLabel})</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setWeekOffset(prev => prev + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {/* Reset to current/next week button */}
            {weekOffset !== defaultOffset && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs ml-2"
                onClick={() => setWeekOffset(defaultOffset)}
              >
                Today
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {missedCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {missedCount} missed
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {weekTotal} total
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-5 gap-2">
          {dayCounts.map(({ date, count, tasks: dayTasks, isPast, isMissed }) => {
            const isSelectedDate = selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
            const isTodayDate = isToday(date);

            // Determine styling based on status
            const hasDueToday = isTodayDate && count > 0;
            const isFuture = !isPast && !isTodayDate;

            return (
              <button
                key={date.toISOString()}
                onClick={() => onDayClick?.(date)}
                className={cn(
                  'flex flex-col items-center p-3 rounded-lg border transition-all',
                  'hover:shadow-md hover:border-primary/50',
                  isSelectedDate && 'ring-2 ring-primary ring-offset-2',
                  // Missed (past with incomplete tasks) - RED
                  isMissed && 'border-red-400 dark:border-red-500/50 bg-red-50 dark:bg-red-500/10',
                  // Today with tasks - BLUE
                  hasDueToday && !isMissed && 'border-blue-400 dark:border-blue-500/50 bg-blue-50 dark:bg-blue-500/10',
                  // Today without tasks
                  isTodayDate && count === 0 && 'border-primary/30 bg-primary/5',
                  // Past day completed (no tasks remaining)
                  isPast && !isMissed && 'border-green-300 dark:border-green-500/30 bg-green-50/50 dark:bg-green-500/5 opacity-75',
                  // Future with tasks
                  isFuture && count > 0 && 'border-border bg-card',
                  // Future without tasks
                  isFuture && count === 0 && 'border-border bg-muted/30',
                )}
              >
                {/* Day name */}
                <span className={cn(
                  'text-xs font-medium uppercase tracking-wide',
                  isTodayDate && 'text-primary',
                  isMissed && 'text-red-600 dark:text-red-400',
                  isPast && !isMissed && 'text-muted-foreground/60',
                )}>
                  {format(date, 'EEE')}
                </span>

                {/* Date */}
                <span className={cn(
                  'text-lg font-bold mt-0.5',
                  isTodayDate && !isMissed && 'text-primary',
                  isMissed && 'text-red-600 dark:text-red-400',
                  hasDueToday && !isMissed && 'text-blue-600 dark:text-blue-400',
                  isPast && !isMissed && 'text-muted-foreground/60',
                )}>
                  {format(date, 'd')}
                </span>

                {/* Month */}
                <span className={cn(
                  'text-[10px] -mt-0.5',
                  isPast && !isMissed ? 'text-muted-foreground/40' : 'text-muted-foreground',
                )}>
                  {format(date, 'MMM')}
                </span>

                {/* Task count badge */}
                <div className="mt-2 h-5 flex items-center">
                  {count > 0 ? (
                    <Badge
                      variant={isMissed ? 'destructive' : hasDueToday ? 'default' : 'secondary'}
                      className={cn(
                        'text-xs px-2 py-0.5',
                        hasDueToday && !isMissed && 'bg-blue-500 hover:bg-blue-600',
                      )}
                    >
                      {count}
                    </Badge>
                  ) : isPast ? (
                    <span className="text-xs text-green-600 dark:text-green-400">✓</span>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border-2 border-red-400 bg-red-50" />
            <span>Missed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border-2 border-blue-400 bg-blue-50" />
            <span>Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border-2 border-green-300 bg-green-50" />
            <span>Done</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border-2 border-border bg-muted/30" />
            <span>Upcoming</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
