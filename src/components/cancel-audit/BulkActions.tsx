import { Button } from '@/components/ui/button';
import { X, Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export type RecordStatus = 'new' | 'in_progress' | 'resolved' | 'lost';

interface BulkActionsProps {
  selectedRecordIds: string[];
  onClearSelection: () => void;
  onStatusUpdate: (status: RecordStatus) => void;
  onDelete?: () => void;
  isUpdating: boolean;
  isDeleting?: boolean;
}

export function BulkActions({ 
  selectedRecordIds, 
  onClearSelection, 
  onStatusUpdate,
  onDelete,
  isUpdating,
  isDeleting = false, 
}: BulkActionsProps) {
  if (selectedRecordIds.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border border-border shadow-lg rounded-lg px-4 py-3">
      <span className="text-sm font-medium text-foreground">
        {selectedRecordIds.length} selected
      </span>
      
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onStatusUpdate('in_progress')}
          disabled={isUpdating || isDeleting}
        >
          {isUpdating && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
          Mark In Progress
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onStatusUpdate('resolved')}
          disabled={isUpdating || isDeleting}
          className="text-green-500 hover:text-green-400"
        >
          Mark Resolved
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onStatusUpdate('lost')}
          disabled={isUpdating || isDeleting}
          className="text-red-500 hover:text-red-400"
        >
          Mark Lost
        </Button>
        
        {onDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="destructive"
                disabled={isUpdating || isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-3 w-3 mr-1" />
                )}
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {selectedRecordIds.length} record{selectedRecordIds.length > 1 ? 's' : ''}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the selected records and all associated activities. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Button 
        size="sm" 
        variant="ghost" 
        onClick={onClearSelection}
        className="ml-2"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
