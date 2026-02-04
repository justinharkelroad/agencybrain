import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Edit, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface OverlappingPeriod {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface DuplicatePeriodWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overlappingPeriod: OverlappingPeriod | null;
  isExactMatch: boolean;
  onEditExisting: () => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

export function DuplicatePeriodWarningDialog({
  open,
  onOpenChange,
  overlappingPeriod,
  isExactMatch,
  onEditExisting,
  onCreateNew,
  onCancel,
}: DuplicatePeriodWarningDialogProps) {
  // Don't render if not open or no overlapping period data
  if (!open || !overlappingPeriod) return null;

  const periodDateRange = `${format(parseISO(overlappingPeriod.start_date), 'MMM d')} - ${format(parseISO(overlappingPeriod.end_date), 'MMM d, yyyy')}`;
  const periodTitle = overlappingPeriod.title || periodDateRange;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </div>
          <AlertDialogTitle className="text-center">
            {isExactMatch ? 'Duplicate Period Detected' : 'Overlapping Period Detected'}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {isExactMatch ? (
              <>
                You already have a submission for <strong>{periodTitle}</strong> ({periodDateRange}).
                <br /><br />
                Would you like to edit your existing submission or create a new one?
              </>
            ) : (
              <>
                Your selected dates overlap with an existing period: <strong>{periodTitle}</strong> ({periodDateRange}).
                <br /><br />
                This may create confusing data in your dashboard. Would you like to edit the existing period instead?
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <AlertDialogCancel onClick={onCancel}>
            Cancel
          </AlertDialogCancel>
          <Button
            variant="outline"
            onClick={onEditExisting}
            className="border-amber-500 text-amber-600 hover:bg-amber-500/20"
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit Existing Period
          </Button>
          <AlertDialogAction onClick={onCreateNew}>
            <Plus className="mr-2 h-4 w-4" />
            Create New Period Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
