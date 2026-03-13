import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Target } from "lucide-react";
import { format, addDays, isToday, isBefore, startOfDay } from "date-fns";
import { useDroppable } from "@dnd-kit/core";
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

function DroppableDayTab({
  dateStr,
  index,
  selected,
  isCurrentDay,
  isPast,
  label,
  dayNum,
  total,
  completed,
  onSelectDay,
}: {
  dateStr: string;
  index: number;
  selected: boolean;
  isCurrentDay: boolean;
  isPast: boolean;
  label: string;
  dayNum: string;
  total: number;
  completed: number;
  onSelectDay: (i: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-drop-${dateStr}`, data: { dateStr } });

  return (
    <button
      ref={setNodeRef}
      onClick={() => onSelectDay(index)}
      className={cn(
        "flex flex-col items-center rounded-lg py-2 px-1 text-xs transition-all",
        selected
          ? "bg-primary text-primary-foreground shadow-sm"
          : isCurrentDay
            ? "bg-primary/10 text-primary hover:bg-primary/20"
            : "bg-muted/50 text-muted-foreground hover:bg-muted",
        isPast && !selected && "opacity-60",
        isOver && !isPast && total < 4 && "ring-2 ring-primary ring-offset-1 scale-105"
      )}
    >
      <span className="font-medium">{label}</span>
      <span className={cn(
        "text-lg font-bold leading-tight",
        selected ? "text-primary-foreground" : ""
      )}>
        {dayNum}
      </span>
      {/* Completion dots */}
      <div className="flex gap-0.5 mt-1">
        {Array.from({ length: Math.max(total, 0) }, (_, j) => (
          <div
            key={j}
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              j < completed
                ? selected ? "bg-primary-foreground" : "bg-primary"
                : selected ? "bg-primary-foreground/30" : "bg-muted-foreground/30"
            )}
          />
        ))}
      </div>
    </button>
  );
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
  const progress = Math.min(weeklyPoints / 20, 1);
  const circumference = 2 * Math.PI * 15.5; // ~97.4

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
      {/* Week navigation + score ring */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-3">
          {/* Mini progress ring */}
          <div className="relative w-12 h-12 shrink-0">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18" cy="18" r="15.5"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="2.5"
              />
              <circle
                cx="18" cy="18" r="15.5"
                fill="none"
                stroke={weeklyPoints >= 20 ? "hsl(142, 71%, 45%)" : "hsl(var(--primary))"}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={`${progress * circumference} ${circumference}`}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {weeklyPoints >= 20 ? (
                <Target className="h-4 w-4 text-emerald-500" />
              ) : (
                <span className="text-xs font-bold">{weeklyPoints}</span>
              )}
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm font-semibold">{weekLabel}</p>
            <p className="text-xs text-muted-foreground">
              <span className={cn("font-medium", weeklyPoints >= 20 ? "text-emerald-500" : "text-foreground")}>
                {weeklyPoints}
              </span>
              <span>/20 pts</span>
            </p>
          </div>
        </div>

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day tabs — each is a drop target */}
      <div className="grid grid-cols-5 gap-1">
        {days.map((day, i) => (
          <DroppableDayTab
            key={day.dateStr}
            dateStr={day.dateStr}
            index={i}
            selected={selectedDayIndex === i}
            isCurrentDay={day.isCurrentDay}
            isPast={day.isPast}
            label={day.label}
            dayNum={day.dayNum}
            total={day.total}
            completed={day.completed}
            onSelectDay={onSelectDay}
          />
        ))}
      </div>
    </div>
  );
}
