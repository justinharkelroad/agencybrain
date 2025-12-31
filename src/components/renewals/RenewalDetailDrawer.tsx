import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Phone, Mail, Calendar, FileText, AlertCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRenewalActivities } from '@/hooks/useRenewalActivities';
import { useUpdateRenewalRecord } from '@/hooks/useRenewalRecords';
import { ScheduleActivityModal } from './ScheduleActivityModal';
import type { RenewalRecord, WorkflowStatus, RenewalUploadContext } from '@/types/renewal';

interface Props { record: RenewalRecord | null; open: boolean; onClose: () => void; context: RenewalUploadContext; teamMembers: Array<{ id: string; name: string }>; }

const STATUS_COLORS: Record<WorkflowStatus, string> = {
  uncontacted: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  success: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  unsuccessful: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
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
  const chg = record.premium_change_dollars || 0;
  const chgPct = record.premium_change_percent || 0;

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
          <SheetHeader className="flex-shrink-0">
            <div className="flex items-start justify-between">
              <div><SheetTitle className="text-xl">{record.first_name} {record.last_name}</SheetTitle><p className="text-sm text-muted-foreground font-mono">{record.policy_number}</p></div>
              <Badge className={STATUS_COLORS[record.current_status]}>{record.current_status}</Badge>
            </div>
          </SheetHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 pb-6">
              <div className="flex gap-2">
                <Button onClick={() => setShowActivityModal(true)} size="sm"><Calendar className="h-4 w-4 mr-2" />Log Activity</Button>
                <Select value={record.current_status} onValueChange={handleStatusChange}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="uncontacted">Uncontacted</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="success">Success</SelectItem><SelectItem value="unsuccessful">Unsuccessful</SelectItem></SelectContent></Select>
              </div>
              <Card><CardHeader className="py-3"><CardTitle className="text-sm">Contact</CardTitle></CardHeader><CardContent className="py-0 pb-3 space-y-2">
                {record.email && <a href={`mailto:${record.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline"><Mail className="h-4 w-4" />{record.email}</a>}
                {record.phone && <a href={`tel:${record.phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline"><Phone className="h-4 w-4" />{record.phone}</a>}
              </CardContent></Card>
              <Card><CardHeader className="py-3"><CardTitle className="text-sm">Premium</CardTitle></CardHeader><CardContent className="py-0 pb-3">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div><p className="text-xs text-muted-foreground">Old</p><p className="font-medium">${record.premium_old?.toLocaleString() ?? '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">New</p><p className="font-medium">${record.premium_new?.toLocaleString() ?? '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Change</p><p className={`font-medium ${chg > 0 ? 'text-red-600' : chg < 0 ? 'text-green-600' : ''}`}>{chg > 0 ? '+' : ''}${chg.toLocaleString()} ({chgPct > 0 ? '+' : ''}{chgPct.toFixed(1)}%)</p></div>
                </div>
              </CardContent></Card>
              <Card><CardHeader className="py-3"><CardTitle className="text-sm">Policy</CardTitle></CardHeader><CardContent className="py-0 pb-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Product</span><span>{record.product_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Agent #</span><span className="font-mono">{record.agent_number}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Bundled</span><Badge variant={record.multi_line_indicator ? 'default' : 'secondary'}>{record.multi_line_indicator ? 'Yes' : 'No'}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Effective</span><span>{record.renewal_effective_date}</span></div>
              </CardContent></Card>
              <Card><CardHeader className="py-3"><CardTitle className="text-sm">Notes</CardTitle></CardHeader><CardContent className="py-0 pb-3 space-y-2">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes..." rows={3} />
                <Button size="sm" variant="outline" onClick={handleSaveNotes} disabled={notes === (record.notes || '')}>Save Notes</Button>
              </CardContent></Card>
              <Card><CardHeader className="py-3"><CardTitle className="text-sm">Activity History</CardTitle></CardHeader><CardContent className="py-0 pb-3">
                {activities.length === 0 ? <p className="text-sm text-muted-foreground">No activities yet.</p> : (
                  <div className="space-y-3">{activities.map((a) => (
                    <div key={a.id} className="flex gap-3 text-sm">
                      <div className="flex-shrink-0 mt-0.5">{a.activity_type === 'phone_call' && <Phone className="h-4 w-4" />}{a.activity_type === 'appointment' && <Calendar className="h-4 w-4" />}{a.activity_type === 'email' && <Mail className="h-4 w-4" />}{a.activity_type === 'note' && <FileText className="h-4 w-4" />}{a.activity_type === 'status_change' && <AlertCircle className="h-4 w-4" />}</div>
                      <div className="flex-1 min-w-0"><p className="font-medium capitalize">{a.activity_type.replace('_', ' ')}</p>{a.comments && <p className="text-muted-foreground">{a.comments}</p>}<p className="text-xs text-muted-foreground mt-1">{a.created_by_display_name} • {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</p></div>
                    </div>
                  ))}</div>
                )}
              </CardContent></Card>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
      <ScheduleActivityModal open={showActivityModal} onClose={() => setShowActivityModal(false)} record={record} context={context} teamMembers={teamMembers} />
    </>
  );
}
