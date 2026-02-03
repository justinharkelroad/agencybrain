import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format,
  startOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
} from 'date-fns';
import { cn } from '@/lib/utils';
import type { OnboardingTask } from '@/hooks/useOnboardingTasks';

interface MonthlyTaskCalendarProps {
  tasks: OnboardingTask[];
  onDayClick?: (date: Date) => void;
  selectedDate?: Date | null;
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Get tasks for a specific date (incomplete only)
 */
function getTasksForDate(tasks: OnboardingTask[], date: Date) {
  const dateStr = format(date, 'yyyy-MM-dd');
  return tasks.filter((task) => {
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

/**
 * Get breakdown of tasks by action type for tooltip
 */
function getTaskBreakdown(tasks: OnboardingTask[]): string {
  const counts: Record<string, number> = {};
  tasks.forEach((task) => {
    const type = task.action_type || 'other';
    counts[type] = (counts[type] || 0) + 1;
  });

  const labels: Record<string, string> = {
    call: 'Call',
    text: 'Text',
    email: 'Email',
    other: 'Task',
  };

  return Object.entries(counts)
    .map(([type, count]) => `${count} ${labels[type] || type}${count > 1 ? 's' : ''}`)
    .join(', ');
}

export function MonthlyTaskCalendar({
  tasks,
  onDayClick,
  selectedDate,
}: MonthlyTaskCalendarProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(today));

  // Get all days to display in the calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days: Date[] = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  // Calculate task counts per day
  const dayCounts = useMemo(() => {
    return calendarDays.map((date) => {
      const dayTasks = getTasksForDate(tasks, date);
      const isPast = isPastDate(date, today);
      const hasIncompleteTasks = dayTasks.length > 0;
      const isCurrentMonth = isSameMonth(date, currentMonth);

      return {
        date,
        tasks: dayTasks,
        count: dayTasks.length,
        isPast,
        isCurrentMonth,
        isMissed: isPast && hasIncompleteTasks,
      };
    });
  }, [calendarDays, tasks, today, currentMonth]);

  // Stats for the month
  const monthStats = useMemo(() => {
    const currentMonthDays = dayCounts.filter((d) => d.isCurrentMonth);
    const missedCount = currentMonthDays
      .filter((d) => d.isMissed)
      .reduce((sum, d) => sum + d.count, 0);
    const totalCount = currentMonthDays.reduce((sum, d) => sum + d.count, 0);
    return { missedCount, totalCount };
  }, [dayCounts]);

  const handlePrevMonth = () => setCurrentMonth((prev) => addMonths(prev, -1));
  const handleNextMonth = () => setCurrentMonth((prev) => addMonths(prev, 1));
  const handleToday = () => setCurrentMonth(startOfMonth(today));

  const isCurrentMonthView = isSameMonth(currentMonth, today);

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handlePrevMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CalendarRange className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">
              {format(currentMonth, 'MMMM yyyy')}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleNextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isCurrentMonthView && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs ml-2"
                onClick={handleToday}
              >
                Today
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {monthStats.missedCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {monthStats.missedCount} missed
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {monthStats.totalCount} total
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_NAMES.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {dayCounts.map(({ date, count, tasks: dayTasks, isPast, isCurrentMonth, isMissed }) => {
            const isSelectedDate =
              selectedDate &&
              format(selectedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
            const isTodayDate = isToday(date);
            const hasDueToday = isTodayDate && count > 0;
            const isFuture = !isPast && !isTodayDate;

            const dayButton = (
              <button
                key={date.toISOString()}
                onClick={() => onDayClick?.(date)}
                disabled={!isCurrentMonth}
                className={cn(
                  'relative flex flex-col items-center justify-center p-1.5 min-h-[52px] rounded-md border transition-all',
                  isCurrentMonth
                    ? 'hover:shadow-md hover:border-primary/50'
                    : 'opacity-30 cursor-default',
                  isSelectedDate && 'ring-2 ring-primary ring-offset-1',
                  // Missed (past with incomplete tasks) - RED
                  isCurrentMonth &&
                    isMissed &&
                    'border-red-400 dark:border-red-500/50 bg-red-50 dark:bg-red-500/10',
                  // Today with tasks - BLUE
                  isCurrentMonth &&
                    hasDueToday &&
                    !isMissed &&
                    'border-blue-400 dark:border-blue-500/50 bg-blue-50 dark:bg-blue-500/10',
                  // Today without tasks
                  isCurrentMonth &&
                    isTodayDate &&
                    count === 0 &&
                    'border-primary/30 bg-primary/5',
                  // Past day completed (no tasks remaining)
                  isCurrentMonth &&
                    isPast &&
                    !isMissed &&
                    !isTodayDate &&
                    'border-green-300 dark:border-green-500/30 bg-green-50/50 dark:bg-green-500/5 opacity-75',
                  // Future with tasks
                  isCurrentMonth &&
                    isFuture &&
                    count > 0 &&
                    'border-border bg-card',
                  // Future without tasks
                  isCurrentMonth && isFuture && count === 0 && 'border-border bg-muted/30',
                  // Not current month
                  !isCurrentMonth && 'border-transparent bg-transparent'
                )}
              >
                {/* Date number */}
                <span
                  className={cn(
                    'text-sm font-medium',
                    isTodayDate && !isMissed && 'text-primary',
                    isMissed && 'text-red-600 dark:text-red-400',
                    hasDueToday && !isMissed && 'text-blue-600 dark:text-blue-400',
                    isPast && !isMissed && !isTodayDate && 'text-muted-foreground/60',
                    !isCurrentMonth && 'text-muted-foreground/30'
                  )}
                >
                  {format(date, 'd')}
                </span>

                {/* Task count badge */}
                {isCurrentMonth && (
                  <div className="mt-0.5 h-4 flex items-center">
                    {count > 0 ? (
                      <Badge
                        variant={
                          isMissed ? 'destructive' : hasDueToday ? 'default' : 'secondary'
                        }
                        className={cn(
                          'text-[10px] px-1.5 py-0 h-4 min-w-[18px] justify-center',
                          hasDueToday && !isMissed && 'bg-blue-500 hover:bg-blue-600'
                        )}
                      >
                        {count}
                      </Badge>
                    ) : isPast && !isTodayDate ? (
                      <span className="text-[10px] text-green-600 dark:text-green-400">

                      </span>
                    ) : null}
                  </div>
                )}
              </button>
            );

            // Wrap with tooltip if there are tasks
            if (count > 0 && isCurrentMonth) {
              return (
                <TooltipProvider key={date.toISOString()}>
                  <Tooltip>
                    <TooltipTrigger asChild>{dayButton}</TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <p className="font-medium">{format(date, 'EEEE, MMM d')}</p>
                      <p className="text-muted-foreground">{getTaskBreakdown(dayTasks)}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }

            return dayButton;
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
