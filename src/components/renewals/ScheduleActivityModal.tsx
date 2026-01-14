import { useState, useEffect } from 'react';
import { Phone, Voicemail, MessageSquare, Mail, CheckCircle, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateRenewalActivity } from '@/hooks/useRenewalActivities';
import type { RenewalRecord, RenewalUploadContext, ActivityType, WorkflowStatus } from '@/types/renewal';
import { cn } from '@/lib/utils';

interface Props { open: boolean; onClose: () => void; record: RenewalRecord; context: RenewalUploadContext; teamMembers: Array<{ id: string; name: string }>; initialActivityType?: string; }

const quickActions = [
  { type: 'call', label: 'Call', icon: Phone, color: 'border-blue-500 text-blue-400 hover:bg-blue-500/10' },
  { type: 'voicemail', label: 'Voicemail', icon: Voicemail, color: 'border-purple-500 text-purple-400 hover:bg-purple-500/10' },
  { type: 'text', label: 'Text', icon: MessageSquare, color: 'border-cyan-500 text-cyan-400 hover:bg-cyan-500/10' },
  { type: 'email', label: 'Email', icon: Mail, color: 'border-green-500 text-green-400 hover:bg-green-500/10' },
  { type: 'appointment', label: 'Appointment', icon: Calendar, color: 'border-orange-500 text-orange-400 hover:bg-orange-500/10' },
  { type: 'review_done', label: 'Review Done', icon: CheckCircle, color: 'border-yellow-500 text-yellow-400 hover:bg-yellow-500/10' },
];

export function ScheduleActivityModal({ open, onClose, record, context, teamMembers, initialActivityType }: Props) {
  const [selectedType, setSelectedType] = useState<string | null>(initialActivityType || null);
  const [comments, setComments] = useState('');
  const [statusUpdate, setStatusUpdate] = useState('no_change');
  const createActivity = useCreateRenewalActivity();

  // Sync with initialActivityType when it changes
  useEffect(() => {
    if (initialActivityType) {
      setSelectedType(initialActivityType);
    }
  }, [initialActivityType, open]);

  // Listen for sidebar navigation to force close dialog
  useEffect(() => {
    const handleNavigation = () => {
      if (open) {
        handleClose();
      }
    };
    window.addEventListener('sidebar-navigation', handleNavigation);
    return () => window.removeEventListener('sidebar-navigation', handleNavigation);
  }, [open]);

  const handleSave = () => {
    if (!selectedType) return;
    
    let updateRecordStatus: WorkflowStatus | undefined;
    if (statusUpdate === 'pending') updateRecordStatus = 'pending';
    else if (statusUpdate === 'success') updateRecordStatus = 'success';
    else if (statusUpdate === 'unsuccessful') updateRecordStatus = 'unsuccessful';

    createActivity.mutate({
      renewalRecordId: record.id,
      agencyId: context.agencyId,
      activityType: selectedType as ActivityType,
      activityStatus: statusUpdate !== 'no_change' ? statusUpdate : undefined,
      subject: `${quickActions.find(a => a.type === selectedType)?.label}: ${record.first_name} ${record.last_name}`,
      comments: comments || undefined,
      displayName: context.displayName,
      userId: context.userId,
      updateRecordStatus,
    }, { onSuccess: handleClose });
  };

  const handleClose = () => {
    setSelectedType(null);
    setComments('');
    setStatusUpdate('no_change');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="bg-[#1a1f2e] border-gray-700 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Activity</DialogTitle>
          <DialogDescription className="sr-only">
            Log a contact activity for this renewal record
          </DialogDescription>
        </DialogHeader>
        
        {/* Quick Action Buttons - user must select one */}
        <div className="space-y-3">
          <Label>Activity Type</Label>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Button
                key={action.type}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedType(action.type)}
                className={cn(
                  "border-2 bg-transparent",
                  action.color,
                  selectedType === action.type && "ring-2 ring-offset-2 ring-offset-[#1a1f2e]"
                )}
              >
                <action.icon className="h-4 w-4 mr-1" />
                {action.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Comments - optional */}
        <div className="space-y-2">
          <Label>Comments (optional)</Label>
          <Textarea
            placeholder="Add notes about this activity..."
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            className="bg-[#0d1117] border-gray-700"
          />
        </div>

        {/* Update Status - optional */}
        <div className="space-y-2">
          <Label>Update Status</Label>
          <Select value={statusUpdate} onValueChange={setStatusUpdate}>
            <SelectTrigger className="bg-[#0d1117] border-gray-700">
              <SelectValue placeholder="No Status Change" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no_change">No Status Change</SelectItem>
              <SelectItem value="pending">Mark as Pending</SelectItem>
              <SelectItem value="success">Mark as Success</SelectItem>
              <SelectItem value="unsuccessful">Mark as Unsuccessful</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose()}>Cancel</Button>
          <Button 
            onClick={handleSave} 
            disabled={!selectedType || createActivity.isPending}
          >
            {createActivity.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
