import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { ContactSearchInput } from '@/components/contacts/ContactSearchInput';
import {
  Loader2,
  Phone,
  MessageSquare,
  Mail,
  MoreHorizontal,
  CalendarIcon,
  User,
  X,
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Contact } from '@/types/contact';

type ActionType = 'call' | 'text' | 'email' | 'other';

export interface ScheduleTaskDialogContact {
  id: string;
  firstName: string;
  lastName: string;
  phones: string[];
  emails: string[];
}

const ACTION_LABELS: Record<ActionType, string> = {
  call: 'Call',
  text: 'Text',
  email: 'Email',
  other: 'Task',
};

const QUICK_DATE_OPTIONS = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: '+2 days', days: 2 },
  { label: '+1 week', days: 7 },
];

interface ScheduleTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string | null;
  initialContact?: ScheduleTaskDialogContact | null;
  lockContact?: boolean;
  defaultActionType?: ActionType;
  defaultTitle?: string;
  defaultDescription?: string;
  onSchedule: (data: {
    contactId: string;
    contactName: string;
    dueDate: string;
    actionType: ActionType;
    title: string;
    description?: string;
  }) => Promise<void>;
}

export function ScheduleTaskDialog({
  open,
  onOpenChange,
  agencyId,
  initialContact = null,
  lockContact = false,
  defaultActionType = 'call',
  defaultTitle = '',
  defaultDescription = '',
  onSchedule,
}: ScheduleTaskDialogProps) {
  const [selectedContact, setSelectedContact] = useState<ScheduleTaskDialogContact | null>(initialContact);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [actionType, setActionType] = useState<ActionType>(defaultActionType);
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = selectedContact && dueDate && title.trim().length > 0;

  const buildDefaultTitle = (type: ActionType) => defaultTitle || `${ACTION_LABELS[type]} follow-up`;

  const toDialogContact = (contact: Contact): ScheduleTaskDialogContact => ({
    id: contact.id,
    firstName: contact.first_name || '',
    lastName: contact.last_name || '',
    phones: contact.phones || [],
    emails: contact.emails || [],
  });

  const resetForm = useCallback(() => {
    setSelectedContact(initialContact);
    setDueDate(undefined);
    setActionType(defaultActionType);
    setTitle(defaultTitle);
    setDescription(defaultDescription);
    setCalendarOpen(false);
    setSubmitError(null);
  }, [initialContact, defaultActionType, defaultTitle, defaultDescription]);

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, resetForm]);

  const handleQuickDate = (days: number) => {
    const date = addDays(new Date(), days);
    setDueDate(date);
    // Auto-generate title if empty
    if (!title) {
      setTitle(buildDefaultTitle(actionType));
    }
  };

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(toDialogContact(contact));
    // Auto-generate title if empty
    if (!title) {
      setTitle(buildDefaultTitle(actionType));
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting || !selectedContact || !dueDate) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const contactName = `${selectedContact.firstName || ''} ${selectedContact.lastName || ''}`.trim() || 'Unknown';
      await onSchedule({
        contactId: selectedContact.id,
        contactName,
        dueDate: format(dueDate, 'yyyy-MM-dd'),
        actionType,
        title: title.trim(),
        description: description.trim() || undefined,
      });

      // Reset form
      resetForm();
      onOpenChange(false);
    } catch (err) {
      console.error('[ScheduleTaskDialog] Failed to schedule:', err);
      setSubmitError(err instanceof Error ? err.message : 'Failed to schedule task. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule a Task</DialogTitle>
          <DialogDescription>
            Create a one-off task for a contact in your agency.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Contact Search */}
          <div className="space-y-2">
            <Label>Contact</Label>
            {selectedContact ? (
              <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/30">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">
                    {selectedContact.firstName} {selectedContact.lastName}
                  </div>
                  {selectedContact.phones[0] && (
                    <div className="text-xs text-muted-foreground">
                      {selectedContact.phones[0]}
                    </div>
                  )}
                </div>
                {!lockContact && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setSelectedContact(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <ContactSearchInput
                agencyId={agencyId}
                onSelect={handleContactSelect}
                placeholder="Search for a contact..."
              />
            )}
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label>Due Date</Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_DATE_OPTIONS.map((option) => (
                <Button
                  key={option.days}
                  type="button"
                  variant={
                    dueDate &&
                    format(addDays(new Date(), option.days), 'yyyy-MM-dd') ===
                      format(dueDate, 'yyyy-MM-dd')
                      ? 'default'
                      : 'outline'
                  }
                  size="sm"
                  className="h-8"
                  onClick={() => handleQuickDate(option.days)}
                >
                  {option.label}
                </Button>
              ))}
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'h-8 justify-start font-normal',
                      !dueDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                    {dueDate ? format(dueDate, 'MMM d, yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={(date) => {
                      setDueDate(date);
                      setCalendarOpen(false);
                      if (date && !title) {
                        setTitle(buildDefaultTitle(actionType));
                      }
                    }}
                    disabled={(date) =>
                      date < new Date(new Date().setHours(0, 0, 0, 0))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Task Type */}
          <div className="space-y-2">
            <Label>Task Type</Label>
            <Select
              value={actionType}
              onValueChange={(value: ActionType) => {
                setActionType(value);
                if (
                  title === '' ||
                  title === buildDefaultTitle(actionType) ||
                  title.endsWith('follow-up')
                ) {
                  setTitle(buildDefaultTitle(value));
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Call
                  </div>
                </SelectItem>
                <SelectItem value="text">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Text
                  </div>
                </SelectItem>
                <SelectItem value="email">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </div>
                </SelectItem>
                <SelectItem value="other">
                  <div className="flex items-center gap-2">
                    <MoreHorizontal className="h-4 w-4" />
                    Other
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label>Task Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Follow-up call about quote"
            />
          </div>

          {/* Description (optional) */}
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any notes or context..."
              rows={2}
              className="resize-none"
            />
          </div>
        </div>

        {submitError && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-sm text-destructive">{submitError}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Scheduling...
              </>
            ) : (
              'Schedule Task'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
