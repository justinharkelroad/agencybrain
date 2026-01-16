import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, AlertTriangle, X } from 'lucide-react';
import { parseWinbackExcel, getHouseholdKey, type ParsedWinbackRecord } from '@/lib/winbackParser';
import { toast } from 'sonner';
import { useWinbackBackgroundUpload } from '@/hooks/useWinbackBackgroundUpload';

interface WinbackUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  contactDaysBefore: number;
  onUploadComplete: () => void;
}

export function WinbackUploadModal({
  open,
  onOpenChange,
  agencyId,
  contactDaysBefore,
  onUploadComplete,
}: WinbackUploadModalProps) {
  const { startBackgroundUpload } = useWinbackBackgroundUpload();
  const [file, setFile] = useState<File | null>(null);
  const [parsedRecords, setParsedRecords] = useState<ParsedWinbackRecord[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');

  const resetState = () => {
    setFile(null);
    setParsedRecords([]);
    setParseErrors([]);
    setStep('upload');
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f) return;

    setFile(f);
    setParseErrors([]);

    try {
      const buffer = await f.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const result = parseWinbackExcel(workbook);

      setParsedRecords(result.records);
      setParseErrors(result.errors);

      if (result.records.length > 0) {
        setStep('preview');
      } else {
        toast.error('No valid records found in the file');
      }
    } catch (err) {
      toast.error('Failed to parse Excel file');
      setParseErrors([err instanceof Error ? err.message : 'Unknown error']);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  });

  const handleImport = async () => {
    if (!parsedRecords.length || !agencyId) return;

    // Start background upload and close modal immediately
    await startBackgroundUpload(parsedRecords, file?.name || 'unknown', {
      agencyId,
      userId: null, // The hook gets this from useAuth
      contactDaysBefore,
    });

    // Close modal and trigger refresh
    onUploadComplete();
    handleClose();
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const uniqueHouseholds = new Set(parsedRecords.map(r => getHouseholdKey(r))).size;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Termination Audit
          </DialogTitle>
          <DialogDescription>
            Upload an Allstate termination audit Excel file to import terminated policies.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-sm text-muted-foreground">Drop the file here...</p>
            ) : (
              <>
                <p className="text-sm font-medium">Drag & drop an Excel file here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                <p className="text-xs text-muted-foreground mt-2">Supports .xlsx and .xls files</p>
              </>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm font-medium">{file?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {parsedRecords.length} records ready to import
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={resetState}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {parseErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium">{parseErrors.length} warning(s):</p>
                  <ul className="text-xs mt-1 space-y-0.5">
                    {parseErrors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {parseErrors.length > 5 && (
                      <li>...and {parseErrors.length - 5} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Total Records</p>
                <p className="text-2xl font-bold">{parsedRecords.length}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Unique Households</p>
                <p className="text-2xl font-bold">{uniqueHouseholds}</p>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleImport}>
                Import Records
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
