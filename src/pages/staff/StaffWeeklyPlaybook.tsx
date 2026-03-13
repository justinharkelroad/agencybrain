import { useState, useMemo, useCallback } from "react";
import { format, startOfWeek, addDays, subDays, isBefore, startOfDay } from "date-fns";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useStaffFocusItems } from "@/hooks/useStaffFocusItems";
import { useStaffPlaybookStats } from "@/hooks/useStaffPlaybookStats";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { usePlaybookTags } from "@/hooks/usePlaybookTags";
import { getWeekKey } from "@/lib/date-utils";
import { PlaybookWeekHeader } from "@/components/playbook/PlaybookWeekHeader";
import { PlaybookDayView } from "@/components/playbook/PlaybookDayView";
import { PlaybookBenchPanel } from "@/components/playbook/PlaybookBenchPanel";
import { OneBigThingCard } from "@/components/playbook/OneBigThingCard";
import { ScheduleItemDialog } from "@/components/playbook/ScheduleItemDialog";
import { CreatePlaybookItemDialog } from "@/components/playbook/CreatePlaybookItemDialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { PlaybookDomain } from "@/hooks/useFocusItems";

export default function StaffWeeklyPlaybook() {
  const { user } = useStaffAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    const today = new Date().getDay();
    return today >= 1 && today <= 5 ? today - 1 : 0;
  });
  const [scheduleItemId, setScheduleItemId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [draggingItem, setDraggingItem] = useState<{ id: string; title: string } | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);

  const weekKey = getWeekKey(weekStart);
  const { items, isLoading, createItem, completeItem, uncompleteItem, deleteItem, scheduleItem, unscheduleItem, setOneBigThing, completeOneBigThing, clearOneBigThing } = useStaffFocusItems(weekKey);
  const { weeklyPoints, dailyCompleted } = useStaffPlaybookStats();

  // Staff users have agency_id on their user record
  const staffAgencyId = user?.agency_id || null;
  const { tags } = usePlaybookTags(staffAgencyId);

  const selectedDate = addDays(weekStart, selectedDayIndex);
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");

  // Is the current week in the past? (Friday of the week is before today)
  const weekFriday = addDays(weekStart, 4);
  const isPastWeek = isBefore(startOfDay(weekFriday), startOfDay(new Date()));

  const benchItems = useMemo(() => items.filter((i) => i.zone === "bench"), [items]);
  const oneBigThingItem = useMemo(() => items.find((i) => i.zone === "one_big_thing") || null, [items]);
  const powerPlaysByDay = useMemo(() => {
    const map: Record<string, typeof items> = {};
    items
      .filter((i) => i.zone === "power_play" && i.scheduled_date)
      .forEach((item) => {
        const d = item.scheduled_date!;
        if (!map[d]) map[d] = [];
        map[d].push(item);
      });
    return map;
  }, [items]);

  const dayItemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 5; i++) {
      const d = format(addDays(weekStart, i), "yyyy-MM-dd");
      counts[d] = (powerPlaysByDay[d] || []).length;
    }
    return counts;
  }, [weekStart, powerPlaysByDay]);

  const dayCompletedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 5; i++) {
      const d = format(addDays(weekStart, i), "yyyy-MM-dd");
      counts[d] = (powerPlaysByDay[d] || []).filter((it) => it.completed).length;
    }
    return counts;
  }, [weekStart, powerPlaysByDay]);

  const handleToggleComplete = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      if (item.completed) uncompleteItem.mutate(id);
      else completeItem.mutate(id);
    },
    [items, completeItem, uncompleteItem]
  );

  const handleScheduleConfirm = (date: string, domain?: PlaybookDomain, subTagId?: string) => {
    if (!scheduleItemId) return;
    scheduleItem.mutate({ id: scheduleItemId, date, domain, sub_tag_id: subTagId });
    setScheduleItemId(null);
  };

  const handleCreateNew = (data: {
    title: string;
    description?: string;
    domain?: PlaybookDomain;
    sub_tag_id?: string;
  }) => {
    createItem.mutate({
      title: data.title,
      description: data.description,
      priority_level: "mid",
      zone: "bench",
      domain: data.domain,
      sub_tag_id: data.sub_tag_id,
    });
  };

  // Drag and drop
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.itemId) {
      setDraggingItem({ id: data.itemId, title: data.title });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingItem(null);
    const { active, over } = event;
    if (!over) return;

    const overId = String(over.id);
    const itemId = active.data.current?.itemId as string;
    if (!itemId) return;

    // Handle One Big Thing drop
    if (overId === "one-big-thing-drop") {
      if (oneBigThingItem) {
        toast.error("Clear the current One Big Thing first");
        return;
      }
      setOneBigThing.mutate({ id: itemId, wk: weekKey });
      return;
    }

    if (!overId.startsWith("day-drop-")) return;

    const dateStr = over.data.current?.dateStr as string;
    if (!dateStr) return;

    const dropDate = new Date(dateStr + "T12:00:00");
    const today = startOfDay(new Date());
    if (isBefore(startOfDay(dropDate), today)) {
      toast.error("Can't schedule to a past day");
      return;
    }

    if ((dayItemCounts[dateStr] || 0) >= 4) {
      toast.error("This day already has 4 Power Plays");
      return;
    }

    const item = items.find((i) => i.id === itemId);
    if (item?.domain) {
      scheduleItem.mutate({ id: itemId, date: dateStr });
    } else {
      setScheduleItemId(itemId);
      setDropTargetDate(dateStr);
    }
  };

  const scheduleTargetItem = scheduleItemId ? items.find((i) => i.id === scheduleItemId) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <h1 className="text-2xl font-bold mb-6">Weekly Playbook</h1>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          <div className="space-y-6">
            <OneBigThingCard
              item={oneBigThingItem}
              onComplete={(id, proof, feeling) => completeOneBigThing.mutate({ id, proof, feeling })}
              onUncomplete={(id) => uncompleteItem.mutate(id)}
              onClear={(id) => clearOneBigThing.mutate(id)}
              readOnly={isPastWeek}
            />

            <PlaybookWeekHeader
              weekStart={weekStart}
              selectedDayIndex={selectedDayIndex}
              onSelectDay={setSelectedDayIndex}
              onPrevWeek={() => setWeekStart((prev) => subDays(prev, 7))}
              onNextWeek={() => setWeekStart((prev) => addDays(prev, 7))}
              weeklyPoints={weeklyPoints}
              dayItemCounts={dayItemCounts}
              dayCompletedCounts={dayCompletedCounts}
            />

            <PlaybookDayView
              date={selectedDate}
              items={powerPlaysByDay[selectedDateStr] || []}
              queueItems={[]}
              onToggleComplete={handleToggleComplete}
              onDelete={(id) => deleteItem.mutate(id)}
              onUnschedule={(id) => unscheduleItem.mutate(id)}
            />
          </div>

          <div className="lg:border-l lg:pl-6">
            <PlaybookBenchPanel
              items={benchItems}
              onSchedule={(id) => setScheduleItemId(id)}
              onDelete={(id) => deleteItem.mutate(id)}
              onCreateNew={() => setShowCreateDialog(true)}
            />
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {draggingItem && (
            <div className="rounded-md border bg-card px-3 py-2 shadow-lg text-xs font-medium max-w-[200px] truncate">
              {draggingItem.title}
            </div>
          )}
        </DragOverlay>

        {scheduleTargetItem && (
          <ScheduleItemDialog
            open={!!scheduleItemId}
            onOpenChange={(open) => { if (!open) { setScheduleItemId(null); setDropTargetDate(null); } }}
            itemTitle={scheduleTargetItem.title}
            weekStart={weekStart}
            tags={tags}
            dayItemCounts={dayItemCounts}
            onConfirm={handleScheduleConfirm}
            defaultDate={dropTargetDate || undefined}
          />
        )}

        <CreatePlaybookItemDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          tags={tags}
          onConfirm={handleCreateNew}
        />
      </div>
    </DndContext>
  );
}
