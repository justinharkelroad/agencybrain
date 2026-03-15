import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Phone,
  Mail,
  MessageSquare,
  MoreHorizontal,
  CheckCircle2,
  StickyNote,
  CalendarIcon,
  CalendarPlus,
  Workflow,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useContactProfile } from '@/hooks/useContactProfile';
import {
  useContactSequenceProgress,
  mapSequenceInstances,
} from '@/hooks/useContactSequenceProgress';
import { useLogNote } from '@/hooks/useLogContactActivity';
import { useScheduleAdhocTask } from '@/hooks/useScheduleAdhocTask';
import { useManageSequence } from '@/hooks/useManageSequence';
import { CustomerJourneyBadge } from '@/components/contacts/CustomerJourney';
import { ActivityTimeline } from '@/components/contacts/ActivityTimeline';
import { SequenceProgressTracker } from './SequenceProgressTracker';
import { LinkedRecordsSummary } from './LinkedRecordsSummary';
import { TaskCompleteDialog } from './TaskCompleteDialog';
import { ApplySequenceModal } from './ApplySequenceModal';
import type { OnboardingTask, ActionType } from '@/hooks/useOnboardingTasks';
import type { StaffOnboardingTask } from '@/hooks/useStaffOnboardingTasks';
import type { FollowUpData } from './TaskCompleteDialog';
import { addDays } from 'date-fns';

interface ContactIntelligencePanelProps {
  open: boolean;
  onClose: () => void;
  contactId: string | null;
  agencyId: string | null;
  // Task context (when opened from a specific task click)
  currentTask?: OnboardingTask | StaffOnboardingTask | null;
  // Auth context (dual portal)
  userId?: string;
  staffMemberId?: string;
  staffSessionToken?: string | null;
  displayName?: string;
  // Callbacks
  onCompleteTask?: (taskId: string, notes?: string, followUp?: FollowUpData, callOutcome?: any) => Promise<void>;
  onTaskCompleted?: () => void;
  onActivityLogged?: () => void;
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  call: Phone,
  text: MessageSquare,
  email: Mail,
  other: MoreHorizontal,
};

const ACTION_COLORS: Record<string, string> = {
  call: 'bg-green-500/15 text-green-500',
  text: 'bg-purple-500/15 text-purple-500',
  email: 'bg-blue-500/15 text-blue-500',
  other: 'bg-gray-500/15 text-gray-600 dark:text-gray-400',
};

export function ContactIntelligencePanel({
  open,
  onClose,
  contactId,
  agencyId,
  currentTask,
  userId,
  staffMemberId,
  staffSessionToken,
  displayName,
  onCompleteTask,
  onTaskCompleted,
  onActivityLogged,
}: ContactIntelligencePanelProps) {
  const queryClient = useQueryClient();
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showApplySequence, setShowApplySequence] = useState(false);

  // Quick action states
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>();
  const [followUpActionType, setFollowUpActionType] = useState<ActionType>('call');
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Sequence management state
  const [sequenceConfirm, setSequenceConfirm] = useState<{
    action: 'complete' | 'pause' | 'resume';
    instanceId: string;
    sequenceName: string;
    remainingCount?: number;
  } | null>(null);

  // Reset form state when contactId changes or panel closes
  useEffect(() => {
    setShowNoteForm(false);
    setNoteText('');
    setShowFollowUpForm(false);
    setFollowUpDate(undefined);
    setFollowUpTitle('');
    setFollowUpActionType('call');
    setCalendarOpen(false);
    setShowCompleteDialog(false);
    setShowApplySequence(false);
    setSequenceConfirm(null);
  }, [contactId]);

  // Data fetching
  const { data: profile, isLoading: profileLoading } = useContactProfile(
    open ? contactId : null,
    agencyId,
  );

  // Sequence progress - for agency portal, query directly; for staff, map from profile edge fn
  // undefined = agency portal (hook will query directly via RLS)
  // null = staff portal, profile still loading (hook skips query, returns loading state)
  // SequenceInstanceInfo[] = staff portal, data ready
  const staffSequenceData = useMemo(() => {
    if (!staffSessionToken) return undefined; // agency portal
    if (!profile) return null; // staff portal, still loading
    const raw = (profile as any).sequenceInstances;
    return raw ? mapSequenceInstances(raw) : [];
  }, [staffSessionToken, profile]);

  const { data: sequenceInstances = [] } = useContactSequenceProgress(
    open ? contactId : null,
    agencyId,
    staffSequenceData,
  );

  // Mutations
  const logNote = useLogNote();
  const scheduleTask = useScheduleAdhocTask({ staffSessionToken });
  const manageSequence = useManageSequence();

  // Computed
  const contactName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown'
    : 'Loading...';

  const primaryPhone = profile?.phones?.[0] || null;
  const primaryEmail = profile?.emails?.[0] || null;

  const tenureDays = profile?.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const limitedActivities = useMemo(
    () => (profile?.activities || []).slice(0, 15),
    [profile?.activities],
  );

  // Handlers
  const handleNoteSubmit = async () => {
    if (!noteText.trim() || !contactId || !agencyId) return;
    try {
      await logNote.mutateAsync({
        contactId,
        agencyId,
        sourceModule: 'manual',
        notes: noteText.trim(),
        createdByUserId: userId || null,
        createdByStaffId: staffMemberId || null,
        createdByDisplayName: displayName || 'Unknown',
      });
      setNoteText('');
      setShowNoteForm(false);
      // Refresh timeline to show the new note
      queryClient.invalidateQueries({ queryKey: ['contact-profile', contactId] });
      onActivityLogged?.();
    } catch {
      // Error handled by hook
    }
  };

  const handleFollowUpSubmit = async () => {
    if (!followUpDate || !followUpTitle.trim() || !contactId) return;
    try {
      await scheduleTask.mutateAsync({
        contactId,
        dueDate: format(followUpDate, 'yyyy-MM-dd'),
        actionType: followUpActionType,
        title: followUpTitle.trim(),
      });
      setFollowUpDate(undefined);
      setFollowUpTitle('');
      setFollowUpActionType('call');
      setShowFollowUpForm(false);
      // Invalidate task queries
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks-today'] });
      queryClient.invalidateQueries({ queryKey: ['staff-onboarding-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['contact-sequence-progress'] });
    } catch {
      // Error handled by hook
    }
  };

  const handleTaskCompleted = async (taskId: string, notes?: string, followUp?: FollowUpData, callOutcome?: any) => {
    if (!onCompleteTask) return;
    try {
      await onCompleteTask(taskId, notes, followUp, callOutcome);
      setShowCompleteDialog(false);
      onTaskCompleted?.();
    } catch {
      // Parent handler shows error toast; dialog stays open so user can retry
    }
  };

  const handleSequenceApplied = () => {
    queryClient.invalidateQueries({ queryKey: ['contact-profile', contactId] });
    queryClient.invalidateQueries({ queryKey: ['contact-sequence-progress'] });
    queryClient.invalidateQueries({ queryKey: ['onboarding-tasks-today'] });
    queryClient.invalidateQueries({ queryKey: ['staff-onboarding-tasks'] });
    setShowApplySequence(false);
  };

  // Sequence management callbacks (from SequenceProgressTracker dropdown)
  const handleCompleteSequence = (instanceId: string, sequenceName: string, remainingCount: number) => {
    setSequenceConfirm({ action: 'complete', instanceId, sequenceName, remainingCount });
  };

  const handlePauseSequence = (instanceId: string, sequenceName: string) => {
    setSequenceConfirm({ action: 'pause', instanceId, sequenceName });
  };

  const handleResumeSequence = (instanceId: string, sequenceName: string) => {
    setSequenceConfirm({ action: 'resume', instanceId, sequenceName });
  };

  const handleConfirmSequenceAction = async () => {
    if (!sequenceConfirm || !agencyId) return;
    try {
      await manageSequence.mutateAsync({
        instanceId: sequenceConfirm.instanceId,
        action: sequenceConfirm.action,
        agencyId,
        completedByUserId: userId || null,
        completedByStaffId: staffMemberId || null,
        staffSessionToken: staffSessionToken || null,
      });
      setSequenceConfirm(null);
      onActivityLogged?.();
    } catch {
      // Error handled by hook
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <SheetContent
          side="right"
          className="sm:max-w-lg w-full p-0 flex flex-col"
          disableOutsidePointerEvents
        >
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <div className="flex items-start justify-between gap-3 pr-6">
              <div className="min-w-0">
                <SheetTitle className="text-lg truncate">{contactName}</SheetTitle>
                {profile?.current_stage && (
                  <div className="mt-1">
                    <CustomerJourneyBadge currentStage={profile.current_stage} />
                  </div>
                )}
              </div>
            </div>
            <SheetDescription className="sr-only">Contact intelligence panel</SheetDescription>

            {/* Contact info */}
            {profile && (
              <div className="flex items-center gap-3 mt-2 text-sm flex-wrap">
                {primaryPhone && (
                  <a
                    href={`tel:${primaryPhone}`}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {primaryPhone}
                  </a>
                )}
                {primaryEmail && (
                  <a
                    href={`mailto:${primaryEmail}`}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {primaryEmail}
                  </a>
                )}
              </div>
            )}

            {/* Tenure badge */}
            {tenureDays !== null && (
              <div className="mt-1">
                <Badge variant="outline" className="text-[10px]">
                  {profile?.current_stage === 'customer' || profile?.current_stage === 'renewal'
                    ? `Customer for ${tenureDays} days`
                    : `Lead for ${tenureDays} days`}
                </Badge>
              </div>
            )}
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="px-6 py-4 space-y-6">
              {/* Quick Actions Bar */}
              <div className="flex flex-wrap gap-2">
                {currentTask && onCompleteTask && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setShowCompleteDialog(true)}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Complete Task
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowFollowUpForm(!showFollowUpForm);
                    setShowNoteForm(false);
                  }}
                >
                  <CalendarPlus className="h-4 w-4 mr-1.5" />
                  Follow-up
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowNoteForm(!showNoteForm);
                    setShowFollowUpForm(false);
                  }}
                >
                  <StickyNote className="h-4 w-4 mr-1.5" />
                  Note
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowApplySequence(true)}
                >
                  <Workflow className="h-4 w-4 mr-1.5" />
                  Sequence
                </Button>
              </div>

              {/* Inline Note Form */}
              {showNoteForm && (
                <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                  <Textarea
                    placeholder="Type your note..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={3}
                    className="resize-none text-sm"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setShowNoteForm(false); setNoteText(''); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleNoteSubmit}
                      disabled={!noteText.trim() || logNote.isPending}
                    >
                      {logNote.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : null}
                      Save Note
                    </Button>
                  </div>
                </div>
              )}

              {/* Inline Follow-up Form */}
              {showFollowUpForm && (
                <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                  {/* Quick date buttons */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Tomorrow', days: 1 },
                      { label: '+2 days', days: 2 },
                      { label: '+4 days', days: 4 },
                      { label: '+1 week', days: 7 },
                    ].map((opt) => (
                      <Button
                        key={opt.days}
                        type="button"
                        variant={followUpDate && format(addDays(new Date(), opt.days), 'yyyy-MM-dd') === format(followUpDate, 'yyyy-MM-dd') ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setFollowUpDate(addDays(new Date(), opt.days));
                          if (!followUpTitle) setFollowUpTitle('Follow-up call');
                        }}
                      >
                        {opt.label}
                      </Button>
                    ))}
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          <CalendarIcon className="h-3 w-3 mr-1" />
                          {followUpDate ? format(followUpDate, 'MMM d') : 'Pick date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={followUpDate}
                          onSelect={(d) => {
                            setFollowUpDate(d);
                            setCalendarOpen(false);
                            if (d && !followUpTitle) setFollowUpTitle('Follow-up call');
                          }}
                          disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {followUpDate && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs w-12 shrink-0">Type:</Label>
                        <Select
                          value={followUpActionType}
                          onValueChange={(v) => setFollowUpActionType(v as ActionType)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="call">Call</SelectItem>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs w-12 shrink-0">Title:</Label>
                        <Input
                          value={followUpTitle}
                          onChange={(e) => setFollowUpTitle(e.target.value)}
                          placeholder="e.g., Follow-up call"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowFollowUpForm(false);
                        setFollowUpDate(undefined);
                        setFollowUpTitle('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleFollowUpSubmit}
                      disabled={!followUpDate || !followUpTitle.trim() || scheduleTask.isPending}
                    >
                      {scheduleTask.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : null}
                      Schedule
                    </Button>
                  </div>
                </div>
              )}

              {/* Current Task Card */}
              {currentTask && (
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Current Task
                  </h3>
                  <CurrentTaskCard task={currentTask} />
                </section>
              )}

              {/* Sequence Progress */}
              {(sequenceInstances.length > 0 || !profileLoading) && (
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Sequence Progress
                  </h3>
                  <SequenceProgressTracker
                    instances={sequenceInstances}
                    currentTaskId={currentTask?.id}
                    onCompleteSequence={handleCompleteSequence}
                    onPauseSequence={handlePauseSequence}
                    onResumeSequence={handleResumeSequence}
                  />
                </section>
              )}

              {/* Activity Timeline */}
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Recent Activity
                </h3>
                {profileLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ActivityTimeline
                    activities={limitedActivities}
                    disableScroll
                    maxHeight="none"
                  />
                )}
              </section>

              {/* Linked Records Summary */}
              {profile && (
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Linked Records
                  </h3>
                  <LinkedRecordsSummary
                    lqsRecords={profile.lqs_records || []}
                    renewalRecords={profile.renewal_records || []}
                    cancelAuditRecords={profile.cancel_audit_records || []}
                    winbackRecords={profile.winback_records || []}
                  />
                </section>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Task Complete Dialog (Dialog on top of Sheet) */}
      {currentTask && (
        <TaskCompleteDialog
          open={showCompleteDialog}
          onOpenChange={setShowCompleteDialog}
          taskId={currentTask.id}
          taskTitle={currentTask.title}
          customerName={contactName}
          actionType={currentTask.action_type as ActionType}
          onComplete={handleTaskCompleted}
          contactId={contactId || undefined}
        />
      )}

      {/* Apply Sequence Modal (Dialog on top of Sheet) */}
      {contactId && agencyId && (
        <ApplySequenceModal
          open={showApplySequence}
          onOpenChange={setShowApplySequence}
          contactId={contactId}
          customerName={contactName}
          customerPhone={primaryPhone || undefined}
          customerEmail={primaryEmail || undefined}
          agencyId={agencyId}
          onSuccess={handleSequenceApplied}
          staffSessionToken={staffSessionToken || undefined}
        />
      )}

      {/* Sequence Management Confirmation Dialog */}
      <AlertDialog open={!!sequenceConfirm} onOpenChange={(open) => !open && setSequenceConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {sequenceConfirm?.action === 'complete' && 'Complete Sequence'}
              {sequenceConfirm?.action === 'pause' && 'Pause Sequence'}
              {sequenceConfirm?.action === 'resume' && 'Resume Sequence'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {sequenceConfirm?.action === 'complete' && (
                <>
                  This will mark <strong>{sequenceConfirm.sequenceName}</strong> as complete
                  and finish all {sequenceConfirm.remainingCount} remaining task(s) for {contactName}.
                  Completed tasks will not be affected.
                </>
              )}
              {sequenceConfirm?.action === 'pause' && (
                <>
                  This will pause <strong>{sequenceConfirm.sequenceName}</strong> for {contactName}.
                  Remaining tasks will be removed from the queue until the sequence is resumed.
                </>
              )}
              {sequenceConfirm?.action === 'resume' && (
                <>
                  This will resume <strong>{sequenceConfirm.sequenceName}</strong> for {contactName}.
                  Remaining tasks will be restored to the queue.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={manageSequence.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmSequenceAction();
              }}
              disabled={manageSequence.isPending}
            >
              {manageSequence.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : null}
              {sequenceConfirm?.action === 'complete' && 'Complete'}
              {sequenceConfirm?.action === 'pause' && 'Pause'}
              {sequenceConfirm?.action === 'resume' && 'Resume'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Compact card showing the current task context
 */
function CurrentTaskCard({ task }: { task: OnboardingTask | StaffOnboardingTask }) {
  const Icon = ACTION_ICONS[task.action_type] || MoreHorizontal;
  const actionColor = ACTION_COLORS[task.action_type] || ACTION_COLORS.other;

  return (
    <Card className="border-blue-300 dark:border-blue-500/40 bg-blue-50/30 dark:bg-blue-500/5">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className={cn('flex items-center justify-center w-9 h-9 rounded-full shrink-0', actionColor)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm">{task.title}</h4>
            {task.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <CalendarIcon className="h-3 w-3" />
              <span>{format(new Date(task.due_date), 'MMM d')}</span>
              {!('is_adhoc' in task && task.is_adhoc) && (
                <span>Day {task.day_number}</span>
              )}
            </div>
            {task.script_template && (
              <details className="mt-2">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  View Script
                </summary>
                <div className="mt-1 p-2 bg-muted/50 rounded text-sm whitespace-pre-wrap">
                  {task.script_template}
                </div>
              </details>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
