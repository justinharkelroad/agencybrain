import { useState, useEffect } from 'react';
import { Phone, Voicemail, MessageSquare, Mail, CheckCircle, Calendar, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateRenewalActivity } from '@/hooks/useRenewalActivities';
import { useUpdateRenewalRecord } from '@/hooks/useRenewalRecords';
import { useQueryClient } from '@tanstack/react-query';
import type { RenewalRecord, RenewalUploadContext, ActivityType, WorkflowStatus } from '@/types/renewal';
import { cn } from '@/lib/utils';

interface Props { open: boolean; onClose: () => void; record: RenewalRecord; context: RenewalUploadContext; teamMembers: Array<{ id: string; name: string }>; initialActivityType?: string; }

const contactActions = [
  { type: 'call', label: 'Call', icon: Phone, color: 'border-blue-500 text-blue-400 hover:bg-blue-500/10' },
  { type: 'voicemail', label: 'Voicemail', icon: Voicemail, color: 'border-purple-500 text-purple-400 hover:bg-purple-500/10' },
  { type: 'text', label: 'Text', icon: MessageSquare, color: 'border-cyan-500 text-cyan-400 hover:bg-cyan-500/10' },
  { type: 'email', label: 'Email', icon: Mail, color: 'border-green-500 text-green-400 hover:bg-green-500/10' },
  { type: 'appointment', label: 'Appointment', icon: Calendar, color: 'border-orange-500 text-orange-400 hover:bg-orange-500/10' },
];

const reviewActions = [
  { type: 'review_successful', label: 'Review Done - Successful', icon: CheckCircle, color: 'border-green-500 text-green-400 hover:bg-green-500/10', targetStatus: 'success' as WorkflowStatus },
  { type: 'review_winback', label: 'Review Done - Push to WinBack', icon: XCircle, color: 'border-red-500 text-red-400 hover:bg-red-500/10', targetStatus: 'unsuccessful' as WorkflowStatus },
];

export function ScheduleActivityModal({ open, onClose, record, context, teamMembers, initialActivityType }: Props) {
  const [selectedType, setSelectedType] = useState<string | null>(initialActivityType || null);
  const [comments, setComments] = useState('');
  const [sendingToWinback, setSendingToWinback] = useState(false);
  const createActivity = useCreateRenewalActivity();
  const updateRecord = useUpdateRenewalRecord();
  const queryClient = useQueryClient();

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

  const handleSave = async () => {
    if (!selectedType) return;
    
    // Determine activity type, status update, and label based on selection
    const isContactAction = contactActions.some(a => a.type === selectedType);
    const reviewAction = reviewActions.find(a => a.type === selectedType);
    
    let activityType: ActivityType;
    let updateRecordStatus: WorkflowStatus | undefined;
    let activityLabel: string;
    
    if (isContactAction) {
      // Contact actions: set status to pending and assign to current user
      activityType = selectedType as ActivityType;
      updateRecordStatus = 'pending';
      activityLabel = contactActions.find(a => a.type === selectedType)?.label || selectedType;
    } else if (reviewAction) {
      // Review actions: use the targetStatus from the action
      activityType = 'review_done' as ActivityType;
      updateRecordStatus = reviewAction.targetStatus;
      activityLabel = reviewAction.label;
    } else {
      return;
    }

    // Handle WinBack flow
    if (selectedType === 'review_winback') {
      setSendingToWinback(true);
      try {
        // Update record status to unsuccessful
        await updateRecord.mutateAsync({
          id: record.id,
          updates: { current_status: 'unsuccessful' },
          displayName: context.displayName,
          userId: context.userId,
        });
        
        // Log the activity
        createActivity.mutate({
          renewalRecordId: record.id,
          agencyId: context.agencyId,
          activityType,
          activityStatus: 'unsuccessful',
          subject: `${activityLabel}: ${record.first_name} ${record.last_name}`,
          comments: comments || undefined,
          displayName: context.displayName,
          userId: context.userId,
          updateRecordStatus,
        }, { 
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['renewal-records'] });
            handleClose();
          } 
        });
      } finally {
        setSendingToWinback(false);
      }
      return;
    }

    // For contact actions, also assign to current user if not already assigned
    const shouldAssign = isContactAction && !record.assigned_team_member_id && context.staffMemberId;

    createActivity.mutate({
      renewalRecordId: record.id,
      agencyId: context.agencyId,
      activityType,
      activityStatus: updateRecordStatus,
      subject: `${activityLabel}: ${record.first_name} ${record.last_name}`,
      comments: comments || undefined,
      displayName: context.displayName,
      userId: context.userId,
      updateRecordStatus,
      assignedTeamMemberId: shouldAssign ? context.staffMemberId : undefined,
    }, { onSuccess: handleClose });
  };

  const handleClose = () => {
    setSelectedType(null);
    setComments('');
    setSendingToWinback(false);
    onClose();
  };

  const isSaving = createActivity.isPending || sendingToWinback;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="bg-[#1a1f2e] border-gray-700 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Activity</DialogTitle>
          <DialogDescription className="sr-only">
            Log a contact activity for this renewal record
          </DialogDescription>
        </DialogHeader>
        
        {/* Contact Activity Section */}
        <div className="space-y-3">
          <div>
            <Label>Contact Activity</Label>
            <p className="text-xs text-muted-foreground mt-1">Sets status to Pending & assigns to you</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {contactActions.map((action) => (
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

        {/* Review Outcome Section */}
        <div className="space-y-3">
          <Label>Review Outcome</Label>
          <div className="flex flex-wrap gap-2">
            {reviewActions.map((action) => (
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

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose()}>Cancel</Button>
          <Button 
            onClick={handleSave} 
            disabled={!selectedType || isSaving}
          >
            {isSaving ? (sendingToWinback ? 'Sending to WinBack...' : 'Saving...') : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
