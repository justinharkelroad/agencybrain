import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, ArrowLeft, Target, Loader2 } from "lucide-react";
import { format, addDays, startOfWeek, addWeeks, isBefore, startOfDay } from "date-fns";
import { getWeekKey } from "@/lib/date-utils";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useFocusItems } from "@/hooks/useFocusItems";
import { usePlaybookTags } from "@/hooks/usePlaybookTags";
import { PlaybookWeekHeader } from "@/components/playbook/PlaybookWeekHeader";
import { PlaybookDayView } from "@/components/playbook/PlaybookDayView";
import { PlaybookBenchPanel } from "@/components/playbook/PlaybookBenchPanel";
import { OneBigThingCard } from "@/components/playbook/OneBigThingCard";
import { ScheduleItemDialog } from "@/components/playbook/ScheduleItemDialog";
import { CreatePlaybookItemDialog } from "@/components/playbook/CreatePlaybookItemDialog";
import { toast } from "sonner";
import type { PlaybookDomain } from "@/hooks/useFocusItems";

interface DebriefNextWeekPlanningProps {
  agencyId: string | null;
  nextWeekOBT: string;
  onSaveOBT: (obt: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function DebriefNextWeekPlanning({
  agencyId,
  nextWeekOBT,
  onSaveOBT,
  onNext,
  onBack,
}: DebriefNextWeekPlanningProps) {
  const [localOBT, setLocalOBT] = useState(nextWeekOBT);

  // Sync when prop changes (e.g. navigating back after save)
  useEffect(() => {
    setLocalOBT(nextWeekOBT);
  }, [nextWeekOBT]);

  // Next week dates
  const currentMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const nextMonday = addWeeks(currentMonday, 1);
  const nextWeekKey = getWeekKey(nextMonday);

  // Full playbook data for next week
  const {
    items,
    isLoading,
    createItem,
    completeItem,
    uncompleteItem,
    deleteItem,
    scheduleItem,
    unscheduleItem,
    setOneBigThing,
    completeOneBigThing,
    clearOneBigThing,
  } = useFocusItems(nextWeekKey);

  const { tags } = usePlaybookTags(agencyId);

  const [selectedDayIndex, setSelectedDayIndex] = useState(0); // Mon
  const [scheduleItemId, setScheduleItemId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [draggingItem, setDraggingItem] = useState<{ id: string; title: string } | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);

  const selectedDate = addDays(nextMonday, selectedDayIndex);
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");

  // Categorize items
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
      const d = format(addDays(nextMonday, i), "yyyy-MM-dd");
      counts[d] = (powerPlaysByDay[d] || []).length;
    }
    return counts;
  }, [nextMonday, powerPlaysByDay]);

  const dayCompletedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 5; i++) {
      const d = format(addDays(nextMonday, i), "yyyy-MM-dd");
      counts[d] = (powerPlaysByDay[d] || []).filter((it) => it.completed).length;
    }
    return counts;
  }, [nextMonday, powerPlaysByDay]);

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
    setDropTargetDate(null);
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

    if (overId === "one-big-thing-drop") {
      if (oneBigThingItem) {
        toast.error("Clear the current One Big Thing first");
        return;
      }
      setOneBigThing.mutate({ id: itemId, wk: nextWeekKey });
      return;
    }

    if (!overId.startsWith("day-drop-")) return;

    const dateStr = over.data.current?.dateStr as string;
    if (!dateStr) return;

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

  const handleNext = () => {
    if (localOBT !== nextWeekOBT) {
      onSaveOBT(localOBT);
    }
    onNext();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-white">Plan Next Week</h2>
        <p className="text-sm text-white/50 mt-1">
          Set your intention for {format(nextMonday, "MMM d")} - {format(addDays(nextMonday, 4), "MMM d")}
        </p>
      </div>

      {/* One Big Thing input */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/10 space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-amber-400" />
          <span className="text-sm font-semibold text-white">One Big Thing</span>
        </div>
        <p className="text-xs text-white/50">
          What's the single most important thing you want to accomplish next week?
        </p>
        <Input
          value={localOBT}
          onChange={(e) => setLocalOBT(e.target.value)}
          placeholder="My One Big Thing for next week..."
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      </div>

      {/* Full playbook for next week — light theme container */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </div>
      ) : (
        <div className="bg-background text-foreground rounded-xl border overflow-hidden">
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="p-4 space-y-4">
              <OneBigThingCard
                item={oneBigThingItem}
                onComplete={(id, proof, feeling) => completeOneBigThing.mutate({ id, proof, feeling })}
                onUncomplete={(id) => uncompleteItem.mutate(id)}
                onClear={(id) => clearOneBigThing.mutate(id)}
              />

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
                <div className="space-y-4">
                  <PlaybookWeekHeader
                    weekStart={nextMonday}
                    selectedDayIndex={selectedDayIndex}
                    onSelectDay={setSelectedDayIndex}
                    onPrevWeek={() => {}}
                    onNextWeek={() => {}}
                    weeklyPoints={0}
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

                <div className="border-l pl-4">
                  <PlaybookBenchPanel
                    items={benchItems}
                    onSchedule={(id) => setScheduleItemId(id)}
                    onDelete={(id) => deleteItem.mutate(id)}
                    onCreateNew={() => setShowCreateDialog(true)}
                  />
                </div>
              </div>
            </div>

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
                weekStart={nextMonday}
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
          </DndContext>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-white/60 hover:text-white hover:bg-white/10 rounded-full"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={handleNext}
          className="bg-white text-[#020817] hover:bg-white/90 rounded-full px-6"
        >
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
