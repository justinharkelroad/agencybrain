import { Button } from '@/components/ui/button';
import { X, Loader2 } from 'lucide-react';

export type RecordStatus = 'new' | 'in_progress' | 'resolved' | 'lost';

interface BulkActionsProps {
  selectedRecordIds: string[];
  onClearSelection: () => void;
  onStatusUpdate: (status: RecordStatus) => void;
  isUpdating: boolean;
}

export function BulkActions({ 
  selectedRecordIds, 
  onClearSelection, 
  onStatusUpdate, 
  isUpdating 
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
          disabled={isUpdating}
        >
          {isUpdating && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
          Mark In Progress
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onStatusUpdate('resolved')}
          disabled={isUpdating}
          className="text-green-500 hover:text-green-400"
        >
          Mark Resolved
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onStatusUpdate('lost')}
          disabled={isUpdating}
          className="text-red-500 hover:text-red-400"
        >
          Mark Lost
        </Button>
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
