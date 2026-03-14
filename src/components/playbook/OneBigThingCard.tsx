import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Target, X, Dumbbell, Heart, Briefcase } from "lucide-react";
import { LatinCross } from "@/components/icons/LatinCross";
import { CompleteOneBigThingDialog } from "./CompleteOneBigThingDialog";
import type { PlaybookDomain } from "@/hooks/useFocusItems";

interface OneBigThingItem {
  id: string;
  title: string;
  description?: string | null;
  domain?: PlaybookDomain | null;
  completed: boolean;
  completion_proof?: string | null;
  completion_feeling?: string | null;
}

interface OneBigThingCardProps {
  item: OneBigThingItem | null;
  onComplete: (id: string, proof: string, feeling: string) => void;
  onUncomplete: (id: string) => void;
  onClear: (id: string) => void;
  readOnly?: boolean;
}

const domainConfig: Record<string, { label: string; icon: React.ElementType; color: string; border: string }> = {
  body: { label: "BODY", icon: Dumbbell, color: "text-emerald-600", border: "border-emerald-500/30" },
  being: { label: "BEING", icon: LatinCross, color: "text-purple-600", border: "border-purple-500/30" },
  balance: { label: "BALANCE", icon: Heart, color: "text-rose-600", border: "border-rose-500/30" },
  business: { label: "BIZ", icon: Briefcase, color: "text-blue-600", border: "border-blue-500/30" },
};

export function OneBigThingCard({ item, onComplete, onUncomplete, onClear, readOnly }: OneBigThingCardProps) {
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);

  // Only register droppable when the slot is empty and not readOnly
  const canDrop = !item && !readOnly;
  const { setNodeRef, isOver } = useDroppable({
    id: "one-big-thing-drop",
    data: { type: "one_big_thing" },
    disabled: !canDrop,
  });

  const dc = item?.domain ? domainConfig[item.domain] : null;
  const DomainIcon = dc?.icon;

  // Empty state — drop zone
  if (!item) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          "relative rounded-xl border-2 border-dashed p-6 text-center transition-all",
          readOnly
            ? "border-border/40 bg-muted/10 opacity-60"
            : isOver
              ? "border-emerald-500 bg-emerald-500/10 scale-[1.01]"
              : "border-border/60 bg-muted/20"
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <Target className="h-8 w-8 text-muted-foreground/50" />
          <div>
            <p className="text-sm font-semibold text-muted-foreground">The One Big Thing</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              {readOnly ? "No One Big Thing was set for this week" : "Drag your most important action for this week here"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Completed state — celebration
  if (item.completed) {
    return (
      <div className="relative rounded-xl border-2 border-emerald-500/40 bg-emerald-500/5 p-5 transition-all">
        {/* Undo button */}
        {!readOnly && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onUncomplete(item.id)}
            title="Mark incomplete"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        <div className="flex items-start gap-4">
          {/* Big green check */}
          <div className="shrink-0 h-14 w-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 className="h-9 w-9 text-emerald-500" />
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                One Big Thing — Done
              </p>
              {dc && DomainIcon && (
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5 gap-1 border", dc.border, dc.color)}>
                  <DomainIcon className="h-3 w-3" />
                  {dc.label}
                </Badge>
              )}
            </div>
            <p className="text-sm font-semibold line-through text-muted-foreground">{item.title}</p>

            {item.completion_proof && (
              <div className="mt-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/70">How it got done: </span>
                {item.completion_proof}
              </div>
            )}
            {item.completion_feeling && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground/70">How it feels: </span>
                {item.completion_feeling}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Active state — show item with prominent complete button
  return (
    <>
      <div
        className={cn(
          "relative rounded-xl border-2 p-5 transition-all",
          "border-primary/30 bg-card"
        )}
      >
        {/* Remove button */}
        {!readOnly && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onClear(item.id)}
            title="Remove from One Big Thing"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        <div className="flex items-start gap-4">
          {/* Target icon */}
          <div className="shrink-0 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Target className="h-8 w-8 text-primary" />
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                The One Big Thing
              </p>
              {dc && DomainIcon && (
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5 gap-1 border", dc.border, dc.color)}>
                  <DomainIcon className="h-3 w-3" />
                  {dc.label}
                </Badge>
              )}
            </div>
            <p className="text-base font-semibold">{item.title}</p>
            {item.description && (
              <p className="text-xs text-muted-foreground">{item.description}</p>
            )}

            {!readOnly && (
              <Button
                size="sm"
                className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setShowCompleteDialog(true)}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            )}
          </div>
        </div>
      </div>

      <CompleteOneBigThingDialog
        open={showCompleteDialog}
        onOpenChange={setShowCompleteDialog}
        itemTitle={item.title}
        onConfirm={(proof, feeling) => {
          onComplete(item.id, proof, feeling);
          setShowCompleteDialog(false);
        }}
      />
    </>
  );
}
