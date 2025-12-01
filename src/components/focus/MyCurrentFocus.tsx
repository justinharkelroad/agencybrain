import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Target } from "lucide-react";
import { FocusColumn } from "./FocusColumn";
import { FocusItemCard } from "./FocusItemCard";
import { CreateFocusItemDialog } from "./CreateFocusItemDialog";
import { EditFocusItemDialog } from "./EditFocusItemDialog";
import { useFocusItems, type FocusItem, type ColumnStatus } from "@/hooks/useFocusItems";

const columns: { id: ColumnStatus; title: string }[] = [
  { id: "backlog", title: "Focus List" },
  { id: "week1", title: "Within 1 Week" },
  { id: "week2", title: "Within 2 Weeks" },
  { id: "next_call", title: "Before Next Booked Call" },
  { id: "completed", title: "COMPLETED" },
];

export function MyCurrentFocus() {
  const { items, isLoading, createItem, updateItem, deleteItem, moveItem } = useFocusItems();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<FocusItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getItemsByColumn = (columnId: ColumnStatus) => {
    return items.filter((item) => item.column_status === columnId);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeItem = items.find((item) => item.id === active.id);
    if (!activeItem) return;

    const overId = over.id as string;
    const overColumn = columns.find((col) => col.id === overId);

    if (overColumn) {
      // Dropped onto a column
      const targetItems = getItemsByColumn(overColumn.id);
      moveItem.mutate({
        id: activeItem.id,
        column_status: overColumn.id,
        column_order: targetItems.length,
      });
    } else {
      // Dropped onto another item
      const overItem = items.find((item) => item.id === overId);
      if (!overItem) return;

      if (activeItem.column_status !== overItem.column_status) {
        // Moving to different column
        const targetItems = getItemsByColumn(overItem.column_status);
        const overIndex = targetItems.findIndex((item) => item.id === overId);
        moveItem.mutate({
          id: activeItem.id,
          column_status: overItem.column_status,
          column_order: overIndex,
        });
      } else {
        // Reordering within same column
        const columnItems = getItemsByColumn(activeItem.column_status);
        const oldIndex = columnItems.findIndex((item) => item.id === active.id);
        const newIndex = columnItems.findIndex((item) => item.id === overId);

        if (oldIndex !== newIndex) {
          const reordered = arrayMove(columnItems, oldIndex, newIndex);
          reordered.forEach((item, index) => {
            if (item.column_order !== index) {
              moveItem.mutate({
                id: item.id,
                column_status: item.column_status,
                column_order: index,
              });
            }
          });
        }
      }
    }
  };

  const activeItem = activeId ? items.find((item) => item.id === activeId) : null;

  if (isLoading) {
    return (
      <Card className="glass-surface elevate">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Focus Targets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass-surface elevate">
        <CardHeader className="border-b border-border/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Focus Targets
            </CardTitle>
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              New Focus Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {columns.map((column) => (
                <FocusColumn
                  key={column.id}
                  id={column.id}
                  title={column.title}
                  items={getItemsByColumn(column.id)}
                  onEdit={setEditItem}
                  onDelete={(id) => {
                    if (confirm("Are you sure you want to delete this focus item?")) {
                      deleteItem.mutate(id);
                    }
                  }}
                />
              ))}
            </div>

            <DragOverlay>
              {activeItem && (
                <div className="cursor-grabbing">
                  <FocusItemCard
                    item={activeItem}
                    onEdit={() => {}}
                    onDelete={() => {}}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </CardContent>
      </Card>

      <CreateFocusItemDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={(data) => createItem.mutate(data)}
      />

      <EditFocusItemDialog
        item={editItem}
        open={!!editItem}
        onOpenChange={(open) => !open && setEditItem(null)}
        onUpdate={(id, data) => updateItem.mutate({ id, updates: data })}
      />
    </>
  );
}
