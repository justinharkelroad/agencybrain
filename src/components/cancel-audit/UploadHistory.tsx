import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FileUp, Clock } from 'lucide-react';

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
  const { data: uploads, isLoading } = useQuery({
    queryKey: ['cancel-audit-uploads', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cancel_audit_uploads')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!agencyId,
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
            className="flex items-center justify-between p-2 rounded-md bg-muted/50"
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
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatRelativeTime(upload.created_at)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
