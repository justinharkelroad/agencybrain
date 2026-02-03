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
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Loader2,
  Phone,
  MessageSquare,
  Mail,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  CalendarIcon,
  Plus,
} from 'lucide-react';
import { format, addDays, addWeeks } from 'date-fns';
import { cn } from '@/lib/utils';
import type { ActionType } from '@/hooks/useOnboardingTasks';

interface FollowUpData {
  dueDate: Date;
  actionType: ActionType;
  title: string;
}

interface TaskCompleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskTitle: string;
  customerName: string;
  actionType: ActionType;
  onComplete: (taskId: string, notes?: string, followUp?: FollowUpData) => Promise<void>;
  contactId?: string; // Required for follow-up scheduling
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

const QUICK_DATE_OPTIONS = [
  { label: 'Tomorrow', days: 1 },
  { label: '+2 days', days: 2 },
  { label: '+4 days', days: 4 },
  { label: '+1 week', days: 7 },
];

export function TaskCompleteDialog({
  open,
  onOpenChange,
  taskId,
  taskTitle,
  customerName,
  actionType,
  onComplete,
  contactId,
}: TaskCompleteDialogProps) {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Follow-up state
  const [followUpExpanded, setFollowUpExpanded] = useState(false);
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>(undefined);
  const [followUpActionType, setFollowUpActionType] = useState<ActionType>('call');
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);

  const ActionIcon = ACTION_ICONS[actionType] || MoreHorizontal;
  const actionLabel = ACTION_LABELS[actionType] || 'Task';

  // Notes are required for call tasks
  const notesRequired = actionType === 'call';
  const notesValid = !notesRequired || notes.trim().length > 0;

  // Follow-up validation: if expanded and date selected, title is required
  const followUpValid = !followUpExpanded || !followUpDate || followUpTitle.trim().length > 0;

  const canSubmit = notesValid && followUpValid;

  const handleQuickDate = (days: number) => {
    const date = addDays(new Date(), days);
    setFollowUpDate(date);
    // Auto-generate title if empty
    if (!followUpTitle) {
      setFollowUpTitle(`Follow-up ${ACTION_LABELS[followUpActionType].toLowerCase()}`);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Prepare follow-up data if scheduled
      const followUp = followUpExpanded && followUpDate && followUpTitle.trim()
        ? {
            dueDate: followUpDate,
            actionType: followUpActionType,
            title: followUpTitle.trim(),
          }
        : undefined;

      await onComplete(taskId, notes.trim() || undefined, followUp);

      // Reset state
      setNotes('');
      setFollowUpExpanded(false);
      setFollowUpDate(undefined);
      setFollowUpActionType('call');
      setFollowUpTitle('');
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setNotes('');
    setFollowUpExpanded(false);
    setFollowUpDate(undefined);
    setFollowUpActionType('call');
    setFollowUpTitle('');
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
              rows={3}
              className="resize-none"
            />
            {notesRequired && notes.trim().length === 0 && (
              <p className="text-xs text-muted-foreground">
                Please add notes before completing this call task.
              </p>
            )}
          </div>

          {/* Follow-up scheduling section - only show if we have contactId */}
          {contactId && (
            <Collapsible open={followUpExpanded} onOpenChange={setFollowUpExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 h-9 px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  {followUpExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Plus className="h-4 w-4" />
                  Schedule a follow-up?
                  {followUpDate && (
                    <span className="ml-auto text-xs text-primary font-normal">
                      {format(followUpDate, 'MMM d')}
                    </span>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-3">
                {/* Quick date buttons */}
                <div className="flex flex-wrap gap-2">
                  {QUICK_DATE_OPTIONS.map((option) => (
                    <Button
                      key={option.days}
                      type="button"
                      variant={followUpDate && format(addDays(new Date(), option.days), 'yyyy-MM-dd') === format(followUpDate, 'yyyy-MM-dd') ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleQuickDate(option.days)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>

                {/* Custom date picker */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Or pick a date:</span>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "h-8 text-xs justify-start font-normal",
                          !followUpDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                        {followUpDate ? format(followUpDate, 'MMM d, yyyy') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={followUpDate}
                        onSelect={(date) => {
                          setFollowUpDate(date);
                          setCalendarOpen(false);
                          // Auto-generate title if empty
                          if (date && !followUpTitle) {
                            setFollowUpTitle(`Follow-up ${ACTION_LABELS[followUpActionType].toLowerCase()}`);
                          }
                        }}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {followUpDate && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-muted-foreground"
                      onClick={() => {
                        setFollowUpDate(undefined);
                        setFollowUpTitle('');
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>

                {/* Task type and title - only show when date is selected */}
                {followUpDate && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-3">
                      <Label className="text-xs text-muted-foreground w-16 shrink-0">Type:</Label>
                      <Select
                        value={followUpActionType}
                        onValueChange={(value: ActionType) => {
                          setFollowUpActionType(value);
                          // Update title if it was auto-generated
                          if (followUpTitle.startsWith('Follow-up ')) {
                            setFollowUpTitle(`Follow-up ${ACTION_LABELS[value].toLowerCase()}`);
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="call">
                            <div className="flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5" />
                              Call
                            </div>
                          </SelectItem>
                          <SelectItem value="text">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-3.5 w-3.5" />
                              Text
                            </div>
                          </SelectItem>
                          <SelectItem value="email">
                            <div className="flex items-center gap-2">
                              <Mail className="h-3.5 w-3.5" />
                              Email
                            </div>
                          </SelectItem>
                          <SelectItem value="other">
                            <div className="flex items-center gap-2">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                              Other
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="text-xs text-muted-foreground w-16 shrink-0">Title:</Label>
                      <Input
                        value={followUpTitle}
                        onChange={(e) => setFollowUpTitle(e.target.value)}
                        placeholder="e.g., Follow-up call"
                        className="h-8 text-xs"
                      />
                    </div>
                    {followUpDate && !followUpTitle.trim() && (
                      <p className="text-xs text-destructive">
                        Please enter a title for the follow-up task.
                      </p>
                    )}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
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
