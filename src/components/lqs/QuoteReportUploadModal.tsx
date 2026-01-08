import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, AlertCircle, X } from 'lucide-react';
import { parseLqsQuoteExcel } from '@/lib/lqs-quote-parser';
import { useQuoteBackgroundUpload } from '@/hooks/useQuoteBackgroundUpload';
import type { QuoteParseResult } from '@/types/lqs';
import { cn } from '@/lib/utils';

interface QuoteReportUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  userId: string | null;
  displayName: string;
  onUploadComplete?: () => void;
}

type UploadState = 'idle' | 'parsing' | 'error';

export function QuoteReportUploadModal({
  open,
  onOpenChange,
  agencyId,
  userId,
  displayName,
  onUploadComplete,
}: QuoteReportUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  const { startBackgroundUpload } = useQuoteBackgroundUpload();

  const handleFileSelect = useCallback((file: File) => {
    if (file.name.endsWith('.xlsx') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      setSelectedFile(file);
      setUploadState('idle');
      setParseErrors([]);
    } else {
      setParseErrors(['Please select an Excel file (.xlsx format only)']);
    }
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      handleFileSelect(acceptedFiles[0]);
    }
  }, [handleFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 1,
    multiple: false,
    noClick: false,
    noKeyboard: false,
    noDrag: false,
  });

  const handleManualDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleClose = useCallback(() => {
    setSelectedFile(null);
    setUploadState('idle');
    setParseErrors([]);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadState('parsing');
    setIsParsing(true);
    setParseErrors([]);

    try {
      // Step 1: Parse Excel (quick - stays in modal)
      const arrayBuffer = await selectedFile.arrayBuffer();
      const parsed = parseLqsQuoteExcel(arrayBuffer);

      if (!parsed.success) {
        setParseErrors(parsed.errors);
        setUploadState('error');
        setIsParsing(false);
        return;
      }

      if (parsed.records.length === 0) {
        setParseErrors(['No valid records found in the file']);
        setUploadState('error');
        setIsParsing(false);
        return;
      }

      // Step 2: Start background upload - fire and forget
      startBackgroundUpload(parsed.records, {
        agencyId,
        userId,
        displayName,
      });

      // Close modal immediately and trigger callback
      if (onUploadComplete) {
        onUploadComplete();
      }
      handleClose();
    } catch (err) {
      setParseErrors([err instanceof Error ? err.message : 'Failed to process file']);
      setUploadState('error');
      setIsParsing(false);
    }
  };

  const canUpload = selectedFile && uploadState === 'idle';

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Allstate Quote Report</DialogTitle>
          <DialogDescription>
            Upload a "Quotes Detail and Conversion Rate Report" Excel file to import quote data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Dropzone */}
          <div
            {...getRootProps({
              onDrop: handleManualDrop,
              onDragOver: handleDragOver,
            })}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/50',
              (uploadState === 'parsing') && 'pointer-events-none opacity-50'
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
          {uploadState === 'parsing' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Parsing file...</span>
              </div>
              <Progress value={50} />
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
            <Button variant="outline" onClick={handleClose} disabled={isParsing}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!canUpload || isParsing}>
              {isParsing ? 'Parsing...' : 'Upload'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
