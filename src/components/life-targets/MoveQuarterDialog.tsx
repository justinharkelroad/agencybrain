import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAvailableQuarters, formatQuarterDisplay } from "@/lib/quarterUtils";

interface MoveQuarterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentQuarter: string;
  onConfirm: (newQuarter: string) => void;
  isPending?: boolean;
}

export function MoveQuarterDialog({
  open,
  onOpenChange,
  currentQuarter,
  onConfirm,
  isPending = false,
}: MoveQuarterDialogProps) {
  const [selectedQuarter, setSelectedQuarter] = useState<string>("");
  const availableQuarters = getAvailableQuarters().filter(q => q !== currentQuarter);

  const handleConfirm = () => {
    if (selectedQuarter) {
      onConfirm(selectedQuarter);
      setSelectedQuarter("");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Move to Different Quarter?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              This will relabel your completed plan from {formatQuarterDisplay(currentQuarter)} to 
              the quarter you select below.
            </p>
            <p className="text-sm">
              All your targets, missions, and daily actions will be preserved. This is useful if you 
              completed the work in the wrong quarter.
            </p>
            <div className="pt-2">
              <label className="text-sm font-medium text-foreground mb-2 block">
                Select target quarter:
              </label>
              <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a quarter..." />
                </SelectTrigger>
                <SelectContent>
                  {availableQuarters.map((quarter) => (
                    <SelectItem key={quarter} value={quarter}>
                      {formatQuarterDisplay(quarter)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!selectedQuarter || isPending}
          >
            {isPending ? 'Moving...' : 'Move Plan'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
