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
import * as winbackApi from '@/lib/winbackApi';

interface WinbackUploadHistoryProps {
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

export function WinbackUploadHistory({ agencyId }: WinbackUploadHistoryProps) {
  const queryClient = useQueryClient();
  const isStaff = winbackApi.isStaffUser();

  const { data: uploads, isLoading } = useQuery({
    queryKey: ['winback-uploads', agencyId],
    queryFn: async () => {
      if (isStaff) {
        const result = await winbackApi.listUploads(agencyId);
        return result;
      }
      const { data, error } = await supabase
        .from('winback_uploads')
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
      await winbackApi.deleteUpload(uploadId, agencyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['winback-uploads'] });
      queryClient.invalidateQueries({ queryKey: ['winback-households'] });
      queryClient.invalidateQueries({ queryKey: ['winback-stats'] });
      queryClient.invalidateQueries({ queryKey: ['winback-policies'] });
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
        {uploads.map((upload: any) => (
          <div
            key={upload.id}
            className="flex items-center justify-between p-2 rounded-md bg-muted/50 group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">
                  {upload.filename || 'Unnamed file'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {upload.records_processed} records
                  {' • '}
                  {upload.records_new_households} new households
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
                      This will permanently delete this upload and all associated households, policies, and activities. This action cannot be undone.
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
