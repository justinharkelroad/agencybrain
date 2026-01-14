import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Undo2, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';
import { callCancelAuditApi, getStaffSessionToken, isStaffContext } from '@/lib/cancel-audit-api';
import { formatCentsToCurrency } from '@/lib/cancel-audit-utils';
import { supabase } from '@/integrations/supabase/client';

interface SavedPaymentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string | null;
  weekStart: string; // yyyy-MM-dd
  weekEnd: string; // yyyy-MM-dd
}

interface SavedPayment {
  activityId: string;
  recordId: string;
  householdKey: string;
  customerName: string;
  policyNumber: string;
  productName: string;
  premiumCents: number;
  loggedBy: string;
  notes: string | null;
  createdAt: string;
}

export function SavedPaymentsDialog({
  open,
  onOpenChange,
  agencyId,
  weekStart,
  weekEnd,
}: SavedPaymentsDialogProps) {
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const staffToken = getStaffSessionToken();
  const inStaffContext = isStaffContext();

  // Fetch saved payments for staff users
  const { data: paymentsData, isLoading, refetch } = useQuery({
    queryKey: ['saved-payments', agencyId, weekStart, weekEnd],
    queryFn: async (): Promise<{ payments: SavedPayment[] }> => {
      if (!agencyId || !staffToken) {
        throw new Error('Missing agencyId or staff token');
      }

      const result = await callCancelAuditApi({
        operation: 'get_saved_payments',
        params: {
          agency_id: agencyId,
          weekStart,
          weekEnd,
        },
        sessionToken: staffToken,
      });

      return result as { payments: SavedPayment[] };
    },
    enabled: open && !!agencyId && inStaffContext && !!staffToken,
  });

  // For regular users (non-staff), fetch directly from Supabase
  const { data: regularPayments, isLoading: loadingRegular } = useQuery({
    queryKey: ['saved-payments-regular', agencyId, weekStart, weekEnd],
    queryFn: async (): Promise<SavedPayment[]> => {
      if (!agencyId) return [];

      const weekStartISO = `${weekStart}T00:00:00.000Z`;
      const weekEndISO = `${weekEnd}T23:59:59.999Z`;

      // Get payment_made activities for this week
      const { data: activities, error: activitiesError } = await supabase
        .from('cancel_audit_activities')
        .select('id, record_id, household_key, user_display_name, notes, created_at')
        .eq('agency_id', agencyId)
        .eq('activity_type', 'payment_made')
        .gte('created_at', weekStartISO)
        .lte('created_at', weekEndISO)
        .order('created_at', { ascending: false });

      if (activitiesError) throw activitiesError;
      if (!activities || activities.length === 0) return [];

      // Get record details
      const recordIds = [...new Set(activities.map(a => a.record_id))];
      const { data: records, error: recordsError } = await supabase
        .from('cancel_audit_records')
        .select('id, insured_first_name, insured_last_name, policy_number, premium_cents, product_name')
        .in('id', recordIds);

      if (recordsError) throw recordsError;

      const recordMap = new Map(records?.map(r => [r.id, r]) || []);

      return activities.map(activity => {
        const record = recordMap.get(activity.record_id) || {};
        return {
          activityId: activity.id,
          recordId: activity.record_id,
          householdKey: activity.household_key,
          customerName: `${record.insured_first_name || ''} ${record.insured_last_name || ''}`.trim() || 'Unknown',
          policyNumber: record.policy_number || 'N/A',
          productName: record.product_name || 'N/A',
          premiumCents: record.premium_cents || 0,
          loggedBy: activity.user_display_name || 'Unknown',
          notes: activity.notes,
          createdAt: activity.created_at,
        };
      });
    },
    enabled: open && !!agencyId && !inStaffContext,
  });

  const payments = inStaffContext ? (paymentsData?.payments || []) : (regularPayments || []);
  const loading = inStaffContext ? isLoading : loadingRegular;

  const handleUndo = async (payment: SavedPayment) => {
    setUndoingId(payment.activityId);
    setError(null);
    setSuccessMessage(null);

    try {
      if (inStaffContext && staffToken) {
        // Staff user - use edge function
        await callCancelAuditApi({
          operation: 'undo_payment',
          params: {
            activityId: payment.activityId,
            recordId: payment.recordId,
            householdKey: payment.householdKey,
          },
          sessionToken: staffToken,
        });
      } else {
        // Regular user - delete directly
        const { error: deleteError } = await supabase
          .from('cancel_audit_activities')
          .delete()
          .eq('id', payment.activityId);

        if (deleteError) throw deleteError;

        // Update record status back to in_progress
        const { error: updateError } = await supabase
          .from('cancel_audit_records')
          .update({ status: 'in_progress', updated_at: new Date().toISOString() })
          .eq('id', payment.recordId);

        if (updateError) throw updateError;
      }

      setSuccessMessage(`Payment undone for ${payment.customerName}`);

      // Refresh the data
      refetch();

      // Invalidate hero stats to update the "Saved This Week" value
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-hero-stats-staff'] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-hero-saved-current'] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-records'] });

    } catch (err) {
      console.error('Error undoing payment:', err);
      setError(err instanceof Error ? err.message : 'Failed to undo payment');
    } finally {
      setUndoingId(null);
    }
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, h:mm a');
  };

  const totalSaved = payments.reduce((sum, p) => sum + p.premiumCents, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Saved Payments This Week
          </DialogTitle>
          <DialogDescription>
            {payments.length > 0 && (
              <span className="text-emerald-600 font-medium">
                Total: {formatCentsToCurrency(totalSaved)}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-emerald-600">{successMessage}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 rounded-lg border border-border">
                  <Skeleton className="h-5 w-48 mb-2" />
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No payments logged this week</p>
            </div>
          ) : (
            payments.map((payment) => (
              <div
                key={payment.activityId}
                className="p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground truncate">
                        {payment.customerName}
                      </span>
                      <span className="text-emerald-600 font-semibold whitespace-nowrap">
                        {formatCentsToCurrency(payment.premiumCents)}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <div>Policy: {payment.policyNumber}</div>
                      <div className="truncate">{payment.productName}</div>
                      <div className="text-xs">
                        Logged by {payment.loggedBy} on {formatDateTime(payment.createdAt)}
                      </div>
                      {payment.notes && (
                        <div className="text-xs italic mt-1 truncate">
                          "{payment.notes}"
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUndo(payment)}
                    disabled={undoingId === payment.activityId}
                    className="flex-shrink-0"
                  >
                    <Undo2 className="h-4 w-4 mr-1" />
                    {undoingId === payment.activityId ? 'Undoing...' : 'Undo'}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
