import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2 } from 'lucide-react';
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
import { useLogActivity, useUpdateRecordStatus } from '@/hooks/useCancelAuditActivities';
import { sendCancelAuditToWinback } from '@/lib/sendToWinback';
import { sendStaffCancelToWinback } from '@/integrations/supabase/staff-winback-api';
import { getStaffSessionToken } from '@/lib/cancel-audit-api';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { RecordWithActivityCount } from '@/hooks/useCancelAuditRecords';
import { cn } from '@/lib/utils';

interface QuickDispositionButtonsProps {
  record: RecordWithActivityCount;
  agencyId: string;
  userId?: string;
  staffMemberId?: string;
  userDisplayName: string;
}

export function QuickDispositionButtons({
  record,
  agencyId,
  userId,
  staffMemberId,
  userDisplayName,
}: QuickDispositionButtonsProps) {
  const [isWonLoading, setIsWonLoading] = useState(false);
  const [isLostLoading, setIsLostLoading] = useState(false);
  const [showWinbackDialog, setShowWinbackDialog] = useState(false);
  const [isSendingToWinback, setIsSendingToWinback] = useState(false);
  const logActivity = useLogActivity();
  const updateStatus = useUpdateRecordStatus();
  const queryClient = useQueryClient();

  const isBusy = isWonLoading || isLostLoading || isSendingToWinback;

  const handleWon = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsWonLoading(true);
    try {
      const result = await logActivity.mutateAsync({
        agencyId,
        recordId: record.id,
        householdKey: record.household_key,
        activityType: 'payment_made',
        userId,
        staffMemberId,
        userDisplayName,
      });

      const remaining = result?.remainingPolicies || [];
      if (remaining.length > 0) {
        const policyNames = remaining.map((r: any) => r.product_name || 'Unknown').join(', ');
        toast.success('Payment recorded!', {
          description: `${record.product_name || 'Policy'} marked as saved. Still in cancel status: ${policyNames}`,
          duration: 5000,
        });
      } else {
        toast.success('Payment recorded!', {
          description: 'Policy marked as saved.',
        });
      }
    } catch (error: any) {
      toast.error('Failed to mark as won', {
        description: error.message || 'Please try again',
      });
    } finally {
      setIsWonLoading(false);
    }
  };

  const handleLost = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (record.winback_household_id) {
      // Already sent to winback, just mark lost
      await performLostUpdate();
    } else {
      setShowWinbackDialog(true);
    }
  };

  const performLostUpdate = async () => {
    setIsLostLoading(true);
    try {
      await updateStatus.mutateAsync({
        recordId: record.id,
        status: 'lost',
      });
      toast.success('Marked as lost');
    } catch (error: any) {
      toast.error('Failed to mark as lost', {
        description: error.message || 'Please try again',
      });
    } finally {
      setIsLostLoading(false);
    }
  };

  const handleWinbackConfirm = async () => {
    setIsSendingToWinback(true);

    // Step 1: Mark as lost
    try {
      await updateStatus.mutateAsync({
        recordId: record.id,
        status: 'lost',
      });
    } catch (error: any) {
      toast.error('Failed to mark as lost', {
        description: error.message || 'Please try again',
      });
      setIsSendingToWinback(false);
      setShowWinbackDialog(false);
      return;
    }

    // Step 2: Send to winback
    try {
      const staffToken = getStaffSessionToken();
      let result: { success: boolean; householdId?: string; error?: string };

      if (staffToken) {
        result = await sendStaffCancelToWinback({ recordId: record.id });
      } else {
        result = await sendCancelAuditToWinback({
          id: record.id,
          agency_id: record.agency_id,
          insured_first_name: record.insured_first_name,
          insured_last_name: record.insured_last_name,
          insured_email: record.insured_email,
          insured_phone: record.insured_phone,
          policy_number: record.policy_number,
          product_name: record.product_name,
          premium_cents: record.premium_cents,
          cancel_date: record.cancel_date,
          pending_cancel_date: record.pending_cancel_date,
          agent_number: record.agent_number,
          household_key: record.household_key,
        });
      }

      if (result.success) {
        toast.success('Sent to Win-Back', {
          description: 'Customer added to Win-Back for future follow-up',
        });
        queryClient.invalidateQueries({ queryKey: ['cancel-audit-records'] });
        queryClient.invalidateQueries({ queryKey: ['cancel-audit-activities'] });
        queryClient.invalidateQueries({ queryKey: ['winback'] });
      } else {
        toast.error('Failed to send to Win-Back', {
          description: result.error || 'Status was updated to lost.',
        });
      }
    } catch (error: any) {
      toast.error('Failed to send to Win-Back', {
        description: error.message || 'Status was updated to lost.',
      });
    } finally {
      setIsSendingToWinback(false);
      setShowWinbackDialog(false);
    }
  };

  const handleWinbackDecline = async () => {
    setShowWinbackDialog(false);
    await performLostUpdate();
  };

  return (
    <>
      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 px-2 text-xs border bg-green-500/15 hover:bg-green-500/25 text-green-600 dark:text-green-400 border-green-500/50 dark:border-green-500/30',
            isBusy && 'opacity-50 cursor-not-allowed'
          )}
          onClick={handleWon}
          disabled={isBusy}
          title="Mark as won (payment made)"
        >
          {isWonLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Check className="h-3.5 w-3.5 mr-1" />
              Won
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 px-2 text-xs border bg-red-500/15 hover:bg-red-500/25 text-red-600 dark:text-red-400 border-red-500/50 dark:border-red-500/30',
            isBusy && 'opacity-50 cursor-not-allowed'
          )}
          onClick={handleLost}
          disabled={isBusy}
          title="Mark as lost"
        >
          {isLostLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <X className="h-3.5 w-3.5 mr-1" />
              Lost
            </>
          )}
        </Button>
      </div>

      <AlertDialog open={showWinbackDialog} onOpenChange={setShowWinbackDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Send to Win-Back?</AlertDialogTitle>
            <AlertDialogDescription>
              This customer is being marked as lost. Would you like to add them to
              Win-Back for future follow-up when their policy with the competitor
              comes up for renewal?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleWinbackDecline} disabled={isSendingToWinback}>
              No, just mark as lost
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleWinbackConfirm} disabled={isSendingToWinback}>
              {isSendingToWinback ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Yes, send to Win-Back'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
