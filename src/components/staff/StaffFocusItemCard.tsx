import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, GripVertical, CheckCircle2 } from "lucide-react";
import { parseDateLocal } from "@/lib/utils";
import type { StaffFocusItem } from "@/hooks/useStaffFocusItems";

const priorityConfig = {
  top: { label: "High", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  mid: { label: "Medium", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  low: { label: "Low", className: "bg-green-500/20 text-green-400 border-green-500/30" },
};

interface StaffFocusItemCardProps {
  item: StaffFocusItem;
  onEdit: (item: StaffFocusItem) => void;
  onDelete: (id: string) => void;
}

export function StaffFocusItemCard({ item, onEdit, onDelete }: StaffFocusItemCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: item.column_status === "completed",
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priority = priorityConfig[item.priority_level];
  const isCompleted = item.column_status === "completed";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group bg-card border border-border/50 rounded-lg p-3 mb-2 
        hover:border-border transition-colors
        ${isCompleted ? "opacity-60" : ""}
      `}
    >
      <div className="flex items-start gap-2">
        {!isCompleted && (
          <button
            {...attributes}
            {...listeners}
            className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        {isCompleted && (
          <CheckCircle2 className="h-4 w-4 mt-1 text-green-500" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-medium text-sm ${isCompleted ? "line-through" : ""}`}>
              {item.title}
            </span>
            <Badge variant="outline" className={`text-xs ${priority.className}`}>
              {priority.label}
            </Badge>
          </div>

          {item.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {item.description}
            </p>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground/70">
              {formatDistanceToNow(parseDateLocal(item.created_at) || new Date(item.created_at), { addSuffix: true })}
            </span>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onEdit(item)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
