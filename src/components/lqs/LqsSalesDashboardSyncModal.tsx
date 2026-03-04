import { useCallback, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  invalidateLqsSalesSyncQueries,
  runLqsSalesDashboardSync,
  undoLqsSalesDashboardSync,
  type LqsSalesSyncRunResult,
} from '@/hooks/useLqsSalesDashboardSync';

interface LqsSalesDashboardSyncModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  sessionToken?: string | null;
  onSyncComplete?: (result: LqsSalesSyncRunResult) => void;
}

export function LqsSalesDashboardSyncModal({
  open,
  onOpenChange,
  agencyId,
  sessionToken,
  onSyncComplete,
}: LqsSalesDashboardSyncModalProps) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [progressText, setProgressText] = useState<string>('');
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);

  const getFriendlyError = useCallback((error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : fallback;
    const normalized = message.toLowerCase();
    if (
      normalized.includes('failed to fetch') ||
      normalized.includes('networkerror') ||
      normalized.includes('err_failed') ||
      normalized.includes('not_found')
    ) {
      return 'Sync service is not available in this environment yet. Please deploy the sync function, then try again.';
    }
    return message;
  }, []);

  const handleRunSync = useCallback(async () => {
    setRunning(true);
    setProgressText('Starting import...');

    try {
      const result = await runLqsSalesDashboardSync({
        agencyId,
        includeUnassigned: true,
        batchSize: 200,
        sessionToken,
        onProgress: (progress) => {
          setLastBatchId(progress.batchId);
          setProgressText(
            `Importing... (${progress.insertedSales} synced, ${progress.failedRows} failed, ${progress.skippedRows} skipped)`
          );
        },
      });

      await invalidateLqsSalesSyncQueries(queryClient);
      onSyncComplete?.(result);

      toast.success(
        `Import complete: ${result.insertedSales} synced, ${result.failedRows} failed, ${result.skippedRows} skipped.`
      );

      setLastBatchId(result.batchId);
      setProgressText('Import complete.');
      onOpenChange(false);
    } catch (error) {
      toast.error(getFriendlyError(error, 'Import failed.'));
      setProgressText('Import failed.');
    } finally {
      setRunning(false);
    }
  }, [agencyId, sessionToken, queryClient, onSyncComplete, getFriendlyError, onOpenChange]);

  const handleUndo = useCallback(async () => {
    if (!lastBatchId) {
      toast.error('No import available to undo.');
      return;
    }

    setUndoing(true);
    try {
      const result = await undoLqsSalesDashboardSync(agencyId, lastBatchId, sessionToken);
      await invalidateLqsSalesSyncQueries(queryClient);
      toast.success(`Undo complete: ${result.deleted_sales} removed.`);
      setProgressText('Last import undone.');
    } catch (error) {
      toast.error(getFriendlyError(error, 'Undo failed.'));
    } finally {
      setUndoing(false);
    }
  }, [agencyId, lastBatchId, sessionToken, queryClient, getFriendlyError]);

  const canRunSync = useMemo(() => !running && !undoing, [running, undoing]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import LQS Sales to Dashboard</DialogTitle>
          <DialogDescription>
            This imports all unsynced LQS sales history into your Sales Dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 text-sm text-muted-foreground">
            Motor Club is automatically skipped.
          </div>

          {progressText && <div className="text-sm text-muted-foreground">{progressText}</div>}
          {lastBatchId && <div className="text-xs text-muted-foreground">Import ID: {lastBatchId}</div>}

          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleUndo}
              disabled={!lastBatchId || running || undoing}
            >
              {undoing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              Undo Last Import
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running || undoing}>
                Close
              </Button>
              <Button onClick={handleRunSync} disabled={!canRunSync}>
                {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {running ? 'Importing...' : 'Import to Sales Dashboard'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
