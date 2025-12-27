import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Phone, 
  Voicemail, 
  MessageSquare, 
  Mail, 
  MessageCircle, 
  DollarSign, 
  Handshake, 
  StickyNote,
  Loader2 
} from 'lucide-react';
import { ActivityType, CancelAuditRecord, ACTIVITY_LABELS } from '@/types/cancel-audit';
import { useLogActivity } from '@/hooks/useCancelAuditActivities';
import { ActivityNoteInput } from './ActivityNoteInput';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface QuickActionsProps {
  record: CancelAuditRecord;
  agencyId: string;
  userId?: string;
  staffMemberId?: string;
  userDisplayName: string;
  onActivityLogged?: () => void;
}

const ACTION_BUTTON_STYLES: Record<ActivityType, string> = {
  attempted_call: 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30',
  voicemail_left: 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/30',
  text_sent: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  email_sent: 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/30',
  spoke_with_client: 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  payment_made: 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/30',
  payment_promised: 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  note: 'bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const ACTION_ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  attempted_call: Phone,
  voicemail_left: Voicemail,
  text_sent: MessageSquare,
  email_sent: Mail,
  spoke_with_client: MessageCircle,
  payment_made: DollarSign,
  payment_promised: Handshake,
  note: StickyNote,
};

const ACTION_SHORT_LABELS: Record<ActivityType, string> = {
  attempted_call: 'Call',
  voicemail_left: 'Voicemail',
  text_sent: 'Text',
  email_sent: 'Email',
  spoke_with_client: 'Spoke',
  payment_made: 'Paid',
  payment_promised: 'Promised',
  note: 'Note',
};

const ACTIVITY_ORDER: ActivityType[] = [
  'attempted_call',
  'voicemail_left',
  'text_sent',
  'email_sent',
  'spoke_with_client',
  'payment_made',
  'payment_promised',
  'note',
];

export function QuickActions({
  record,
  agencyId,
  userId,
  staffMemberId,
  userDisplayName,
  onActivityLogged,
}: QuickActionsProps) {
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [loadingAction, setLoadingAction] = useState<ActivityType | null>(null);
  const logActivity = useLogActivity();

  const handleLogActivity = async (activityType: ActivityType, notes?: string) => {
    if (activityType === 'note' && !showNoteInput) {
      setShowNoteInput(true);
      return;
    }

    setLoadingAction(activityType);

    try {
      await logActivity.mutateAsync({
        agencyId,
        recordId: record.id,
        householdKey: record.household_key,
        activityType,
        notes,
        userId,
        staffMemberId,
        userDisplayName,
      });

      // Show appropriate toast
      if (activityType === 'payment_made') {
        toast.success('🎉 Payment recorded!', {
          description: 'Great job saving this policy!',
        });
      } else if (activityType === 'payment_promised') {
        toast.success('Payment promised logged', {
          description: 'Follow up if not received',
        });
      } else {
        toast.success('Activity logged');
      }

      setShowNoteInput(false);
      onActivityLogged?.();
    } catch (error: any) {
      toast.error('Failed to log activity', {
        description: error.message || 'Please try again',
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSaveNote = (note: string) => {
    handleLogActivity('note', note);
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-muted-foreground">Quick Actions</h4>
      
      <div className="flex flex-wrap gap-2">
        {ACTIVITY_ORDER.map((activityType) => {
          const Icon = ACTION_ICONS[activityType];
          const isLoading = loadingAction === activityType;
          const isDisabled = loadingAction !== null;
          
          return (
            <Button
              key={activityType}
              variant="outline"
              size="sm"
              className={cn(
                'border transition-colors',
                ACTION_BUTTON_STYLES[activityType],
                isDisabled && 'opacity-50 cursor-not-allowed'
              )}
              onClick={(e) => {
                e.stopPropagation();
                handleLogActivity(activityType);
              }}
              disabled={isDisabled}
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Icon className="h-3.5 w-3.5 mr-1.5" />
              )}
              {ACTION_SHORT_LABELS[activityType]}
            </Button>
          );
        })}
      </div>

      {showNoteInput && (
        <div onClick={(e) => e.stopPropagation()}>
          <ActivityNoteInput
            onSave={handleSaveNote}
            onCancel={() => setShowNoteInput(false)}
            isLoading={loadingAction === 'note'}
          />
        </div>
      )}
    </div>
  );
}
