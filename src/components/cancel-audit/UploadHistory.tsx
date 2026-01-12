import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FileUp, Clock, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface UploadHistoryProps {
  agencyId: string;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function UploadHistory({ agencyId }: UploadHistoryProps) {
  const queryClient = useQueryClient();
  
  const { data: uploads, isLoading } = useQuery({
    queryKey: ['cancel-audit-uploads', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cancel_audit_uploads')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!agencyId,
  });

  const deleteUpload = useMutation({
    mutationFn: async (uploadId: string) => {
      // Get record ids for this upload
      const { data: records, error: fetchError } = await supabase
        .from('cancel_audit_records')
        .select('id')
        .eq('last_upload_id', uploadId);

      if (fetchError) throw fetchError;

      const recordIds = (records || []).map((r) => r.id);

      // Delete activities first (avoids FK constraint issues + keeps stats consistent)
      if (recordIds.length > 0) {
        const { error: activitiesError } = await supabase
          .from('cancel_audit_activities')
          .delete()
          .in('record_id', recordIds);

        if (activitiesError) throw activitiesError;
      }

      // Then delete all records associated with this upload
      const { error: recordsError } = await supabase
        .from('cancel_audit_records')
        .delete()
        .eq('last_upload_id', uploadId);

      if (recordsError) throw recordsError;

      // Then delete the upload record itself
      const { error: uploadError } = await supabase
        .from('cancel_audit_uploads')
        .delete()
        .eq('id', uploadId);

      if (uploadError) throw uploadError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-uploads'] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-records'] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-counts'] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-activity-summary'] });
      // Invalidate Hero Stats queries
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          typeof query.queryKey[0] === 'string' &&
          query.queryKey[0].startsWith('cancel-audit-hero-')
      });
      toast.success('Upload and associated records deleted');
    },
    onError: (err: any) => {
      toast.error('Failed to delete upload', {
        description: err?.message || 'Please try again',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">Loading history...</div>
    );
  }

  if (!uploads || uploads.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">No uploads yet</div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Clock className="h-4 w-4 text-muted-foreground" />
        Recent Uploads
      </h4>
      <div className="space-y-2">
        {uploads.map(upload => (
          <div 
            key={upload.id}
            className="flex items-center justify-between p-2 rounded-md bg-muted/50 group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">
                  {upload.file_name || 'Unnamed file'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {upload.report_type === 'cancellation' ? 'Cancellation' : 'Pending Cancel'}
                  {' • '}
                  {upload.records_processed} records
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatRelativeTime(upload.created_at)}
              </span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    disabled={deleteUpload.isPending}
                  >
                    {deleteUpload.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete upload?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this upload and all {upload.records_processed} associated records. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteUpload.mutate(upload.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
