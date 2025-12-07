import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Target } from "lucide-react";
import { FocusColumn } from "@/components/focus/FocusColumn";
import { FocusItemCard } from "@/components/focus/FocusItemCard";
import { AdminCreateFocusItemDialog } from "@/components/focus/AdminCreateFocusItemDialog";
import { EditFocusItemDialog } from "@/components/focus/EditFocusItemDialog";
import { useAdminFocusItems, type AdminFocusItem } from "@/hooks/useAdminFocusItems";
import type { ColumnStatus, FocusItem } from "@/hooks/useFocusItems";

const columns: { id: ColumnStatus; title: string }[] = [
  { id: "backlog", title: "Focus Items Backlog" },
  { id: "week1", title: "Within 1 Week" },
  { id: "week2", title: "Within 2 Weeks" },
  { id: "next_call", title: "Before Next Booked Call" },
  { id: "completed", title: "COMPLETED" },
];

interface ClientProfile {
  id: string;
  agency: {
    name: string;
  } | null;
}

export default function AdminFocusManagement() {
  const { user, isAdmin } = useAuth();
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<FocusItem | null>(null);

  const { items, isLoading, createItem, updateItem, deleteItem, moveItem } = useAdminFocusItems(
    selectedClientId || undefined
  );

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

  useEffect(() => {
    if (user && isAdmin) {
      fetchClients();
    }
  }, [user, isAdmin]);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id,
        agency:agencies(name)
      `)
      .neq("role", "admin")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching clients:", error);
      return;
    }

    setClients((data || []) as ClientProfile[]);
    if (data && data.length > 0 && !selectedClientId) {
      setSelectedClientId(data[0].id);
    }
  };

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
      const targetItems = getItemsByColumn(overColumn.id);
      moveItem.mutate({
        id: activeItem.id,
        column_status: overColumn.id,
        column_order: targetItems.length,
      });
    } else {
      const overItem = items.find((item) => item.id === overId);
      if (!overItem) return;

      if (activeItem.column_status !== overItem.column_status) {
        const targetItems = getItemsByColumn(overItem.column_status);
        const overIndex = targetItems.findIndex((item) => item.id === overId);
        moveItem.mutate({
          id: activeItem.id,
          column_status: overItem.column_status,
          column_order: overIndex,
        });
      } else {
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
  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const selectedClientName = selectedClient?.agency?.name || "Unknown Client";

  if (!user || !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <main className="container mx-auto px-4 py-8">
        <Card className="glass-surface">
          <CardHeader className="border-b border-border/50">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Client Focus Management
                </CardTitle>
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="flex-1 w-full md:w-auto">
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger className="w-full md:w-[300px]">
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.agency?.name || "Unknown Agency"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedClientId && (
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <span className="text-sm text-muted-foreground">
                      Managing: <strong className="text-foreground">{selectedClientName}</strong>
                    </span>
                    <Button onClick={() => setCreateDialogOpen(true)} className="gap-2 ml-auto">
                      <Plus className="h-4 w-4" />
                      Add Focus Item
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {!selectedClientId ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                Select a client to manage their focus board
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                Loading...
              </div>
            ) : (
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
            )}
          </CardContent>
        </Card>
      </main>

      {selectedClientId && (
        <>
          <AdminCreateFocusItemDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            targetUserName={selectedClientName}
            onCreate={(data) =>
              createItem.mutate({
                ...data,
                target_user_id: selectedClientId,
              })
            }
          />

          <EditFocusItemDialog
            item={editItem}
            open={!!editItem}
            onOpenChange={(open) => !open && setEditItem(null)}
            onUpdate={(id, data) => updateItem.mutate({ id, updates: data })}
          />
        </>
      )}
    </>
  );
}
