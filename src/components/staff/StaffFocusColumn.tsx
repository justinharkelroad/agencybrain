import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { StaffFocusItemCard } from "./StaffFocusItemCard";
import type { StaffFocusItem, ColumnStatus } from "@/hooks/useStaffFocusItems";

interface StaffFocusColumnProps {
  id: ColumnStatus;
  title: string;
  items: StaffFocusItem[];
  onEdit: (item: StaffFocusItem) => void;
  onDelete: (id: string) => void;
}

export function StaffFocusColumn({ id, title, items, onEdit, onDelete }: StaffFocusColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex flex-col h-full">
      <div className="glass-surface rounded-t-xl p-4 border-b border-border/50">
        <h3 className="font-semibold text-foreground">
          {title}
          <span className="ml-2 text-sm text-muted-foreground">({items.length})</span>
        </h3>
      </div>

      <div
        ref={setNodeRef}
        className={`
          flex-1 glass-surface rounded-b-xl p-4 min-h-[400px] max-h-[calc(100vh-300px)] overflow-y-auto
          transition-all duration-300
          ${isOver ? "bg-primary/10 border-2 border-primary" : "border border-border/30"}
        `}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Drop items here
            </div>
          ) : (
            items.map((item) => (
              <StaffFocusItemCard
                key={item.id}
                item={item}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
