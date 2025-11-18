import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAvailableQuarters, formatQuarterDisplay, getCurrentQuarter } from "@/lib/quarterUtils";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

interface ChangeQuarterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentQuarter: string;
  hasUnsavedChanges?: boolean;
  onConfirm: (newQuarter: string) => void;
}

export function ChangeQuarterDialog({
  open,
  onOpenChange,
  currentQuarter,
  hasUnsavedChanges = false,
  onConfirm,
}: ChangeQuarterDialogProps) {
  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter);
  const availableQuarters = getAvailableQuarters();
  const currentActualQuarter = getCurrentQuarter();

  const handleConfirm = () => {
    if (selectedQuarter !== currentQuarter) {
      onConfirm(selectedQuarter);
    }
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Change Quarter
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            {hasUnsavedChanges ? (
              // Type A: Has unsaved changes (Quarterly page)
              <div className="text-sm space-y-2">
                <p className="font-medium text-foreground">⚠️ You have unsaved changes.</p>
                <p>Changing quarters will discard your current edits.</p>
                <p>Your saved targets, missions, and actions will be relabeled to the new quarter.</p>
              </div>
            ) : (
              // Type B: All saved (Missions, Daily, Cascade)
              <div className="text-sm space-y-2">
                <p>This will relabel your current plan to <strong>{formatQuarterDisplay(selectedQuarter)}</strong>.</p>
                <p>Your targets, missions, and actions will remain the same.</p>
                <p className="text-muted-foreground">Only the quarter label and month names will update.</p>
              </div>
            )}

            <div className="pt-4">
              <label className="text-sm font-medium text-foreground mb-2 block">
                Select New Quarter:
              </label>
              <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableQuarters.map((quarter) => (
                    <SelectItem key={quarter} value={quarter}>
                      {formatQuarterDisplay(quarter)}
                      {quarter === currentActualQuarter && " (Current)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            disabled={selectedQuarter === currentQuarter}
          >
            Change Quarter
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
