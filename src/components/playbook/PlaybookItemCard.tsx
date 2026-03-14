import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Trash2, ArrowLeft, Sparkles, Dumbbell, Heart, Briefcase, GripVertical } from "lucide-react";
import { LatinCross } from "@/components/icons/LatinCross";
import { cn } from "@/lib/utils";
import { useDraggable } from "@dnd-kit/core";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PlaybookDomain } from "@/hooks/useFocusItems";

export interface PlaybookItemCardProps {
  id: string;
  title: string;
  description?: string | null;
  domain: PlaybookDomain | null;
  subTagName?: string | null;
  sourceType?: string | null;
  sourceName?: string | null;
  completed: boolean;
  onToggleComplete: (id: string) => void;
  onDelete?: (id: string) => void;
  onUnschedule?: (id: string) => void;
  readOnly?: boolean;
}

const domainConfig: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  body: { label: "BODY", icon: Dumbbell, color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-500/20" },
  being: { label: "BEING", icon: LatinCross, color: "text-purple-600", bg: "bg-purple-500/10 border-purple-500/20" },
  balance: { label: "BALANCE", icon: Heart, color: "text-rose-600", bg: "bg-rose-500/10 border-rose-500/20" },
  business: { label: "BIZ", icon: Briefcase, color: "text-blue-600", bg: "bg-blue-500/10 border-blue-500/20" },
};

export function PlaybookItemCard({
  id,
  title,
  description,
  domain,
  subTagName,
  sourceType,
  sourceName,
  completed,
  onToggleComplete,
  onDelete,
  onUnschedule,
  readOnly,
}: PlaybookItemCardProps) {
  const dc = domain ? domainConfig[domain] : null;
  const DomainIcon = dc?.icon;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `scheduled-${id}`,
    data: { itemId: id, title },
    disabled: readOnly || completed,
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-start gap-3 rounded-lg border p-3 transition-all",
        completed
          ? "bg-muted/30 border-border/50"
          : "bg-card border-border hover:shadow-sm",
        isDragging && "opacity-50 shadow-lg z-50"
      )}
    >
      {!readOnly && !completed && (
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none mt-0.5">
          <GripVertical className="h-4 w-4 text-muted-foreground/40" />
        </div>
      )}
      <Checkbox
        checked={completed}
        onCheckedChange={() => !readOnly && onToggleComplete(id)}
        disabled={readOnly}
        className="mt-0.5"
      />

      <div className="flex-1 min-w-0 space-y-1">
        <p
          className={cn(
            "text-sm font-medium leading-tight",
            completed && "line-through text-muted-foreground"
          )}
        >
          {title}
        </p>

        {description && (
          <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          {dc && DomainIcon && (
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5 gap-1 border", dc.bg, dc.color)}>
              <DomainIcon className="h-3 w-3" />
              {dc.label}
            </Badge>
          )}
          {subTagName && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
              {subTagName}
            </Badge>
          )}
          {sourceType === "flow" && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-1 border-purple-500/20 bg-purple-500/10 text-purple-600">
              <Sparkles className="h-3 w-3" />
              {sourceName || "Flow"}
            </Badge>
          )}
        </div>
      </div>

      {!readOnly && (onDelete || onUnschedule) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onUnschedule && (
              <DropdownMenuItem onClick={() => onUnschedule(id)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Move to Bench
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem onClick={() => onDelete(id)} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
