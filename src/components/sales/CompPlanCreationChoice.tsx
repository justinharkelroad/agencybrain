import { MessageSquare, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface CompPlanCreationChoiceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChooseManual: () => void;
  onChooseAI: () => void;
}

export function CompPlanCreationChoice({
  open,
  onOpenChange,
  onChooseManual,
  onChooseAI,
}: CompPlanCreationChoiceProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>How would you like to create your plan?</DialogTitle>
          <DialogDescription>
            Choose how you want to set up your compensation plan
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          {/* AI Assistant Option */}
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onChooseAI();
            }}
            className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-transparent bg-muted/50 hover:bg-muted hover:border-primary/50 transition-all text-left group"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">AI Assistant</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Describe what you want or upload your existing comp plan document
              </p>
            </div>
            <span className="text-xs text-muted-foreground mt-2">
              Best if you have a doc or want guidance
            </span>
          </button>

          {/* Manual Builder Option */}
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onChooseManual();
            }}
            className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-transparent bg-muted/50 hover:bg-muted hover:border-primary/50 transition-all text-left group"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">Manual Builder</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Configure each setting step by step using our form
              </p>
            </div>
            <span className="text-xs text-muted-foreground mt-2">
              Best if you know exactly what you want
            </span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
