import { PlaybookItemCard } from "./PlaybookItemCard";
import { cn } from "@/lib/utils";
import { format, isToday, isBefore, startOfDay } from "date-fns";
import type { FocusItem, PlaybookDomain } from "@/hooks/useFocusItems";
import type { StaffFocusItem } from "@/hooks/useStaffFocusItems";

type AnyFocusItem = FocusItem | StaffFocusItem;

interface PlaybookDayViewProps {
  date: Date;
  items: AnyFocusItem[];
  queueItems: AnyFocusItem[];
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onUnschedule: (id: string) => void;
  readOnly?: boolean;
}

export function PlaybookDayView({
  date,
  items,
  queueItems,
  onToggleComplete,
  onDelete,
  onUnschedule,
  readOnly,
}: PlaybookDayViewProps) {
  const today = isToday(date);
  const past = isBefore(startOfDay(date), startOfDay(new Date())) && !today;
  const completedCount = items.filter((i) => i.completed).length;
  const dayLabel = format(date, "EEEE, MMM d");

  return (
    <div className="space-y-3">
      {/* Day header */}
      <div className="flex items-center justify-between">
        <h3
          className={cn(
            "text-sm font-semibold",
            today && "text-primary"
          )}
        >
          {today ? "Today" : dayLabel}
          {today && (
            <span className="text-xs text-muted-foreground font-normal ml-2">
              {format(date, "MMM d")}
            </span>
          )}
        </h3>
        <span className="text-xs text-muted-foreground">
          {completedCount}/{items.length} done
        </span>
      </div>

      {/* Power Play slots */}
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          No Power Plays scheduled
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <PlaybookItemCard
              key={item.id}
              id={item.id}
              title={item.title}
              description={item.description}
              domain={item.domain as PlaybookDomain | null}
              sourceType={item.source_type}
              sourceName={item.source_name}
              completed={item.completed}
              onToggleComplete={onToggleComplete}
              onDelete={onDelete}
              onUnschedule={onUnschedule}
              readOnly={readOnly || past}
            />
          ))}
        </div>
      )}

      {/* Queue section (collapsed by default on non-today days) */}
      {today && queueItems.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Queue ({queueItems.length})
          </p>
          <div className="space-y-2">
            {queueItems.map((item) => (
              <PlaybookItemCard
                key={item.id}
                id={item.id}
                title={item.title}
                description={item.description}
                domain={item.domain as PlaybookDomain | null}
                sourceType={item.source_type}
                sourceName={item.source_name}
                completed={item.completed}
                onToggleComplete={onToggleComplete}
                onDelete={onDelete}
                onUnschedule={onUnschedule}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
