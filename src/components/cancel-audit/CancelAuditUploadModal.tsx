import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileSpreadsheet, AlertCircle, X, CheckCircle2, Loader2 } from 'lucide-react';
import { HowItWorksModal } from '@/components/HowItWorksModal';
import { parseCancelAuditExcel, type ParseResult } from '@/lib/cancel-audit-parser';
import { useCancelAuditBackgroundUpload } from '@/hooks/useCancelAuditBackgroundUpload';
import type { ReportType } from '@/types/cancel-audit';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface CancelAuditUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  userId: string | null;
  staffMemberId: string | null;
  displayName: string;
  onUploadComplete: () => void;
}

export function CancelAuditUploadModal({
  open,
  onOpenChange,
  agencyId,
  userId,
  staffMemberId,
  displayName,
  onUploadComplete,
}: CancelAuditUploadModalProps) {
  const [reportType, setReportType] = useState<ReportType | ''>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const { startUpload, uploadProgress, resetProgress } = useCancelAuditBackgroundUpload();

  const isUploading = uploadProgress.phase === 'uploading' || uploadProgress.phase === 'finalizing';
  const isComplete = uploadProgress.phase === 'complete';
  const isError = uploadProgress.phase === 'error';

  // Block sidebar navigation during upload
  useEffect(() => {
    const handleNavigation = () => {
      if (open && !isUploading) {
        handleClose();
      }
      // If uploading, do NOT close — user must stay on page
    };
    window.addEventListener('sidebar-navigation', handleNavigation);
    return () => window.removeEventListener('sidebar-navigation', handleNavigation);
  }, [open, isUploading]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.name.endsWith('.xlsx')) {
        setSelectedFile(file);
        setParseErrors([]);
      } else {
        setParseErrors(['Please select an Excel file (.xlsx format only)']);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 1,
    multiple: false,
    disabled: isUploading,
  });

  const handleUpload = async () => {
    if (!selectedFile || !reportType) return;

    setParseErrors([]);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const parseResult: ParseResult = parseCancelAuditExcel(arrayBuffer, reportType);

      if (!parseResult.success) {
        setParseErrors(parseResult.errors);
        return;
      }

      if (parseResult.records.length === 0) {
        setParseErrors(['No valid records found in the file']);
        return;
      }

      // Start upload — modal stays open to show progress
      await startUpload(
        parseResult.records,
        reportType,
        selectedFile.name,
        { agencyId, userId, staffMemberId, displayName }
      );
    } catch (err) {
      setParseErrors([err instanceof Error ? err.message : 'Failed to process file']);
    }
  };

  const handleClose = () => {
    // Don't allow close during upload
    if (isUploading) return;

    setReportType('');
    setSelectedFile(null);
    setParseErrors([]);
    resetProgress();
    onOpenChange(false);

    if (isComplete) {
      onUploadComplete();
    }
  };

  const canUpload = reportType && selectedFile && !isUploading && !isComplete;
  const progressPercent = uploadProgress.total > 0
    ? Math.round((uploadProgress.processed / uploadProgress.total) * 100)
    : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Prevent closing during upload
        if (!nextOpen && isUploading) return;
        if (!nextOpen) handleClose();
      }}
    >
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => { if (isUploading) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (isUploading) e.preventDefault(); }}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Upload Cancel Audit Report</DialogTitle>
            {!isUploading && !isComplete && (
              <HowItWorksModal title="How the Cancel Audit Upload Works">
                <p className="font-medium text-foreground">What happens when you upload a report:</p>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li><span className="font-medium text-foreground">New records</span> are created for any policy number AgencyBrain hasn't seen before. A contact is automatically created (or matched to an existing one) based on the insured's name, phone, and email.</li>
                  <li><span className="font-medium text-foreground">Returning records</span> — policies that appeared in your last upload and are still in this one — are updated with the latest carrier data. Your status, assignment, and activity history are preserved.</li>
                  <li><span className="font-medium text-foreground">Dropped records</span> — policies from your last upload that are <em>not</em> in this one — get flagged with a "Not in latest" badge. This usually means the customer made a payment or the policy fully cancelled. They stay in your "Needs Attention" view until you mark them Resolved or Lost.</li>
                  <li><span className="font-medium text-foreground">Resolved records that reappear</span> — if you previously marked a record as Resolved but it shows back up, AgencyBrain resets it to "New" so your team knows it needs attention again.</li>
                  <li><span className="font-medium text-foreground">Assignments are never cleared</span> — if a record was assigned to a team member, it stays assigned through every upload cycle.</li>
                </ul>
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50 p-3 mt-2">
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    <span className="font-medium">Important:</span> Make sure you select the correct report type (Cancellation Audit vs. Pending Cancel). Each one tracks a different set of records — uploading the wrong type will flag records from the other type as dropped.
                  </p>
                </div>
              </HowItWorksModal>
            )}
          </div>
          <DialogDescription className="sr-only">
            Upload and process cancel audit report files
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* === PROCESSING STATE === */}
          {isUploading && (
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {uploadProgress.phase === 'finalizing'
                      ? 'Finalizing upload...'
                      : `Processing ${uploadProgress.processed} of ${uploadProgress.total} records...`
                    }
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Please stay on this page until processing is complete.
                  </p>
                </div>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">{progressPercent}%</p>
            </div>
          )}

          {/* === COMPLETE STATE === */}
          {isComplete && uploadProgress.result && (
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <p className="text-sm font-medium text-foreground">Upload Complete!</p>
              </div>
              <div className="rounded-lg border bg-muted/50 p-4 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">New records</span>
                  <span className="font-medium">{uploadProgress.result.recordsCreated}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Updated records</span>
                  <span className="font-medium">{uploadProgress.result.recordsUpdated}</span>
                </div>
                {uploadProgress.result.recordsDropped > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Dropped from report</span>
                    <span className="font-medium text-amber-600">{uploadProgress.result.recordsDropped}</span>
                  </div>
                )}
                {uploadProgress.result.errors > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Errors</span>
                    <span className="font-medium text-destructive">{uploadProgress.result.errors}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <Button onClick={handleClose}>Done</Button>
              </div>
            </div>
          )}

          {/* === ERROR STATE === */}
          {isError && (
            <div className="py-4 space-y-4">
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Upload Failed</p>
                    <p className="text-xs text-destructive/80 mt-1">
                      {uploadProgress.errorMessage || 'An error occurred during processing'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>Close</Button>
                <Button onClick={() => { resetProgress(); }}>Try Again</Button>
              </div>
            </div>
          )}

          {/* === FILE SELECTION STATE (idle) === */}
          {uploadProgress.phase === 'idle' && (
            <>
              {/* Report Type Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Report Type <span className="text-destructive">*</span>
                </label>
                <Select
                  value={reportType}
                  onValueChange={(value) => setReportType(value as ReportType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select report type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cancellation">Cancellation Audit</SelectItem>
                    <SelectItem value="pending_cancel">Pending Cancel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                  isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                )}
              >
                <input {...getInputProps()} />
                <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {isDragActive
                    ? 'Drop the file here...'
                    : 'Drag and drop your .xlsx file here'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
              </div>

              {/* Selected File */}
              {selectedFile && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                  <FileSpreadsheet className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-foreground flex-1 truncate">
                    {selectedFile.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Errors */}
              {parseErrors.length > 0 && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Error</p>
                      <ul className="text-xs text-destructive/80 mt-1 list-disc list-inside">
                        {parseErrors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleUpload} disabled={!canUpload}>
                  Upload
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
