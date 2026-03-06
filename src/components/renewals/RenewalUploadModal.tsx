import { useState, useCallback, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, X, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { HowItWorksModal } from '@/components/HowItWorksModal';
import { useRenewalBackgroundUpload } from '@/hooks/useRenewalBackgroundUpload';
import { parseRenewalExcel, getRenewalDateRange } from '@/lib/renewalParser';
import type { ParsedRenewalRecord, RenewalUploadContext } from '@/types/renewal';

interface Props { open: boolean; onClose: () => void; context: RenewalUploadContext; }

export function RenewalUploadModal({ open, onClose, context }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRecords, setParsedRecords] = useState<ParsedRenewalRecord[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [excludeRenewalTaken, setExcludeRenewalTaken] = useState(false);
  const { startBackgroundUpload } = useRenewalBackgroundUpload();

  // Optionally filter out "Renewal Taken" if checkbox is checked
  const recordsToUpload = useMemo(() => {
    if (!excludeRenewalTaken) return parsedRecords;
    return parsedRecords.filter(r => r.renewalStatus !== 'Renewal Taken');
  }, [parsedRecords, excludeRenewalTaken]);

  const renewalTakenCount = useMemo(() => {
    return parsedRecords.filter(r => r.renewalStatus === 'Renewal Taken').length;
  }, [parsedRecords]);

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
    setFile(f); setParseError(null); setParsedRecords([]); setExcludeRenewalTaken(false);
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
    if (!file || !recordsToUpload.length) return;
    
    setIsStarting(true);
    try { 
      // Fire and forget - starts background processing immediately
      await startBackgroundUpload(recordsToUpload, file.name, context);
      
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
    setExcludeRenewalTaken(false);
    onClose();
  };
  
  const dateRange = recordsToUpload.length ? getRenewalDateRange(recordsToUpload) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Upload Renewal Audit Report</DialogTitle>
            <HowItWorksModal title="How the Renewal Upload Works">
              <p className="font-medium text-foreground">What happens when you upload a renewal report:</p>
              <ul className="list-disc list-inside space-y-2 ml-1">
                <li><span className="font-medium text-foreground">New records</span> are created for any policy that AgencyBrain hasn't seen before (matched by policy number + renewal effective date). A contact is automatically created or matched based on name, phone, and email.</li>
                <li><span className="font-medium text-foreground">Returning records</span> — policies from your last upload that are still in this one — are updated with the latest carrier data. Your status, assignment, and activity history are preserved.</li>
                <li><span className="font-medium text-foreground">Dropped records</span> — policies from your last upload that are <em>not</em> in this one — get flagged and moved to the "Dropped" tab. This usually means the customer renewed, cancelled, or rewrote the policy. They stay visible until you mark them as Success or Unsuccessful.</li>
                <li><span className="font-medium text-foreground">"Renewal Taken" auto-resolution</span> — if a dropped record had a carrier status of "Renewal Taken," AgencyBrain automatically marks it as Success. No follow-up needed — the carrier already confirmed the renewal.</li>
                <li><span className="font-medium text-foreground">Assignments are never cleared</span> — if a record was assigned to a team member, it stays assigned through every upload cycle.</li>
                <li><span className="font-medium text-foreground">Date range matters</span> — only records within the upload's date range are compared. Records outside that range are untouched.</li>
              </ul>
              <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/50 p-3 mt-2">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  <span className="font-medium">Connection to other workflows:</span> While you have uncontacted or pending renewals, the contact shows as "Renewal" stage on the Contacts page. If you mark a renewal as Unsuccessful, you can send it directly to Win-Back HQ. If the same customer has active cancel audit work, their stage stays "Cancel Audit" — renewals don't override higher-priority workflows.
                </p>
              </div>
            </HowItWorksModal>
          </div>
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
                  <p className="text-sm text-muted-foreground">{recordsToUpload.length} records to upload{dateRange?.start && ` • ${dateRange.start} to ${dateRange.end}`}</p>
                </div>
                {!isStarting && <Button variant="ghost" size="icon" onClick={() => { setFile(null); setParsedRecords([]); }}><X className="h-4 w-4" /></Button>}
              </div>
              
              {/* Exclude Renewal Taken checkbox */}
              {parsedRecords.length > 0 && renewalTakenCount > 0 && (
                <div className="flex items-center gap-2 px-1">
                  <Checkbox
                    id="exclude-renewal-taken"
                    checked={excludeRenewalTaken}
                    onCheckedChange={(checked) => setExcludeRenewalTaken(!!checked)}
                  />
                  <label htmlFor="exclude-renewal-taken" className="text-sm cursor-pointer select-none">
                    Exclude "Renewal Taken" records
                    <span className="text-muted-foreground ml-1">
                      ({renewalTakenCount} found - already retained customers)
                    </span>
                  </label>
                </div>
              )}
              
              {recordsToUpload.length > 0 && (
                <ScrollArea className="h-[250px] border rounded-lg">
                  <Table>
                    <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Policy</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Old</TableHead><TableHead className="text-right">New</TableHead><TableHead className="text-right">Change</TableHead><TableHead>Bundled</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {recordsToUpload.slice(0, 8).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.firstName} {r.lastName}</TableCell>
                          <TableCell className="font-mono text-sm">{r.policyNumber}</TableCell>
                          <TableCell>{r.productName}</TableCell>
                          <TableCell className="text-right">${r.premiumOld?.toLocaleString() ?? '-'}</TableCell>
                          <TableCell className="text-right">${r.premiumNew?.toLocaleString() ?? '-'}</TableCell>
                          <TableCell className={`text-right ${(r.premiumChangePercent || 0) > 0 ? 'text-red-600' : (r.premiumChangePercent || 0) < 0 ? 'text-green-600' : ''}`}>{r.premiumChangePercent != null ? `${r.premiumChangePercent > 0 ? '+' : ''}${r.premiumChangePercent.toFixed(1)}%` : '-'}</TableCell>
                          <TableCell className="capitalize">{r.multiLineIndicator}</TableCell>
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
          <Button onClick={handleUpload} disabled={!file || !recordsToUpload.length || isStarting || !!parseError}>
            {isStarting ? 'Starting...' : `Upload ${recordsToUpload.length} Records`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
