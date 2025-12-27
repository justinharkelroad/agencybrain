import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { parseCancelAuditExcel, type ParseResult } from '@/lib/cancel-audit-parser';
import { useCancelAuditUpload } from '@/hooks/useCancelAuditUpload';
import type { ReportType } from '@/types/cancel-audit';
import { cn } from '@/lib/utils';

interface CancelAuditUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  userId: string | null;
  staffMemberId: string | null;
  displayName: string;
  onUploadComplete: () => void;
}

type UploadState = 'idle' | 'parsing' | 'uploading' | 'success' | 'error';

interface UploadSummary {
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  duplicatesSkipped: number;
  errors: string[];
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
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const { uploadRecords, isUploading, progress } = useCancelAuditUpload();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.name.endsWith('.xlsx')) {
        setSelectedFile(file);
        setUploadState('idle');
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
  });

  const handleUpload = async () => {
    if (!selectedFile || !reportType) return;

    setUploadState('parsing');
    setParseErrors([]);

    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await selectedFile.arrayBuffer();
      
      // Parse Excel
      const parseResult: ParseResult = parseCancelAuditExcel(arrayBuffer, reportType);

      if (!parseResult.success) {
        setParseErrors(parseResult.errors);
        setUploadState('error');
        return;
      }

      if (parseResult.records.length === 0) {
        setParseErrors(['No valid records found in the file']);
        setUploadState('error');
        return;
      }

      // Upload to database
      setUploadState('uploading');
      
      const result = await uploadRecords(
        parseResult.records,
        reportType,
        selectedFile.name,
        {
          agencyId,
          userId,
          staffMemberId,
          displayName,
        }
      );

      if (result.success) {
        setSummary({
          recordsProcessed: result.recordsProcessed,
          recordsCreated: result.recordsCreated,
          recordsUpdated: result.recordsUpdated,
          duplicatesSkipped: parseResult.duplicatesRemoved,
          errors: [...parseResult.errors, ...result.errors],
        });
        setUploadState('success');
      } else {
        setParseErrors(result.errors);
        setUploadState('error');
      }
    } catch (err) {
      setParseErrors([err instanceof Error ? err.message : 'Failed to process file']);
      setUploadState('error');
    }
  };

  const handleClose = () => {
    if (uploadState === 'success') {
      onUploadComplete();
    }
    // Reset state
    setReportType('');
    setSelectedFile(null);
    setUploadState('idle');
    setSummary(null);
    setParseErrors([]);
    onOpenChange(false);
  };

  const handleViewRecords = () => {
    onUploadComplete();
    handleClose();
  };

  const canUpload = reportType && selectedFile && uploadState === 'idle';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        {uploadState === 'success' && summary ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-500">
                <CheckCircle2 className="h-5 w-5" />
                Upload Complete
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Upload Summary
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Records Processed:</span>
                    <span className="font-medium text-foreground">{summary.recordsProcessed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">New Records:</span>
                    <span className="font-medium text-green-500">{summary.recordsCreated}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Updated Records:</span>
                    <span className="font-medium text-blue-500">{summary.recordsUpdated}</span>
                  </div>
                  {summary.duplicatesSkipped > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duplicates Skipped:</span>
                      <span className="font-medium text-muted-foreground">{summary.duplicatesSkipped}</span>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Your {reportType === 'cancellation' ? 'Cancellation Audit' : 'Pending Cancel'} report has been uploaded successfully.
              </p>

              {summary.errors.length > 0 && (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
                  <p className="text-sm font-medium text-yellow-500 mb-1">Warnings:</p>
                  <ul className="text-xs text-yellow-500/80 list-disc list-inside">
                    {summary.errors.slice(0, 5).map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                    {summary.errors.length > 5 && (
                      <li>...and {summary.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleViewRecords}>View Records</Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Upload Cancel Audit Report</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Report Type Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Report Type <span className="text-destructive">*</span>
                </label>
                <Select
                  value={reportType}
                  onValueChange={(value) => setReportType(value as ReportType)}
                  disabled={uploadState !== 'idle'}
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
                    : 'border-border hover:border-muted-foreground/50',
                  uploadState !== 'idle' && 'pointer-events-none opacity-50'
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
                  {uploadState === 'idle' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Progress */}
              {(uploadState === 'parsing' || uploadState === 'uploading') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {uploadState === 'parsing' ? 'Parsing file...' : 'Uploading records...'}
                    </span>
                    {uploadState === 'uploading' && (
                      <span className="text-muted-foreground">{progress}%</span>
                    )}
                  </div>
                  <Progress value={uploadState === 'parsing' ? 50 : progress} />
                </div>
              )}

              {/* Errors */}
              {parseErrors.length > 0 && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Upload Failed</p>
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
                <Button variant="outline" onClick={handleClose} disabled={isUploading}>
                  Cancel
                </Button>
                <Button onClick={handleUpload} disabled={!canUpload || isUploading}>
                  {isUploading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
