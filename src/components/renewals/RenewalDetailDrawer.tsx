import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Phone, Mail, Calendar, FileText, DollarSign, MessageSquare, Voicemail, CheckCircle, type LucideIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRenewalActivities } from '@/hooks/useRenewalActivities';
import { useUpdateRenewalRecord } from '@/hooks/useRenewalRecords';
import { ScheduleActivityModal } from './ScheduleActivityModal';
import { cn } from '@/lib/utils';
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
  const [notes, setNotes] = useState('');
  const { data: activities = [] } = useRenewalActivities(record?.id || null);
  const updateRecord = useUpdateRenewalRecord();

  useEffect(() => { setNotes(record?.notes || ''); }, [record]);
  if (!record) return null;

  const handleStatusChange = (s: WorkflowStatus) => { updateRecord.mutate({ id: record.id, updates: { current_status: s }, displayName: context.displayName, userId: context.userId }); };
  const handleSaveNotes = () => { updateRecord.mutate({ id: record.id, updates: { notes }, displayName: context.displayName, userId: context.userId }); };
  const chgPct = record.premium_change_percent || 0;

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col p-0 bg-[#1a1f2e] border-gray-700">
          {/* Header row with key info */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div>
              <h2 className="text-xl font-bold text-white">{record.first_name} {record.last_name}</h2>
              <p className="text-gray-400 font-mono">{record.policy_number}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-white">${record.premium_new?.toLocaleString() || '—'}</span>
              <div className="flex items-center gap-1 text-green-400">
                <MessageSquare className="h-4 w-4" />
                <span className="font-medium">{activities.length}</span>
              </div>
              <Badge className={STATUS_COLORS[record.current_status]}>{record.current_status}</Badge>
            </div>
          </div>

          {/* Info Grid - 4 columns like Cancel Audit */}
          <div className="grid grid-cols-4 gap-4 p-4 border-b border-gray-700 text-white">
            {/* Contact */}
            <div>
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <Phone className="h-4 w-4" />
                <span className="text-sm font-medium">Contact</span>
              </div>
              <p className="text-sm">Phone: {record.phone || '—'}</p>
              <p className="text-sm truncate">Email: {record.email || '—'}</p>
            </div>

            {/* Policy Details */}
            <div>
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">Policy</span>
              </div>
              <p className="text-sm">Agent #: {record.agent_number || '—'}</p>
              <p className="text-sm">Product: {record.product_name || '—'}</p>
            </div>

            {/* Dates */}
            <div>
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">Dates</span>
              </div>
              <p className="text-sm">Effective: {record.renewal_effective_date || '—'}</p>
              <p className="text-sm">Bundled: {record.multi_line_indicator ? 'Yes' : 'No'}</p>
            </div>

            {/* Financials */}
            <div>
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm font-medium">Financials</span>
              </div>
              <p className="text-sm">Old: ${record.premium_old?.toLocaleString() || '—'}</p>
              <p className="text-sm">New: ${record.premium_new?.toLocaleString() || '—'}</p>
              <p className={cn("text-sm font-medium", chgPct > 0 ? 'text-red-400' : chgPct < 0 ? 'text-green-400' : 'text-gray-400')}>
                Change: {chgPct > 0 ? '+' : ''}{chgPct.toFixed(1)}%
              </p>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Action buttons */}
              <div className="flex gap-2">
                <Button onClick={() => setShowActivityModal(true)} size="sm" className="bg-blue-600 hover:bg-blue-700">
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
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <h3 className="font-semibold text-white text-sm">Notes</h3>
                <Textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                  placeholder="Add notes..." 
                  rows={3} 
                  className="bg-[#0d1117] border-gray-700 text-white"
                />
                <Button size="sm" variant="outline" onClick={handleSaveNotes} disabled={notes === (record.notes || '')} className="border-gray-600">
                  Save Notes
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
          </ScrollArea>
        </SheetContent>
      </Sheet>
      <ScheduleActivityModal open={showActivityModal} onClose={() => setShowActivityModal(false)} record={record} context={context} teamMembers={teamMembers} />
    </>
  );
}
