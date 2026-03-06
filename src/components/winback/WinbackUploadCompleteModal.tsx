import { CheckCircle, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { WinbackUploadCompletionData } from '@/hooks/useWinbackBackgroundUpload';

interface WinbackUploadCompleteModalProps {
  open: boolean;
  onClose: () => void;
  data: WinbackUploadCompletionData | null;
}

export function WinbackUploadCompleteModal({ open, onClose, data }: WinbackUploadCompleteModalProps) {
  if (!data) return null;

  const hasSkipped = data.skipped > 0;
  const crossMatch = data.crossMatch;
  const hasCrossMatch = crossMatch && (
    (crossMatch.cancel_audit_linked || 0) > 0 ||
    (crossMatch.cancel_audit_demoted || 0) > 0 ||
    (crossMatch.renewals_linked || 0) > 0 ||
    (crossMatch.renewals_demoted || 0) > 0 ||
    (crossMatch.contacts_linked || 0) > 0
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasSkipped ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
            {hasSkipped ? 'Upload Completed with Issues' : 'Termination Upload Complete'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Summary of the termination upload results
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Records summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-2xl font-bold">{data.processed}</p>
              <p className="text-xs text-muted-foreground">Records Processed</p>
            </div>
            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-2xl font-bold">{data.totalHouseholds}</p>
              <p className="text-xs text-muted-foreground">Unique Households</p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="rounded-lg border p-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">New households</span>
              <span className="font-medium">{data.newHouseholds}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Existing households updated</span>
              <span className="font-medium">{data.totalHouseholds - data.newHouseholds}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">New policies added</span>
              <span className="font-medium">{data.newPolicies}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Policies updated</span>
              <span className="font-medium">{data.updated}</span>
            </div>
            {hasSkipped && (
              <div className="flex justify-between text-sm text-amber-600">
                <span>Skipped (errors)</span>
                <span className="font-medium">{data.skipped}</span>
              </div>
            )}
          </div>

          {/* Cross-match results */}
          {hasCrossMatch && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/50 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-medium text-purple-800 dark:text-purple-200">
                <ArrowRightLeft className="h-4 w-4" />
                Auto-linked to other workflows
              </div>
              <div className="space-y-1">
                {(crossMatch!.cancel_audit_linked || 0) > 0 && (
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    {crossMatch!.cancel_audit_linked} cancel audit record{crossMatch!.cancel_audit_linked === 1 ? '' : 's'} linked to win-back
                  </p>
                )}
                {(crossMatch!.cancel_audit_demoted || 0) > 0 && (
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    {crossMatch!.cancel_audit_demoted} cancel audit record{crossMatch!.cancel_audit_demoted === 1 ? '' : 's'} auto-moved to Lost
                  </p>
                )}
                {(crossMatch!.renewals_linked || 0) > 0 && (
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    {crossMatch!.renewals_linked} renewal record{crossMatch!.renewals_linked === 1 ? '' : 's'} linked to win-back
                  </p>
                )}
                {(crossMatch!.renewals_demoted || 0) > 0 && (
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    {crossMatch!.renewals_demoted} renewal record{crossMatch!.renewals_demoted === 1 ? '' : 's'} auto-moved to Unsuccessful
                  </p>
                )}
                {(crossMatch!.contacts_linked || 0) > 0 && (
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    {crossMatch!.contacts_linked} contact{crossMatch!.contacts_linked === 1 ? '' : 's'} linked to win-back households
                  </p>
                )}
              </div>
            </div>
          )}

          <Button onClick={onClose} className="w-full">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
