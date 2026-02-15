import { useState } from 'react';
import { History, Loader2, Download, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import type { CallGapUpload } from '@/hooks/useCallGapData';

interface CallGapsHistoryProps {
  uploads: CallGapUpload[];
  isLoading: boolean;
  onLoad: (uploadId: string) => void;
  onDelete: (uploadId: string) => void;
  loadingUploadId: string | null;
  deletingUploadId: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return '—';
  const fmt = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };
  if (!end || start === end) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function CallGapsHistory({
  uploads,
  isLoading,
  onLoad,
  onDelete,
  loadingUploadId,
  deletingUploadId,
}: CallGapsHistoryProps) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading history...
        </CardContent>
      </Card>
    );
  }

  if (uploads.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          No previous uploads. Upload a file below to get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Upload History
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 font-medium">Uploaded</th>
                  <th className="text-left py-2 font-medium">File</th>
                  <th className="text-left py-2 font-medium">Source</th>
                  <th className="text-right py-2 font-medium">Records</th>
                  <th className="text-left py-2 font-medium">Date Range</th>
                  <th className="text-right py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((upload) => (
                  <tr key={upload.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2 text-muted-foreground whitespace-nowrap">
                      {formatDate(upload.created_at)}
                    </td>
                    <td className="py-2 max-w-[200px] truncate" title={upload.file_name}>
                      {upload.file_name}
                    </td>
                    <td className="py-2">
                      <Badge variant="outline" className="text-xs">
                        {upload.source_format === 'ringcentral' ? 'RingCentral' : 'Ricochet'}
                      </Badge>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {upload.record_count}
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      {formatDateRange(upload.date_range_start, upload.date_range_end)}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onLoad(upload.id)}
                          disabled={!!loadingUploadId || !!deletingUploadId}
                        >
                          {loadingUploadId === upload.id ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Download className="h-3 w-3 mr-1" />
                          )}
                          Load
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(upload.id)}
                          disabled={!!loadingUploadId || !!deletingUploadId}
                        >
                          {deletingUploadId === upload.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Upload</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this upload and all its call records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  onDelete(deleteTarget);
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
