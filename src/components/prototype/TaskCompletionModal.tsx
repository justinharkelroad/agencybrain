import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Phone, CheckCircle2 } from "lucide-react";
import { OnboardingTask } from "./TaskCard";

interface TaskCompletionModalProps {
  task: OnboardingTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (taskId: string, notes: string) => void;
}

export function TaskCompletionModal({
  task,
  open,
  onOpenChange,
  onConfirm,
}: TaskCompletionModalProps) {
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const requiresNotes = task?.actionType === 'call';
  const minNotesLength = 10; // Minimum characters for call notes

  const handleConfirm = () => {
    if (requiresNotes && notes.trim().length < minNotesLength) {
      setError(`Please enter at least ${minNotesLength} characters describing the call outcome.`);
      return;
    }

    if (task) {
      onConfirm(task.id, notes.trim());
      setNotes('');
      setError('');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setNotes('');
      setError('');
    }
    onOpenChange(newOpen);
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            Complete Task
          </DialogTitle>
          <DialogDescription>
            {requiresNotes
              ? "Call tasks require completion notes. Please describe the outcome of the call."
              : "Add optional notes about this task completion."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Task Summary */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              {task.actionType === 'call' && <Phone className="w-4 h-4 text-green-500" />}
              {task.title}
            </div>
            <div className="text-xs text-muted-foreground">
              {task.customerName} • {task.sequenceName}
            </div>
          </div>

          {/* Notes Input */}
          <div className="space-y-2">
            <Label htmlFor="completion-notes">
              Completion Notes {requiresNotes && <span className="text-red-500">*</span>}
            </Label>
            <Textarea
              id="completion-notes"
              placeholder={
                requiresNotes
                  ? "Describe the call outcome, customer response, next steps discussed..."
                  : "Optional notes about this task..."
              }
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setError('');
              }}
              className="min-h-[100px]"
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            {requiresNotes && (
              <p className="text-xs text-muted-foreground">
                {notes.length} / {minNotesLength} minimum characters
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Mark Complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
