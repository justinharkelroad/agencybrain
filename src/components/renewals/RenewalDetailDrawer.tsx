import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Phone, Mail, Calendar, FileText, DollarSign, MessageSquare, Voicemail, CheckCircle, X, ExternalLink, Send, Loader2, Copy, ClipboardList, type LucideIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRenewalActivities, useCreateRenewalActivity } from '@/hooks/useRenewalActivities';
import { useUpdateRenewalRecord } from '@/hooks/useRenewalRecords';
import { ScheduleActivityModal } from './ScheduleActivityModal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { sendRenewalToWinback } from '@/lib/sendToWinback';
import type { RenewalRecord, WorkflowStatus, RenewalUploadContext } from '@/types/renewal';
import { ScheduleTaskDialog, type ScheduleTaskDialogContact } from '@/components/onboarding/ScheduleTaskDialog';
import { useScheduleAdhocTask } from '@/hooks/useScheduleAdhocTask';

interface Props { record: RenewalRecord | null; open: boolean; onClose: () => void; context: RenewalUploadContext | null; teamMembers: Array<{ id: string; name: string }>; staffSessionToken?: string | null; }

const STATUS_COLORS: Record<WorkflowStatus, string> = {
  uncontacted: 'bg-slate-600 text-slate-100',
  pending: 'bg-amber-600 text-amber-100',
  success: 'bg-green-600 text-green-100',
  unsuccessful: 'bg-red-600 text-red-100',
};

const activityStyles: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  call: { icon: Phone, color: 'text-blue-600 dark:text-blue-400 border-blue-500/50 dark:border-blue-500/30 bg-blue-500/15', label: 'Call' },
  voicemail: { icon: Voicemail, color: 'text-purple-600 dark:text-purple-400 border-purple-500/50 dark:border-purple-500/30 bg-purple-500/15', label: 'Voicemail' },
  text: { icon: MessageSquare, color: 'text-cyan-600 dark:text-cyan-400 border-cyan-500/50 dark:border-cyan-500/30 bg-cyan-500/15', label: 'Text Sent' },
  email: { icon: Mail, color: 'text-green-600 dark:text-green-400 border-green-500/50 dark:border-green-500/30 bg-green-500/15', label: 'Email' },
  review_done: { icon: CheckCircle, color: 'text-yellow-600 dark:text-yellow-400 border-yellow-500/50 dark:border-yellow-500/30 bg-yellow-500/15', label: 'Review Done' },
  phone_call: { icon: Phone, color: 'text-blue-600 dark:text-blue-400 border-blue-500/50 dark:border-blue-500/30 bg-blue-500/15', label: 'Attempted Call' },
  appointment: { icon: Calendar, color: 'text-orange-600 dark:text-orange-400 border-orange-500/50 dark:border-orange-500/30 bg-orange-500/15', label: 'Appointment' },
  note: { icon: FileText, color: 'text-gray-600 dark:text-gray-400 border-gray-500/50 dark:border-gray-500/30 bg-gray-500/15', label: 'Note' },
  task_scheduled: { icon: ClipboardList, color: 'text-amber-600 dark:text-amber-400 border-amber-500/50 dark:border-amber-500/30 bg-amber-500/15', label: 'Task Scheduled' },
};

export function RenewalDetailDrawer({ record, open, onClose, context, teamMembers, staffSessionToken }: Props) {
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showScheduleTaskDialog, setShowScheduleTaskDialog] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [sendingToWinback, setSendingToWinback] = useState(false);
  // Local state for optimistic UI updates
  const [localAssignment, setLocalAssignment] = useState<string | null>(record?.assigned_team_member_id || null);
  const [localStatus, setLocalStatus] = useState<WorkflowStatus>(record?.current_status || 'uncontacted');
  const { data: activities = [] } = useRenewalActivities(record?.id || null);
  const updateRecord = useUpdateRenewalRecord();
  const createActivity = useCreateRenewalActivity();
  const scheduleTask = useScheduleAdhocTask({ staffSessionToken });
  const queryClient = useQueryClient();

  // Sync local state when record changes (e.g., drawer reopened with different record)
  useEffect(() => {
    setLocalAssignment(record?.assigned_team_member_id || null);
    setLocalStatus(record?.current_status || 'uncontacted');
  }, [record?.id, record?.assigned_team_member_id, record?.current_status]);

  useEffect(() => {
    if (!open) {
      setShowScheduleTaskDialog(false);
    }
  }, [open]);

  useEffect(() => {
    setShowScheduleTaskDialog(false);
  }, [record?.id]);

  // Listen for sidebar navigation to force close drawer
  useEffect(() => {
    const handleNavigation = () => {
      if (open) {
        onClose();
      }
    };
    window.addEventListener('sidebar-navigation', handleNavigation);
    return () => window.removeEventListener('sidebar-navigation', handleNavigation);
  }, [open, onClose]);

  if (!record || !context) return null;

  const handleStatusChange = (s: WorkflowStatus) => { 
    setLocalStatus(s); // Optimistic UI update
    updateRecord.mutate({ id: record.id, updates: { current_status: s }, displayName: context.displayName, userId: context.userId }); 
  };

  const handleSaveNote = () => {
    if (!record?.id || !noteText.trim()) return;

    createActivity.mutate({
      renewalRecordId: record.id,
      agencyId: context.agencyId,
      activityType: 'note',
      comments: noteText.trim(),
      displayName: context.displayName,
      userId: context.userId,
    }, {
      onSuccess: () => {
        setNoteText('');
      }
    });
  };

  const handleSendToWinback = async () => {
    if (!record) return;

    setSendingToWinback(true);
    try {
      const result = await sendRenewalToWinback({
        id: record.id,
        agency_id: record.agency_id,
        first_name: record.first_name,
        last_name: record.last_name,
        email: record.email,
        phone: record.phone,
        policy_number: record.policy_number,
        product_name: record.product_name,
        renewal_effective_date: record.renewal_effective_date,
        premium_old: record.premium_old,
        premium_new: record.premium_new,
        agent_number: record.agent_number,
        household_key: record.household_key,
      });

      if (result.success) {
        toast.success('Sent to Win-Back HQ');
        queryClient.invalidateQueries({ queryKey: ['renewal-records'] });
      } else {
        toast.error(result.error || 'Failed to send to Win-Back');
      }
    } catch (error) {
      toast.error('Failed to send to Win-Back');
    } finally {
      setSendingToWinback(false);
    }
  };

  const taskContact: ScheduleTaskDialogContact | null = record.contact_id
    ? {
        id: record.contact_id,
        firstName: record.first_name || '',
        lastName: record.last_name || '',
        phones: [record.phone, record.phone_alt].filter(Boolean) as string[],
        emails: [record.email].filter(Boolean) as string[],
      }
    : null;

  const handleScheduleTask = async (data: {
    contactId: string;
    contactName: string;
    dueDate: string;
    actionType: 'call' | 'text' | 'email' | 'other';
    title: string;
    description?: string;
  }) => {
    await scheduleTask.mutateAsync({
      contactId: data.contactId,
      dueDate: data.dueDate,
      actionType: data.actionType,
      title: data.title,
      description: data.description,
      sourceModule: 'renewal',
      moduleRecordId: record.id,
    });
    toast.success(`Task scheduled for ${data.contactName}`);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col p-0 bg-card dark:bg-[#1a1f2e] border-border dark:border-gray-700 text-foreground [&>button.absolute]:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>{record.first_name} {record.last_name} - Renewal Details</SheetTitle>
            <SheetDescription>View and manage renewal record details</SheetDescription>
          </SheetHeader>
          
          {/* Sticky header with explicit close button */}
          <div className="sticky top-0 z-20 bg-card dark:bg-[#1a1f2e] border-b border-border p-4 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-foreground truncate">
                  {record.first_name} {record.last_name}
                </h2>
                <div className="flex items-center gap-1 min-w-0">
                  <p className="text-muted-foreground font-mono truncate">{record.policy_number}</p>
                  {record.policy_number && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(record.policy_number).then(
                          () => toast.success('Policy number copied'),
                          () => toast.error('Failed to copy')
                        );
                      }}
                      className="p-0.5 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground shrink-0"
                      title="Copy policy number"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-10 w-10 shrink-0 text-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-lg font-semibold text-foreground">
                ${record.premium_new?.toLocaleString() || '—'}
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <MessageSquare className="h-4 w-4" />
                  <span className="font-medium">{activities.length}</span>
                </div>
                <Badge className={STATUS_COLORS[localStatus]}>
                  {localStatus}
                </Badge>
              </div>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            {/* Info Stack - Vertical layout for better readability */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border-b border-border text-foreground">
              {/* Contact */}
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-gray-600 dark:text-gray-400 mt-1" />
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Contact</span>
                  <p className="text-sm">Phone: {record.phone || '—'}</p>
                  <p className="text-sm break-all">Email: {record.email || '—'}</p>
                </div>
              </div>

              {/* Policy */}
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400 mt-1" />
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Policy</span>
                  <p className="text-sm">Agent #: {record.agent_number || '—'}</p>
                  <p className="text-sm">Product: {record.product_name || '—'}</p>
                </div>
              </div>

              {/* Dates */}
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-gray-600 dark:text-gray-400 mt-1" />
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Dates</span>
                  <p className="text-sm">Effective: {record.renewal_effective_date || '—'}</p>
                  <p className="text-sm">Bundled: <span className="capitalize">{record.multi_line_indicator}</span></p>
                </div>
              </div>

              {/* Financials */}
              <div className="flex items-start gap-3">
                <DollarSign className="h-4 w-4 text-gray-600 dark:text-gray-400 mt-1" />
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Financials</span>
                  <p className="text-sm">Old: ${record.premium_old?.toLocaleString() || '—'}</p>
                  <p className="text-sm">New: ${record.premium_new?.toLocaleString() || '—'}</p>
                  <p className={`text-sm font-medium ${(record.premium_change_percent || 0) < 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    Change: {record.premium_change_percent?.toFixed(1) || 0}%
                  </p>
                </div>
              </div>
            </div>

            {/* Actions / Notes / History */}
            <div className="p-4 space-y-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setShowActivityModal(true)} size="sm" className="bg-blue-600 hover:bg-blue-700 min-h-[44px] px-4">
                  <Calendar className="h-4 w-4 mr-2" />Log Activity
                </Button>
                <Button
                  onClick={() => setShowScheduleTaskDialog(true)}
                  size="sm"
                  variant="outline"
                  className="min-h-[44px] px-4"
                  disabled={scheduleTask.isPending}
                >
                  <Calendar className="h-4 w-4 mr-2" />Schedule Task
                </Button>
                <Select value={localStatus} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-[140px] bg-muted dark:bg-[#0d1117] border-border dark:border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uncontacted">Uncontacted</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="unsuccessful">Unsuccessful</SelectItem>
                  </SelectContent>
                </Select>
                <Select 
                  value={localAssignment || 'unassigned'} 
                  onValueChange={(value) => {
                    const newValue = value === 'unassigned' ? null : value;
                    // Optimistically update local state immediately
                    setLocalAssignment(newValue);
                    updateRecord.mutate({ 
                      id: record.id, 
                      updates: { assigned_team_member_id: newValue },
                      displayName: context.displayName,
                      userId: context.userId,
                      silent: true
                    });
                  }}
                >
                  <SelectTrigger className="w-[160px] bg-muted dark:bg-[#0d1117] border-border dark:border-gray-700">
                    <SelectValue placeholder="Assign LSP" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {context.staffTeamMemberId && (
                      <SelectItem value={context.staffTeamMemberId}>
                        Assign to Me
                      </SelectItem>
                    )}
                    {teamMembers
                      .filter((member) => member.id !== context.staffTeamMemberId)
                      .map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Win-Back Integration - Show only for unsuccessful renewals */}
              {record.current_status === 'unsuccessful' && (
                <div className="border-t border-border dark:border-gray-700 pt-4 mt-4">
                  <p className="text-sm font-medium mb-2 text-muted-foreground">Win-Back HQ</p>
                  {record.winback_household_id ? (
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                      <ExternalLink className="h-4 w-4" />
                      <span>Already sent to Win-Back</span>
                      <a href="/agency/winback" className="text-blue-600 dark:text-blue-400 hover:underline ml-2">
                        View →
                      </a>
                    </div>
                  ) : (
                    <Button
                      onClick={handleSendToWinback}
                      disabled={sendingToWinback}
                      variant="outline"
                      className="w-full border-border dark:border-gray-600 hover:bg-muted"
                    >
                      {sendingToWinback ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send to Win-Back HQ
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground text-sm">Notes</h3>
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note..."
                  rows={3}
                  className="bg-muted dark:bg-[#0d1117] border-border dark:border-gray-700"
                />
                <Button
                  onClick={handleSaveNote}
                  disabled={createActivity.isPending || !noteText.trim()}
                  variant="outline"
                  size="sm"
                  className="border-border dark:border-gray-600"
                >
                  {createActivity.isPending ? 'Saving...' : 'Save Note'}
                </Button>
              </div>

              {/* Activity History */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">Activity History</h3>
                  <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-500/50 dark:border-green-500/30 bg-green-500/15">
                    {activities.length} contacts
                  </Badge>
                </div>

                {activities.length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400">No activities yet.</p>
                ) : (
                  <div className="space-y-2">
                    {activities.map((a) => {
                      const style = activityStyles[a.activity_type] || { icon: FileText, color: 'text-gray-600 dark:text-gray-400 border-border dark:border-gray-700 bg-muted/50 dark:bg-gray-800/50', label: a.activity_type };
                      const Icon = style.icon;
                      return (
                        <div
                          key={a.id}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border",
                            style.color
                          )}
                        >
                          <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{style.label}</span>
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            {a.comments && (
                              <p className="text-sm text-muted-foreground mt-1">{a.comments}</p>
                            )}
                            <p className="text-xs text-muted-foreground/70 mt-1">by {a.created_by_display_name}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <ScheduleTaskDialog
        open={showScheduleTaskDialog}
        onOpenChange={setShowScheduleTaskDialog}
        agencyId={context.agencyId}
        initialContact={taskContact}
        lockContact={!!taskContact}
        defaultTitle="Renewal follow-up"
        onSchedule={handleScheduleTask}
      />
      <ScheduleActivityModal open={showActivityModal} onClose={() => setShowActivityModal(false)} record={record} context={context} teamMembers={teamMembers} />
    </>
  );
}
