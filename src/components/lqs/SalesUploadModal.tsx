import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Upload, FileSpreadsheet, AlertCircle, X, Phone } from 'lucide-react';
import { parseLqsSalesExcel } from '@/lib/lqs-sales-parser';
import { useSalesBackgroundUpload } from '@/hooks/useSalesBackgroundUpload';
import type { SalesUploadResult } from '@/types/lqs';
import { cn } from '@/lib/utils';

interface SalesUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  userId: string | null;
  displayName: string;
  onUploadComplete?: () => void;
  onUploadResults?: (result: SalesUploadResult) => void;
}

type UploadState = 'idle' | 'parsing' | 'error';

export function SalesUploadModal({
  open,
  onOpenChange,
  agencyId,
  userId,
  displayName,
  onUploadComplete,
  onUploadResults,
}: SalesUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isOneCallClose, setIsOneCallClose] = useState(false);

  const { startBackgroundUpload } = useSalesBackgroundUpload();

  const handleFileSelect = useCallback((file: File) => {
    const isExcel = file.name.endsWith('.xlsx') || 
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const isCsv = file.name.endsWith('.csv') || file.type === 'text/csv';
    
    if (isExcel || isCsv) {
      setSelectedFile(file);
      setUploadState('idle');
      setParseErrors([]);
    } else {
      setParseErrors(['Please select an Excel (.xlsx) or CSV file']);
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
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    multiple: false,
  });

  const handleClose = useCallback(() => {
    console.log('[Sales Upload] Modal closing, resetting state');
    setSelectedFile(null);
    setUploadState('idle');
    setParseErrors([]);
    setIsParsing(false); // FIX: Always reset parsing state on close
    setIsOneCallClose(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadState('parsing');
    setIsParsing(true);
    setParseErrors([]);

    console.log('[Sales Upload] Starting file parse:', selectedFile.name);

    // Timeout protection - 60 seconds
    const timeoutId = setTimeout(() => {
      console.error('[Sales Upload] Timeout after 60 seconds');
      setParseErrors(['File processing timed out. The file may be too large or corrupted.']);
      setUploadState('error');
      setIsParsing(false);
    }, 60000);

    try {
      // Parse Excel file
      console.log('[Sales Upload] Loading ArrayBuffer...');
      const arrayBuffer = await selectedFile.arrayBuffer();
      console.log('[Sales Upload] ArrayBuffer loaded, size:', arrayBuffer.byteLength);
      
      const parsed = parseLqsSalesExcel(arrayBuffer);
      console.log('[Sales Upload] Parse complete:', parsed.records.length, 'records, success:', parsed.success);

      // Clear timeout since parsing completed
      clearTimeout(timeoutId);

      if (!parsed.success) {
        console.log('[Sales Upload] Parse failed with errors:', parsed.errors);
        setParseErrors(parsed.errors);
        setUploadState('error');
        setIsParsing(false);
        return;
      }

      if (parsed.records.length === 0) {
        console.log('[Sales Upload] No valid records found');
        setParseErrors(['No valid records found in the file']);
        setUploadState('error');
        setIsParsing(false);
        return;
      }

      // Start background upload
      console.log('[Sales Upload] Starting background upload with', parsed.records.length, 'records...');
      const motorClubExcluded = parsed.records.filter(
        (record) => record.productType?.toLowerCase() === 'motor club'
      ).length;
      const fileRows = parsed.records.length + parsed.endorsementsSkipped;
      const countableRows = Math.max(parsed.records.length - motorClubExcluded, 0);

      startBackgroundUpload(parsed.records, {
        agencyId,
        userId,
        displayName,
        isOneCallClose,
      }, (result) => {
        onUploadResults?.({
          ...result,
          uploadRuleSummary: {
            fileRows,
            endorsementsSkipped: parsed.endorsementsSkipped,
            motorClubExcluded,
            countableRows,
          },
        });
      });

      // FIX: Reset state BEFORE closing modal
      console.log('[Sales Upload] Resetting state and closing modal...');
      setIsParsing(false);
      setUploadState('idle');

      // Close modal
      if (onUploadComplete) {
        onUploadComplete();
      }
      handleClose();
    } catch (err) {
      // Clear timeout on error too
      clearTimeout(timeoutId);
      console.error('[Sales Upload] Error:', err);
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
          <DialogTitle>Upload Sales Report</DialogTitle>
          <DialogDescription>
            Upload a sales report Excel file to import sold policies into the LQS tracker.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Dropzone */}
          <div
            {...getRootProps()}
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
                : 'Drag and drop your .xlsx or .csv file here'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
          </div>

          {/* Expected Format */}
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <p className="font-medium mb-1">Expected columns:</p>
            <p>Sub Producer, First Name, Last Name, ZIP, Sale Date, Product, Items, Premium, Policy #</p>
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

          {/* One-Call Close Toggle */}
          <div className={cn(
            "p-3 rounded-lg border transition-colors",
            isOneCallClose
              ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20"
              : "border-muted bg-muted/30"
          )}>
            <div className="flex items-center gap-3">
              <Checkbox
                id="uploadOneCallClose"
                checked={isOneCallClose}
                onCheckedChange={(checked) => setIsOneCallClose(checked === true)}
              />
              <Label
                htmlFor="uploadOneCallClose"
                className="flex items-center gap-2 cursor-pointer font-medium text-sm"
              >
                <Phone className="h-4 w-4 text-green-600" />
                One-Call Close
              </Label>
            </div>
            <p className="mt-1 pl-7 text-xs text-muted-foreground">
              Mark all sales in this upload as closed on the first call.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose}>
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
