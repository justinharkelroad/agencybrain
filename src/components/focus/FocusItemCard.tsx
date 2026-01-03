import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, CheckCircle2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { parseDateLocal } from "@/lib/utils";
import type { FocusItem } from "@/hooks/useFocusItems";

interface FocusItemCardProps {
  item: FocusItem;
  onEdit: (item: FocusItem) => void;
  onDelete: (id: string) => void;
}

const priorityConfig = {
  top: { label: "Top Level", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  mid: { label: "Mid Level", color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  low: { label: "Low Level", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
};

export function FocusItemCard({ item, onEdit, onDelete }: FocusItemCardProps) {
  const isCompleted = item.column_status === "completed";
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: isCompleted,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priorityInfo = priorityConfig[item.priority_level];
  const createdDate = parseDateLocal(item.created_at) || new Date(item.created_at);
  const daysOld = formatDistanceToNow(createdDate, { addSuffix: true });

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        glass-surface rounded-lg p-4 mb-3 cursor-grab active:cursor-grabbing
        border transition-all duration-300
        ${isCompleted 
          ? "bg-emerald-500/10 border-emerald-500/30" 
          : "border-border/50 hover:border-primary/50"
        }
        ${isDragging ? "ring-2 ring-primary/50" : ""}
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1">
          <h4 className="font-semibold text-foreground leading-tight mb-1">
            {item.title}
          </h4>
          {item.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {item.description}
            </p>
          )}
        </div>
        {isCompleted && (
          <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
        )}
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {item.source_type === "flow" && item.source_name && (
            <Badge variant="secondary" className="text-xs bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
              📝 {item.source_name}
            </Badge>
          )}
          <Badge variant="outline" className={priorityInfo.color}>
            {priorityInfo.label}
          </Badge>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{daysOld}</span>
        </div>
      </div>

      {isCompleted && item.completed_at && (
        <div className="mt-2 text-xs text-emerald-400">
          Completed {formatDistanceToNow(new Date(item.completed_at), { addSuffix: true })}
        </div>
      )}

      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/30">
        {!isCompleted && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item);
            }}
            className="h-7 px-2"
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          className="h-7 px-2 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
