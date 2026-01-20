import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useUpdateRecordStatus } from '@/hooks/useCancelAuditActivities';
import { RecordStatus, CancelAuditRecord } from '@/types/cancel-audit';
import { sendCancelAuditToWinback } from '@/lib/sendToWinback';
import { sendStaffCancelToWinback } from '@/integrations/supabase/staff-winback-api';
import { getStaffSessionToken } from '@/lib/cancel-audit-api';
import { toast } from 'sonner';
import { Loader2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

interface StatusDropdownProps {
  recordId: string;
  currentStatus: RecordStatus;
  record?: CancelAuditRecord;
  onStatusChange?: (newStatus: RecordStatus) => void;
}

const STATUS_OPTIONS: { value: RecordStatus; label: string; color: string }[] = [
  { value: 'new', label: 'New', color: 'bg-gray-500' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-500' },
  { value: 'resolved', label: 'Resolved', color: 'bg-green-500' },
  { value: 'lost', label: 'Lost', color: 'bg-red-500' },
];

export function StatusDropdown({
  recordId,
  currentStatus,
  record,
  onStatusChange,
}: StatusDropdownProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showWinbackDialog, setShowWinbackDialog] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [isSendingToWinback, setIsSendingToWinback] = useState(false);
  const updateStatus = useUpdateRecordStatus();
  const queryClient = useQueryClient();

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === currentStatus) return;
    
    // If changing to "lost" and we have the full record, prompt for winback
    if (newStatus === 'lost' && record && !record.winback_household_id) {
      setPendingStatus(newStatus);
      setShowWinbackDialog(true);
      return;
    }
    
    // Otherwise just update status directly
    await performStatusUpdate(newStatus);
  };

  const performStatusUpdate = async (newStatus: string) => {
    setIsUpdating(true);
    
    try {
      await updateStatus.mutateAsync({
        recordId,
        status: newStatus,
      });
      
      toast.success('Status updated');
      onStatusChange?.(newStatus as RecordStatus);
    } catch (error: any) {
      toast.error('Failed to update status', {
        description: error.message || 'Please try again',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleWinbackConfirm = async () => {
    if (!pendingStatus || !record) return;
    
    setIsSendingToWinback(true);
    
    try {
      // First update the status
      await performStatusUpdate(pendingStatus);
      
      // Check if we're in the staff portal
      const staffToken = getStaffSessionToken();
      let result: { success: boolean; householdId?: string; error?: string };
      
      if (staffToken) {
        // Use edge function for staff users to bypass RLS
        result = await sendStaffCancelToWinback({ recordId: record.id });
      } else {
        // Use client-side function for owner/admin users
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
          description: 'Customer has been added to Win-Back for future follow-up',
        });
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['cancel-audit-records'] });
        queryClient.invalidateQueries({ queryKey: ['cancel-audit-activities'] });
        queryClient.invalidateQueries({ queryKey: ['winback'] });
      } else {
        toast.error('Failed to send to Win-Back', {
          description: result.error || 'Please try again',
        });
      }
    } catch (error: any) {
      toast.error('Failed to send to Win-Back', {
        description: error.message || 'Please try again',
      });
    } finally {
      setIsSendingToWinback(false);
      setShowWinbackDialog(false);
      setPendingStatus(null);
    }
  };

  const handleWinbackDecline = async () => {
    if (!pendingStatus) return;
    
    // Just update status without sending to winback
    await performStatusUpdate(pendingStatus);
    setShowWinbackDialog(false);
    setPendingStatus(null);
  };

  const currentOption = STATUS_OPTIONS.find(opt => opt.value === currentStatus);
  const alreadySentToWinback = currentStatus === 'lost' && record?.winback_household_id;

  return (
    <>
      <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
        <Select
          value={currentStatus}
          onValueChange={handleStatusChange}
          disabled={isUpdating || isSendingToWinback}
        >
          <SelectTrigger className="w-[130px] h-7 text-xs">
            {isUpdating || isSendingToWinback ? (
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{isSendingToWinback ? 'Sending...' : 'Updating...'}</span>
              </div>
            ) : (
              <SelectValue>
                <div className="flex items-center gap-1.5">
                  <div className={cn('h-2 w-2 rounded-full', currentOption?.color)} />
                  <span>{currentOption?.label}</span>
                </div>
              </SelectValue>
            )}
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <div className={cn('h-2 w-2 rounded-full', option.color)} />
                  <span>{option.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {alreadySentToWinback && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <ArrowRight className="h-3 w-3" />
            Winback
          </span>
        )}
      </div>

      <AlertDialog open={showWinbackDialog} onOpenChange={setShowWinbackDialog}>
        <AlertDialogContent>
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
