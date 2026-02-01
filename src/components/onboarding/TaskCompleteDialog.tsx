import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Phone, MessageSquare, Mail, MoreHorizontal } from 'lucide-react';
import type { ActionType } from '@/hooks/useOnboardingTasks';

interface TaskCompleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskTitle: string;
  customerName: string;
  actionType: ActionType;
  onComplete: (taskId: string, notes?: string) => Promise<void>;
}

const ACTION_ICONS: Record<ActionType, React.ElementType> = {
  call: Phone,
  text: MessageSquare,
  email: Mail,
  other: MoreHorizontal,
};

const ACTION_LABELS: Record<ActionType, string> = {
  call: 'Call',
  text: 'Text',
  email: 'Email',
  other: 'Task',
};

export function TaskCompleteDialog({
  open,
  onOpenChange,
  taskId,
  taskTitle,
  customerName,
  actionType,
  onComplete,
}: TaskCompleteDialogProps) {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ActionIcon = ACTION_ICONS[actionType] || MoreHorizontal;
  const actionLabel = ACTION_LABELS[actionType] || 'Task';

  // Notes are required for call tasks
  const notesRequired = actionType === 'call';
  const canSubmit = !notesRequired || notes.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onComplete(taskId, notes.trim() || undefined);
      setNotes('');
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ActionIcon className="h-5 w-5" />
            Complete {actionLabel}
          </DialogTitle>
          <DialogDescription>
            {taskTitle} for <strong>{customerName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="notes">
              {notesRequired ? 'Notes (required for calls)' : 'Notes (optional)'}
            </Label>
            <Textarea
              id="notes"
              placeholder={
                actionType === 'call'
                  ? "What was discussed? Any follow-up needed?"
                  : "Add any notes about this task..."
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="resize-none"
            />
            {notesRequired && notes.trim().length === 0 && (
              <p className="text-xs text-muted-foreground">
                Please add notes before completing this call task.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Completing...
              </>
            ) : (
              'Complete Task'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
