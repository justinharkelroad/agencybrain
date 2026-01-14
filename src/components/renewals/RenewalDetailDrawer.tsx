import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Phone, Mail, Calendar, FileText, DollarSign, MessageSquare, Voicemail, CheckCircle, X, ExternalLink, Send, Loader2, type LucideIcon } from 'lucide-react';
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

interface Props { record: RenewalRecord | null; open: boolean; onClose: () => void; context: RenewalUploadContext; teamMembers: Array<{ id: string; name: string }>; }

const STATUS_COLORS: Record<WorkflowStatus, string> = {
  uncontacted: 'bg-slate-600 text-slate-100',
  pending: 'bg-amber-600 text-amber-100',
  success: 'bg-green-600 text-green-100',
  unsuccessful: 'bg-red-600 text-red-100',
};

const activityStyles: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  call: { icon: Phone, color: 'text-blue-400 border-blue-500/30 bg-blue-500/10', label: 'Call' },
  voicemail: { icon: Voicemail, color: 'text-purple-400 border-purple-500/30 bg-purple-500/10', label: 'Voicemail' },
  text: { icon: MessageSquare, color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10', label: 'Text Sent' },
  email: { icon: Mail, color: 'text-green-400 border-green-500/30 bg-green-500/10', label: 'Email' },
  review_done: { icon: CheckCircle, color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10', label: 'Review Done' },
  phone_call: { icon: Phone, color: 'text-blue-400 border-blue-500/30 bg-blue-500/10', label: 'Attempted Call' },
  appointment: { icon: Calendar, color: 'text-orange-400 border-orange-500/30 bg-orange-500/10', label: 'Appointment' },
  note: { icon: FileText, color: 'text-gray-400 border-gray-500/30 bg-gray-500/10', label: 'Note' },
};

export function RenewalDetailDrawer({ record, open, onClose, context, teamMembers }: Props) {
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [sendingToWinback, setSendingToWinback] = useState(false);
  // Local state for assignment to allow optimistic UI updates
  const [localAssignment, setLocalAssignment] = useState<string | null>(record?.assigned_team_member_id || null);
  const { data: activities = [] } = useRenewalActivities(record?.id || null);
  const updateRecord = useUpdateRenewalRecord();
  const createActivity = useCreateRenewalActivity();
  const queryClient = useQueryClient();

  // Sync local state when record changes (e.g., drawer reopened with different record)
  useEffect(() => {
    setLocalAssignment(record?.assigned_team_member_id || null);
  }, [record?.id, record?.assigned_team_member_id]);

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

  if (!record) return null;

  const handleStatusChange = (s: WorkflowStatus) => { 
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

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col p-0 bg-[#1a1f2e] border-gray-700 text-white [&>button.absolute]:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>{record.first_name} {record.last_name} - Renewal Details</SheetTitle>
            <SheetDescription>View and manage renewal record details</SheetDescription>
          </SheetHeader>
          
          {/* Sticky header with explicit close button */}
          <div className="sticky top-0 z-20 bg-[#1a1f2e] border-b border-gray-700 p-4 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-white truncate">
                  {record.first_name} {record.last_name}
                </h2>
                <p className="text-gray-400 font-mono truncate">{record.policy_number}</p>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-10 w-10 shrink-0 text-white hover:bg-white/10"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-lg font-semibold text-white">
                ${record.premium_new?.toLocaleString() || '—'}
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-green-400">
                  <MessageSquare className="h-4 w-4" />
                  <span className="font-medium">{activities.length}</span>
                </div>
                <Badge className={STATUS_COLORS[record.current_status]}>
                  {record.current_status}
                </Badge>
              </div>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            {/* Info Stack - Vertical layout for better readability */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border-b border-gray-700 text-white">
              {/* Contact */}
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-gray-400 mt-1" />
                <div>
                  <span className="text-sm font-medium text-gray-400">Contact</span>
                  <p className="text-sm">Phone: {record.phone || '—'}</p>
                  <p className="text-sm break-all">Email: {record.email || '—'}</p>
                </div>
              </div>

              {/* Policy */}
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-gray-400 mt-1" />
                <div>
                  <span className="text-sm font-medium text-gray-400">Policy</span>
                  <p className="text-sm">Agent #: {record.agent_number || '—'}</p>
                  <p className="text-sm">Product: {record.product_name || '—'}</p>
                </div>
              </div>

              {/* Dates */}
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-gray-400 mt-1" />
                <div>
                  <span className="text-sm font-medium text-gray-400">Dates</span>
                  <p className="text-sm">Effective: {record.renewal_effective_date || '—'}</p>
                  <p className="text-sm">Bundled: {record.multi_line_indicator ? 'Yes' : 'No'}</p>
                </div>
              </div>

              {/* Financials */}
              <div className="flex items-start gap-3">
                <DollarSign className="h-4 w-4 text-gray-400 mt-1" />
                <div>
                  <span className="text-sm font-medium text-gray-400">Financials</span>
                  <p className="text-sm">Old: ${record.premium_old?.toLocaleString() || '—'}</p>
                  <p className="text-sm">New: ${record.premium_new?.toLocaleString() || '—'}</p>
                  <p className={`text-sm font-medium ${(record.premium_change_percent || 0) < 0 ? 'text-green-400' : 'text-red-400'}`}>
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
                <Select value={record.current_status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-[140px] bg-[#0d1117] border-gray-700 text-white">
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
                  <SelectTrigger className="w-[160px] bg-[#0d1117] border-gray-700 text-white">
                    <SelectValue placeholder="Assign LSP" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Win-Back Integration - Show only for unsuccessful renewals */}
              {record.current_status === 'unsuccessful' && (
                <div className="border-t border-gray-700 pt-4 mt-4">
                  <p className="text-sm font-medium mb-2 text-gray-300">Win-Back HQ</p>
                  {record.winback_household_id ? (
                    <div className="flex items-center gap-2 text-sm text-green-400">
                      <ExternalLink className="h-4 w-4" />
                      <span>Already sent to Win-Back</span>
                      <a href="/agency/winback" className="text-blue-400 hover:underline ml-2">
                        View →
                      </a>
                    </div>
                  ) : (
                    <Button
                      onClick={handleSendToWinback}
                      disabled={sendingToWinback}
                      variant="outline"
                      className="w-full border-gray-600 text-white hover:bg-gray-700"
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
                <h3 className="font-semibold text-white text-sm">Notes</h3>
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note..."
                  rows={3}
                  className="bg-[#0d1117] border-gray-700 text-white"
                />
                <Button
                  onClick={handleSaveNote}
                  disabled={createActivity.isPending || !noteText.trim()}
                  variant="outline"
                  size="sm"
                  className="border-gray-600"
                >
                  {createActivity.isPending ? 'Saving...' : 'Save Note'}
                </Button>
              </div>

              {/* Activity History */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-white">Activity History</h3>
                  <Badge variant="outline" className="text-green-400 border-green-500/30 bg-green-500/10">
                    {activities.length} contacts
                  </Badge>
                </div>

                {activities.length === 0 ? (
                  <p className="text-sm text-gray-400">No activities yet.</p>
                ) : (
                  <div className="space-y-2">
                    {activities.map((a) => {
                      const style = activityStyles[a.activity_type] || { icon: FileText, color: 'text-gray-400 border-gray-700 bg-gray-800/50', label: a.activity_type };
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
                              <span className="text-xs text-gray-400">
                                {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            {a.comments && (
                              <p className="text-sm text-gray-300 mt-1">{a.comments}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">by {a.created_by_display_name}</p>
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
      <ScheduleActivityModal open={showActivityModal} onClose={() => setShowActivityModal(false)} record={record} context={context} teamMembers={teamMembers} />
    </>
  );
}
