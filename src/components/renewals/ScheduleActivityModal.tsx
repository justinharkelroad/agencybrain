import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useCreateRenewalActivity } from '@/hooks/useRenewalActivities';
import type { RenewalRecord, RenewalUploadContext, ActivityType, WorkflowStatus } from '@/types/renewal';
import { cn } from '@/lib/utils';

interface Props { open: boolean; onClose: () => void; record: RenewalRecord; context: RenewalUploadContext; teamMembers: Array<{ id: string; name: string }>; }

const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: 'phone_call', label: 'Phone Call' }, { value: 'appointment', label: 'Appointment' },
  { value: 'email', label: 'Email' }, { value: 'note', label: 'Note' }, { value: 'status_change', label: 'Status Change' },
];
const STATUS_UPDATES: { value: string; label: string; status?: WorkflowStatus }[] = [
  { value: 'none', label: 'No Status Change' },
  { value: 'activity_complete_success', label: 'Complete - Success', status: 'success' },
  { value: 'activity_complete_unsuccessful', label: 'Complete - Unsuccessful', status: 'unsuccessful' },
  { value: 'appointment_scheduled', label: 'Appointment Scheduled', status: 'pending' },
  { value: 'called_left_message', label: 'Called Left Message', status: 'pending' },
  { value: 'called_no_answer', label: 'Called No Answer', status: 'pending' },
];

export function ScheduleActivityModal({ open, onClose, record, context, teamMembers }: Props) {
  const [activityType, setActivityType] = useState<ActivityType>('phone_call');
  const [subject, setSubject] = useState('');
  const [comments, setComments] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [sendCalendarInvite, setSendCalendarInvite] = useState(false);
  const [assignedTeamMemberId, setAssignedTeamMemberId] = useState('');
  const [statusUpdate, setStatusUpdate] = useState('none');
  const createActivity = useCreateRenewalActivity();

  const handleSubmit = () => {
    const sel = STATUS_UPDATES.find(s => s.value === statusUpdate);
    createActivity.mutate({
      renewalRecordId: record.id, agencyId: context.agencyId, activityType,
      activityStatus: statusUpdate !== 'none' ? statusUpdate : undefined,
      subject: subject || `${ACTIVITY_TYPES.find(t => t.value === activityType)?.label}: ${record.first_name} ${record.last_name}`,
      comments: comments || undefined, scheduledDate, sendCalendarInvite,
      assignedTeamMemberId: assignedTeamMemberId || undefined,
      displayName: context.displayName, userId: context.userId, updateRecordStatus: sel?.status,
    }, { onSuccess: handleClose });
  };

  const handleClose = () => { setActivityType('phone_call'); setSubject(''); setComments(''); setScheduledDate(undefined); setSendCalendarInvite(false); setAssignedTeamMemberId(''); setStatusUpdate('none'); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Log Activity</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Activity Type</Label><Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ACTIVITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={`${ACTIVITY_TYPES.find(t => t.value === activityType)?.label}: ${record.first_name} ${record.last_name}`} /></div>
          <div className="space-y-2"><Label>Assign To</Label><Select value={assignedTeamMemberId || 'unassigned'} onValueChange={(v) => setAssignedTeamMemberId(v === 'unassigned' ? '' : v)}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{teamMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></div>
          {(activityType === 'appointment' || activityType === 'phone_call') && (
            <div className="space-y-2"><Label>Scheduled Date</Label>
              <Popover><PopoverTrigger asChild><Button variant="outline" className={cn('w-full justify-start text-left font-normal', !scheduledDate && 'text-muted-foreground')}><CalendarIcon className="mr-2 h-4 w-4" />{scheduledDate ? format(scheduledDate, 'PPP') : 'Pick a date'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={scheduledDate} onSelect={setScheduledDate} initialFocus /></PopoverContent></Popover>
            </div>
          )}
          {scheduledDate && <div className="flex items-center space-x-2"><Checkbox id="cal" checked={sendCalendarInvite} onCheckedChange={(c) => setSendCalendarInvite(!!c)} /><Label htmlFor="cal" className="text-sm font-normal">Send Calendar Invite</Label></div>}
          <div className="space-y-2"><Label>Comments</Label><Textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Add notes..." rows={3} /></div>
          <div className="space-y-2"><Label>Update Status</Label><Select value={statusUpdate} onValueChange={setStatusUpdate}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_UPDATES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={handleClose}>Cancel</Button><Button onClick={handleSubmit} disabled={createActivity.isPending}>{createActivity.isPending ? 'Saving...' : 'Save'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
