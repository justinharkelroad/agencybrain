import { useState, useEffect } from 'react';
import { Phone, Voicemail, MessageSquare, Mail, CheckCircle, Calendar, Send, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateRenewalActivity } from '@/hooks/useRenewalActivities';
import { useUpdateRenewalRecord } from '@/hooks/useRenewalRecords';
import { sendRenewalToWinback } from '@/lib/sendToWinback';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { RenewalRecord, RenewalUploadContext, ActivityType, WorkflowStatus } from '@/types/renewal';
import { cn } from '@/lib/utils';

interface Props { open: boolean; onClose: () => void; record: RenewalRecord; context: RenewalUploadContext; teamMembers: Array<{ id: string; name: string }>; initialActivityType?: string; }

// Contact activities - auto-set status to pending
const contactActions = [
  { type: 'call', label: 'Call', icon: Phone, color: 'border-blue-500 text-blue-400 hover:bg-blue-500/10' },
  { type: 'voicemail', label: 'Voicemail', icon: Voicemail, color: 'border-purple-500 text-purple-400 hover:bg-purple-500/10' },
  { type: 'text', label: 'Text', icon: MessageSquare, color: 'border-cyan-500 text-cyan-400 hover:bg-cyan-500/10' },
  { type: 'email', label: 'Email', icon: Mail, color: 'border-green-500 text-green-400 hover:bg-green-500/10' },
  { type: 'appointment', label: 'Appointment', icon: Calendar, color: 'border-orange-500 text-orange-400 hover:bg-orange-500/10' },
];

// Review actions - different outcomes
const reviewActions = [
  { type: 'review_done_success', label: 'Review Done - Successful', icon: CheckCircle, color: 'border-green-500 text-green-400 hover:bg-green-500/10', status: 'success' as WorkflowStatus },
  { type: 'review_done_winback', label: 'Review Done - Push to WinBack', icon: Send, color: 'border-red-500 text-red-400 hover:bg-red-500/10', status: 'unsuccessful' as WorkflowStatus },
];

export function ScheduleActivityModal({ open, onClose, record, context, teamMembers, initialActivityType }: Props) {
  const [selectedType, setSelectedType] = useState<string | null>(initialActivityType || null);
  const [comments, setComments] = useState('');
  const [sendingToWinback, setSendingToWinback] = useState(false);
  const createActivity = useCreateRenewalActivity();
  const updateRecord = useUpdateRenewalRecord();
  const queryClient = useQueryClient();

  // Find current user's team member ID for auto-assignment
  const currentUserTeamMemberId = context.staffMemberId ||
    teamMembers.find(m => m.name.toLowerCase().includes(context.displayName.toLowerCase()))?.id ||
    null;

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

    const isContactAction = contactActions.some(a => a.type === selectedType);
    const reviewAction = reviewActions.find(a => a.type === selectedType);

    // Determine status based on action type
    let updateRecordStatus: WorkflowStatus | undefined;
    let activityTypeForDb: ActivityType;
    let actionLabel: string;

    if (isContactAction) {
      // Contact activities → set to pending, assign to current user
      updateRecordStatus = 'pending';
      activityTypeForDb = selectedType as ActivityType;
      actionLabel = contactActions.find(a => a.type === selectedType)?.label || selectedType;
    } else if (reviewAction) {
      // Review actions
      updateRecordStatus = reviewAction.status;
      activityTypeForDb = 'review_done';
      actionLabel = reviewAction.label;

      // Handle WinBack push
      if (selectedType === 'review_done_winback') {
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

          if (!result.success) {
            toast.error(result.error || 'Failed to send to Win-Back');
            setSendingToWinback(false);
            return;
          }
        } catch (error) {
          toast.error('Failed to send to Win-Back');
          setSendingToWinback(false);
          return;
        }
        setSendingToWinback(false);
      }
    } else {
      activityTypeForDb = selectedType as ActivityType;
      actionLabel = selectedType;
    }

    // Log the activity
    createActivity.mutate({
      renewalRecordId: record.id,
      agencyId: context.agencyId,
      activityType: activityTypeForDb,
      subject: `${actionLabel}: ${record.first_name} ${record.last_name}`,
      comments: comments || undefined,
      displayName: context.displayName,
      userId: context.userId,
      updateRecordStatus,
      assignedTeamMemberId: currentUserTeamMemberId || undefined,
    }, {
      onSuccess: () => {
        // Also update assignment on the record if we have a team member ID
        if (currentUserTeamMemberId && record.assigned_team_member_id !== currentUserTeamMemberId) {
          updateRecord.mutate({
            id: record.id,
            updates: { assigned_team_member_id: currentUserTeamMemberId },
            displayName: context.displayName,
            userId: context.userId,
            silent: true,
          });
        }

        // Invalidate queries for WinBack if we pushed there
        if (selectedType === 'review_done_winback') {
          queryClient.invalidateQueries({ queryKey: ['renewal-records'] });
          toast.success('Sent to Win-Back HQ');
        }

        handleClose();
      }
    });
  };

  const handleClose = () => {
    setSelectedType(null);
    setComments('');
    setSendingToWinback(false);
    onClose();
  };

  const allActions = [...contactActions, ...reviewActions];

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

        {/* Contact Activities */}
        <div className="space-y-3">
          <Label>Contact Activity</Label>
          <p className="text-xs text-muted-foreground -mt-1">Sets status to Pending & assigns to you</p>
          <div className="flex flex-wrap gap-2">
            {contactActions.map((action) => (
              <Button
                key={action.type}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedType(action.type)}
                disabled={isSaving}
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

        {/* Review Actions */}
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
                disabled={isSaving}
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
            disabled={isSaving}
            className="bg-[#0d1117] border-gray-700"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose()} disabled={isSaving}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={!selectedType || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {sendingToWinback ? 'Sending to WinBack...' : 'Saving...'}
              </>
            ) : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
