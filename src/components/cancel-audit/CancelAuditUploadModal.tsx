import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileSpreadsheet, AlertCircle, X } from 'lucide-react';
import { HowItWorksModal } from '@/components/HowItWorksModal';
import { parseCancelAuditExcel, type ParseResult } from '@/lib/cancel-audit-parser';
import { useCancelAuditBackgroundUpload } from '@/hooks/useCancelAuditBackgroundUpload';
import type { ReportType } from '@/types/cancel-audit';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  const [parsedRecords, setParsedRecords] = useState<ParseResult | null>(null);

  const { startBackgroundUpload } = useCancelAuditBackgroundUpload();

  // Listen for sidebar navigation to force close dialog
  useEffect(() => {
    const handleNavigation = () => {
      if (open) {
        handleClose();
      }
    };
    window.addEventListener('sidebar-navigation', handleNavigation);
    return () => window.removeEventListener('sidebar-navigation', handleNavigation);
  }, [open]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.name.endsWith('.xlsx')) {
        setSelectedFile(file);
        setParseErrors([]);
        setParsedRecords(null);
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

    setParseErrors([]);

    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await selectedFile.arrayBuffer();
      
      // Parse Excel
      const parseResult: ParseResult = parseCancelAuditExcel(arrayBuffer, reportType);

      if (!parseResult.success) {
        setParseErrors(parseResult.errors);
        return;
      }

      if (parseResult.records.length === 0) {
        setParseErrors(['No valid records found in the file']);
        return;
      }

      // Start background upload and close modal immediately
      await startBackgroundUpload(
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

      // Trigger refresh and close modal
      onUploadComplete();
      handleClose();
    } catch (err) {
      setParseErrors([err instanceof Error ? err.message : 'Failed to process file']);
    }
  };

  const handleClose = () => {
    // Reset state
    setReportType('');
    setSelectedFile(null);
    setParseErrors([]);
    setParsedRecords(null);
    onOpenChange(false);
  };

  const canUpload = reportType && selectedFile;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Upload Cancel Audit Report</DialogTitle>
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
          </div>
          <DialogDescription className="sr-only">
            Upload and process cancel audit report files
          </DialogDescription>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
