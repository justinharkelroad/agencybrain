import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, X, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRenewalBackgroundUpload } from '@/hooks/useRenewalBackgroundUpload';
import { parseRenewalExcel, getRenewalDateRange } from '@/lib/renewalParser';
import type { ParsedRenewalRecord, RenewalUploadContext } from '@/types/renewal';

interface Props { open: boolean; onClose: () => void; context: RenewalUploadContext; }

export function RenewalUploadModal({ open, onClose, context }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRecords, setParsedRecords] = useState<ParsedRenewalRecord[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const { startBackgroundUpload } = useRenewalBackgroundUpload();

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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const f = acceptedFiles[0]; if (!f) return;
    setFile(f); setParseError(null); setParsedRecords([]);
    try {
      const buffer = await f.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      setParsedRecords(parseRenewalExcel(workbook));
    } catch (err) { setParseError(err instanceof Error ? err.message : 'Failed to parse'); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls'] },
    maxFiles: 1, disabled: isStarting,
  });

  const handleUpload = async () => { 
    if (!file || !parsedRecords.length) return;
    
    setIsStarting(true);
    try { 
      // Fire and forget - starts background processing immediately
      await startBackgroundUpload(parsedRecords, file.name, context);
      
      // Close modal immediately - processing continues in background
      handleClose();
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to start upload');
      setIsStarting(false);
    }
  };
  
  const handleClose = () => { 
    setFile(null); 
    setParsedRecords([]); 
    setParseError(null); 
    setIsStarting(false);
    onClose(); 
  };
  
  const dateRange = parsedRecords.length ? getRenewalDateRange(parsedRecords) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload Renewal Audit Report</DialogTitle>
          <DialogDescription>Upload an Allstate BOB Renewal Audit Report (.xlsx)</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden space-y-4">
          {!file && (
            <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}>
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">{isDragActive ? 'Drop here...' : 'Drag & drop or click to select'}</p>
            </div>
          )}
          {file && !parseError && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <FileSpreadsheet className="h-8 w-8 text-green-600" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{parsedRecords.length} records{dateRange?.start && ` • ${dateRange.start} to ${dateRange.end}`}</p>
                </div>
                {!isStarting && <Button variant="ghost" size="icon" onClick={() => { setFile(null); setParsedRecords([]); }}><X className="h-4 w-4" /></Button>}
              </div>
              {parsedRecords.length > 0 && (
                <ScrollArea className="h-[250px] border rounded-lg">
                  <Table>
                    <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Policy</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Old</TableHead><TableHead className="text-right">New</TableHead><TableHead className="text-right">Change</TableHead><TableHead>Bundled</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {parsedRecords.slice(0, 8).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.firstName} {r.lastName}</TableCell>
                          <TableCell className="font-mono text-sm">{r.policyNumber}</TableCell>
                          <TableCell>{r.productName}</TableCell>
                          <TableCell className="text-right">${r.premiumOld?.toLocaleString() ?? '-'}</TableCell>
                          <TableCell className="text-right">${r.premiumNew?.toLocaleString() ?? '-'}</TableCell>
                          <TableCell className={`text-right ${(r.premiumChangePercent || 0) > 0 ? 'text-red-600' : (r.premiumChangePercent || 0) < 0 ? 'text-green-600' : ''}`}>{r.premiumChangePercent != null ? `${r.premiumChangePercent > 0 ? '+' : ''}${r.premiumChangePercent.toFixed(1)}%` : '-'}</TableCell>
                          <TableCell>{r.multiLineIndicator ? 'Yes' : 'No'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </div>
          )}
          {parseError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{parseError}</AlertDescription></Alert>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isStarting}>Cancel</Button>
          <Button onClick={handleUpload} disabled={!file || !parsedRecords.length || isStarting || !!parseError}>
            {isStarting ? 'Starting...' : `Upload ${parsedRecords.length} Records`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
