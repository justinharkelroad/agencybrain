import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, isToday, isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

interface PlaybookWeekHeaderProps {
  weekStart: Date;
  selectedDayIndex: number;
  onSelectDay: (index: number) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  weeklyPoints: number;
  dayItemCounts: Record<string, number>;
  dayCompletedCounts: Record<string, number>;
}

export function PlaybookWeekHeader({
  weekStart,
  selectedDayIndex,
  onSelectDay,
  onPrevWeek,
  onNextWeek,
  weeklyPoints,
  dayItemCounts,
  dayCompletedCounts,
}: PlaybookWeekHeaderProps) {
  const weekLabel = `Week of ${format(weekStart, "MMM d")}`;
  const today = startOfDay(new Date());

  const days = Array.from({ length: 5 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dateStr = format(date, "yyyy-MM-dd");
    const isCurrentDay = isToday(date);
    const isPast = isBefore(date, today) && !isCurrentDay;
    const total = dayItemCounts[dateStr] || 0;
    const completed = dayCompletedCounts[dateStr] || 0;
    return { date, dateStr, label: format(date, "EEE"), dayNum: format(date, "d"), isCurrentDay, isPast, total, completed };
  });

  return (
    <div className="space-y-3">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold">{weekLabel}</p>
          <p className="text-xs text-muted-foreground">
            {weeklyPoints}/20 points
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day tabs */}
      <div className="grid grid-cols-5 gap-1">
        {days.map((day, i) => (
          <button
            key={day.dateStr}
            onClick={() => onSelectDay(i)}
            className={cn(
              "flex flex-col items-center rounded-lg py-2 px-1 text-xs transition-all",
              selectedDayIndex === i
                ? "bg-primary text-primary-foreground shadow-sm"
                : day.isCurrentDay
                  ? "bg-primary/10 text-primary hover:bg-primary/20"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted",
              day.isPast && selectedDayIndex !== i && "opacity-60"
            )}
          >
            <span className="font-medium">{day.label}</span>
            <span className={cn(
              "text-lg font-bold leading-tight",
              selectedDayIndex === i ? "text-primary-foreground" : ""
            )}>
              {day.dayNum}
            </span>
            {/* Completion dots */}
            <div className="flex gap-0.5 mt-1">
              {Array.from({ length: Math.max(day.total, 0) }, (_, j) => (
                <div
                  key={j}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    j < day.completed
                      ? selectedDayIndex === i ? "bg-primary-foreground" : "bg-primary"
                      : selectedDayIndex === i ? "bg-primary-foreground/30" : "bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
