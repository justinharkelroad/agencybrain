import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, AlertTriangle, Users } from 'lucide-react';
import { parseLqsQuoteExcel } from '@/lib/lqs-quote-parser';
import { useLqsQuoteUpload } from '@/hooks/useLqsQuoteUpload';
import type { QuoteParseResult, QuoteUploadResult } from '@/types/lqs';
import { cn } from '@/lib/utils';

interface QuoteReportUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  userId: string | null;
  displayName: string;
  onUploadComplete?: () => void;
}

type UploadState = 'idle' | 'parsing' | 'uploading' | 'success' | 'error';

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
  const [parseResult, setParseResult] = useState<QuoteParseResult | null>(null);
  const [uploadResult, setUploadResult] = useState<QuoteUploadResult | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const { uploadQuotes, isUploading, progress } = useLqsQuoteUpload();

  const handleFileSelect = useCallback((file: File) => {
    if (file.name.endsWith('.xlsx') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      setSelectedFile(file);
      setUploadState('idle');
      setParseErrors([]);
      setParseResult(null);
      setUploadResult(null);
    } else {
      setParseErrors(['Please select an Excel file (.xlsx format only)']);
    }
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    console.log('Dropzone onDrop called with files:', acceptedFiles);
    if (acceptedFiles.length > 0) {
      handleFileSelect(acceptedFiles[0]);
    }
  }, [handleFileSelect]);

  const { getRootProps, getInputProps, isDragActive, open: openFilePicker } = useDropzone({
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

  // Manual drop handler as fallback
  const handleManualDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Manual drop event fired');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadState('parsing');
    setParseErrors([]);

    try {
      // Step 1: Parse Excel
      const arrayBuffer = await selectedFile.arrayBuffer();
      const parsed = parseLqsQuoteExcel(arrayBuffer);
      setParseResult(parsed);

      if (!parsed.success) {
        setParseErrors(parsed.errors);
        setUploadState('error');
        return;
      }

      if (parsed.records.length === 0) {
        setParseErrors(['No valid records found in the file']);
        setUploadState('error');
        return;
      }

      // Step 2: Upload to database
      setUploadState('uploading');
      
      const result = await uploadQuotes(parsed.records, {
        agencyId,
        userId,
        displayName,
      });

      setUploadResult(result);
      
      if (result.success) {
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
    if (uploadState === 'success' && onUploadComplete) {
      onUploadComplete();
    }
    // Reset state
    setSelectedFile(null);
    setUploadState('idle');
    setParseResult(null);
    setUploadResult(null);
    setParseErrors([]);
    onOpenChange(false);
  };

  const handleUploadAnother = () => {
    setSelectedFile(null);
    setUploadState('idle');
    setParseResult(null);
    setUploadResult(null);
    setParseErrors([]);
  };

  const canUpload = selectedFile && uploadState === 'idle';

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        {uploadState === 'success' && uploadResult ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-500">
                <CheckCircle2 className="h-5 w-5" />
                Upload Complete
              </DialogTitle>
              <DialogDescription className="sr-only">
                Quote report upload results
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* File info */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                <FileSpreadsheet className="h-4 w-4 text-green-500" />
                <span className="text-sm text-foreground flex-1 truncate">
                  {selectedFile?.name}
                </span>
                {parseResult?.dateRange && (
                  <span className="text-xs text-muted-foreground">
                    {parseResult.dateRange.start} to {parseResult.dateRange.end}
                  </span>
                )}
              </div>

              {/* Results summary */}
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <h4 className="font-medium text-foreground mb-3">Results</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rows Processed:</span>
                    <span className="font-medium text-foreground">{uploadResult.recordsProcessed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Households Created:</span>
                    <span className="font-medium text-green-500">{uploadResult.householdsCreated}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Households Updated:</span>
                    <span className="font-medium text-blue-500">{uploadResult.householdsUpdated}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quotes Created:</span>
                    <span className="font-medium text-green-500">{uploadResult.quotesCreated}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quotes Updated:</span>
                    <span className="font-medium text-blue-500">{uploadResult.quotesUpdated}</span>
                  </div>
                  {parseResult?.duplicatesRemoved && parseResult.duplicatesRemoved > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duplicates Skipped:</span>
                      <span className="font-medium text-muted-foreground">{parseResult.duplicatesRemoved}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Team Members Matched:
                      </span>
                      <span className="font-medium text-foreground">{uploadResult.teamMembersMatched}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Unmatched producers warning */}
              {uploadResult.unmatchedProducers.length > 0 && (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-500">
                        {uploadResult.unmatchedProducers.length} Sub-Producer{uploadResult.unmatchedProducers.length > 1 ? 's' : ''} Not Matched
                      </p>
                      <p className="text-xs text-yellow-500/80 mt-1">
                        These sub-producers could not be matched to team members:
                      </p>
                      <ul className="text-xs text-yellow-500/80 mt-1 list-disc list-inside">
                        {uploadResult.unmatchedProducers.slice(0, 5).map((producer, idx) => (
                          <li key={idx}>{producer}</li>
                        ))}
                        {uploadResult.unmatchedProducers.length > 5 && (
                          <li>...and {uploadResult.unmatchedProducers.length - 5} more</li>
                        )}
                      </ul>
                      <p className="text-xs text-yellow-500/80 mt-2">
                        Tip: Add sub-producer codes to team member profiles for automatic matching.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Needs attention note */}
              {uploadResult.householdsNeedingAttention > 0 && (
                <div className="rounded-lg border border-orange-500/20 bg-orange-500/10 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-orange-500">
                        {uploadResult.householdsNeedingAttention} household{uploadResult.householdsNeedingAttention > 1 ? 's' : ''} need lead source assignment
                      </p>
                      <p className="text-xs text-orange-500/80 mt-1">
                        Assign lead sources in the LQS Dashboard to track marketing ROI.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Errors if any */}
              {uploadResult.errors.length > 0 && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                  <p className="text-sm font-medium text-destructive mb-1">Warnings:</p>
                  <ul className="text-xs text-destructive/80 list-disc list-inside">
                    {uploadResult.errors.slice(0, 5).map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                    {uploadResult.errors.length > 5 && (
                      <li>...and {uploadResult.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleUploadAnother}>
                  Upload Another
                </Button>
                <Button onClick={handleClose}>Done</Button>
              </div>
            </div>
          </>
        ) : (
          <>
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
