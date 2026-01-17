import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Phone, Mail, FileText, Calendar } from 'lucide-react';
import type {
  SourceModule,
  ContactActivityType,
  CallDirection,
} from '@/types/contact';
import { SOURCE_MODULE_CONFIGS } from '@/types/contact';

interface ActivityLogFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ActivityFormData) => void;
  defaultSourceModule: SourceModule;
  isLoading?: boolean;
  activityType?: 'call' | 'note' | 'email' | 'appointment';
}

export interface ActivityFormData {
  activityType: ContactActivityType;
  sourceModule: SourceModule;
  callDirection?: CallDirection;
  outcome?: string;
  subject?: string;
  notes?: string;
  scheduledDate?: string;
}

const ACTIVITY_TYPES = [
  { value: 'call', label: 'Phone Call', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'note', label: 'Note', icon: FileText },
  { value: 'appointment', label: 'Appointment', icon: Calendar },
] as const;

const CALL_OUTCOMES = [
  { value: 'answered', label: 'Answered - Spoke with Customer' },
  { value: 'left_voicemail', label: 'Left Voicemail' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'busy', label: 'Busy' },
  { value: 'wrong_number', label: 'Wrong Number' },
  { value: 'disconnected', label: 'Disconnected' },
];

export function ActivityLogForm({
  open,
  onClose,
  onSubmit,
  defaultSourceModule,
  isLoading = false,
  activityType: presetActivityType,
}: ActivityLogFormProps) {
  const [activityType, setActivityType] = useState<ContactActivityType>(
    presetActivityType || 'call'
  );
  const [sourceModule, setSourceModule] = useState<SourceModule>(defaultSourceModule);
  const [callDirection, setCallDirection] = useState<CallDirection>('outbound');
  const [outcome, setOutcome] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSubmit({
      activityType,
      sourceModule,
      callDirection: activityType === 'call' ? callDirection : undefined,
      outcome: activityType === 'call' ? outcome : undefined,
      subject: activityType !== 'call' ? subject : undefined,
      notes,
      scheduledDate: activityType === 'appointment' ? scheduledDate : undefined,
    });

    // Reset form
    setOutcome('');
    setSubject('');
    setNotes('');
    setScheduledDate('');
  };

  const handleClose = () => {
    setOutcome('');
    setSubject('');
    setNotes('');
    setScheduledDate('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Log Activity</DialogTitle>
          <DialogDescription>
            Record an interaction with this contact
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Activity Type */}
          {!presetActivityType && (
            <div className="space-y-2">
              <Label>Activity Type</Label>
              <div className="grid grid-cols-4 gap-2">
                {ACTIVITY_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <Button
                      key={type.value}
                      type="button"
                      variant={activityType === type.value ? 'default' : 'outline'}
                      className="flex flex-col items-center gap-1 h-auto py-3"
                      onClick={() => setActivityType(type.value as ContactActivityType)}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs">{type.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Related To (Source Module) */}
          <div className="space-y-2">
            <Label htmlFor="sourceModule">Related To</Label>
            <Select
              value={sourceModule}
              onValueChange={(value) => setSourceModule(value as SourceModule)}
            >
              <SelectTrigger id="sourceModule">
                <SelectValue placeholder="Select context" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(SOURCE_MODULE_CONFIGS)
                  .filter(config => config.key !== 'phone_system' && config.key !== 'call_scoring')
                  .map((config) => (
                    <SelectItem key={config.key} value={config.key}>
                      <span className="flex items-center gap-2">
                        <span>{config.icon}</span>
                        <span>{config.label}</span>
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Call-specific fields */}
          {activityType === 'call' && (
            <>
              <div className="space-y-2">
                <Label>Call Direction</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={callDirection === 'outbound' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setCallDirection('outbound')}
                  >
                    Outbound
                  </Button>
                  <Button
                    type="button"
                    variant={callDirection === 'inbound' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setCallDirection('inbound')}
                  >
                    Inbound
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="outcome">Outcome</Label>
                <Select value={outcome} onValueChange={setOutcome}>
                  <SelectTrigger id="outcome">
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    {CALL_OUTCOMES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Subject field for non-call activities */}
          {activityType !== 'call' && (
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={
                  activityType === 'email'
                    ? 'Email subject'
                    : activityType === 'appointment'
                    ? 'Appointment purpose'
                    : 'Note title'
                }
              />
            </div>
          )}

          {/* Scheduled date for appointments */}
          {activityType === 'appointment' && (
            <div className="space-y-2">
              <Label htmlFor="scheduledDate">Scheduled Date & Time</Label>
              <Input
                id="scheduledDate"
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add details about this interaction..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Log Activity'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ActivityLogForm;
