import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { parseWinbackExcel, calculateWinbackDate, getHouseholdKey, type ParsedWinbackRecord } from '@/lib/winbackParser';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

interface WinbackUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  contactDaysBefore: number;
  onUploadComplete: () => void;
}

interface UploadStats {
  processed: number;
  newHouseholds: number;
  newPolicies: number;
  updated: number;
  skipped: number;
}

export function WinbackUploadModal({
  open,
  onOpenChange,
  agencyId,
  contactDaysBefore,
  onUploadComplete,
}: WinbackUploadModalProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [parsedRecords, setParsedRecords] = useState<ParsedWinbackRecord[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStats, setUploadStats] = useState<UploadStats | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'processing' | 'complete'>('upload');

  const resetState = () => {
    setFile(null);
    setParsedRecords([]);
    setParseErrors([]);
    setUploading(false);
    setUploadProgress(0);
    setUploadStats(null);
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

  const processUpload = async () => {
    if (!parsedRecords.length || !agencyId) return;

    setStep('processing');
    setUploading(true);
    setUploadProgress(0);

    const stats: UploadStats = {
      processed: 0,
      newHouseholds: 0,
      newPolicies: 0,
      updated: 0,
      skipped: 0,
    };

    try {
      // Group records by household key
      const householdGroups = new Map<string, ParsedWinbackRecord[]>();
      for (const record of parsedRecords) {
        const key = getHouseholdKey(record);
        if (!householdGroups.has(key)) {
          householdGroups.set(key, []);
        }
        householdGroups.get(key)!.push(record);
      }

      const totalGroups = householdGroups.size;
      let processedGroups = 0;

      for (const [, records] of householdGroups) {
        // Use first record for household data (they should all match on name/zip)
        const firstRecord = records[0];

        // Check if household exists
        const { data: existingHousehold } = await supabase
          .from('winback_households')
          .select('id')
          .eq('agency_id', agencyId)
          .ilike('first_name', firstRecord.firstName)
          .ilike('last_name', firstRecord.lastName)
          .filter('zip_code', 'like', `${firstRecord.zipCode.substring(0, 5)}%`)
          .maybeSingle();

        let householdId: string;

        if (existingHousehold) {
          householdId = existingHousehold.id;
          // Update household with latest contact info if available
          const updateData: Record<string, string> = {};
          if (firstRecord.email) updateData.email = firstRecord.email;
          if (firstRecord.phone) updateData.phone = firstRecord.phone;

          if (Object.keys(updateData).length > 0) {
            await supabase
              .from('winback_households')
              .update(updateData)
              .eq('id', householdId);
          }
        } else {
          // Create new household
          const { data: newHousehold, error: householdError } = await supabase
            .from('winback_households')
            .insert({
              agency_id: agencyId,
              first_name: firstRecord.firstName,
              last_name: firstRecord.lastName,
              zip_code: firstRecord.zipCode,
              email: firstRecord.email,
              phone: firstRecord.phone,
              status: 'untouched',
            })
            .select('id')
            .single();

          if (householdError) {
            console.error('Error creating household:', householdError);
            stats.skipped += records.length;
            processedGroups++;
            setUploadProgress(Math.round((processedGroups / totalGroups) * 100));
            continue;
          }

          householdId = newHousehold.id;
          stats.newHouseholds++;
        }

        // Process each policy in this household
        for (const record of records) {
          const winbackDate = calculateWinbackDate(
            record.terminationEffectiveDate,
            record.policyTermMonths,
            contactDaysBefore
          );

          // Calculate premium change
          let premiumChangeCents: number | null = null;
          let premiumChangePercent: number | null = null;
          if (record.premiumNewCents !== null && record.premiumOldCents !== null && record.premiumOldCents > 0) {
            premiumChangeCents = record.premiumNewCents - record.premiumOldCents;
            premiumChangePercent = Math.round((premiumChangeCents / record.premiumOldCents) * 10000) / 100;
          }

          // Check if policy already exists
          const { data: existingPolicy } = await supabase
            .from('winback_policies')
            .select('id')
            .eq('agency_id', agencyId)
            .eq('policy_number', record.policyNumber)
            .maybeSingle();

          if (existingPolicy) {
            // Update existing policy
            await supabase
              .from('winback_policies')
              .update({
                household_id: householdId,
                termination_effective_date: record.terminationEffectiveDate.toISOString().split('T')[0],
                termination_reason: record.terminationReason,
                termination_type: record.terminationType,
                premium_new_cents: record.premiumNewCents,
                premium_old_cents: record.premiumOldCents,
                premium_change_cents: premiumChangeCents,
                premium_change_percent: premiumChangePercent,
                is_cancel_rewrite: record.isCancelRewrite,
                calculated_winback_date: winbackDate.toISOString().split('T')[0],
                items_count: record.itemsCount,
                line_code: record.lineCode,
              })
              .eq('id', existingPolicy.id);

            stats.updated++;
          } else {
            // Insert new policy
            const { error: policyError } = await supabase
              .from('winback_policies')
              .insert({
                household_id: householdId,
                agency_id: agencyId,
                policy_number: record.policyNumber,
                agent_number: record.agentNumber,
                original_year: record.originalYear,
                product_code: record.productCode,
                product_name: record.productName,
                policy_term_months: record.policyTermMonths,
                renewal_effective_date: record.renewalEffectiveDate?.toISOString().split('T')[0] || null,
                anniversary_effective_date: record.anniversaryEffectiveDate?.toISOString().split('T')[0] || null,
                termination_effective_date: record.terminationEffectiveDate.toISOString().split('T')[0],
                termination_reason: record.terminationReason,
                termination_type: record.terminationType,
                premium_new_cents: record.premiumNewCents,
                premium_old_cents: record.premiumOldCents,
                premium_change_cents: premiumChangeCents,
                premium_change_percent: premiumChangePercent,
                account_type: record.accountType,
                company_code: record.companyCode,
                is_cancel_rewrite: record.isCancelRewrite,
                calculated_winback_date: winbackDate.toISOString().split('T')[0],
                items_count: record.itemsCount,
                line_code: record.lineCode,
              });

            if (policyError) {
              console.error('Error inserting policy:', policyError);
              stats.skipped++;
            } else {
              stats.newPolicies++;
            }
          }

          stats.processed++;
        }

        // Recalculate household aggregates
        await supabase.rpc('recalculate_winback_household_aggregates', {
          p_household_id: householdId,
        });

        processedGroups++;
        setUploadProgress(Math.round((processedGroups / totalGroups) * 100));
      }

      // Record the upload
      await supabase.from('winback_uploads').insert({
        agency_id: agencyId,
        uploaded_by_user_id: user?.id || null,
        filename: file?.name || 'unknown',
        records_processed: stats.processed,
        records_new_households: stats.newHouseholds,
        records_new_policies: stats.newPolicies,
        records_updated: stats.updated,
        records_skipped: stats.skipped,
      });

      setUploadStats(stats);
      setStep('complete');
      toast.success(`Successfully processed ${stats.processed} records`);
      onUploadComplete();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to process upload');
      setStep('preview');
    } finally {
      setUploading(false);
    }
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
              <Button onClick={processUpload} disabled={uploading}>
                Import Records
              </Button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="py-8 space-y-4">
            <div className="text-center">
              <p className="text-sm font-medium">Processing records...</p>
              <p className="text-xs text-muted-foreground">Please don't close this window</p>
            </div>
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-center text-sm text-muted-foreground">{uploadProgress}%</p>
          </div>
        )}

        {step === 'complete' && uploadStats && (
          <div className="py-4 space-y-4">
            <div className="text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
              <p className="text-lg font-medium">Upload Complete!</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Processed</p>
                <p className="text-xl font-bold">{uploadStats.processed}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">New Households</p>
                <p className="text-xl font-bold">{uploadStats.newHouseholds}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">New Policies</p>
                <p className="text-xl font-bold">{uploadStats.newPolicies}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Updated</p>
                <p className="text-xl font-bold">{uploadStats.updated}</p>
              </div>
            </div>

            {uploadStats.skipped > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                {uploadStats.skipped} records skipped due to errors
              </p>
            )}

            <Button className="w-full" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
