import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { BusinessMetricsReport, CarrierSchema, CreateBusinessMetricsReportInput } from '@/lib/growth-center/types';

interface GCUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carrierSchemas: CarrierSchema[];
  reports: BusinessMetricsReport[];
  defaultCarrierSchemaKey?: string | null;
  onSubmit: (input: CreateBusinessMetricsReportInput) => Promise<void>;
  isSubmitting?: boolean;
}

function currentMonthValue(): string {
  return format(new Date(), 'yyyy-MM');
}

function toMonthLabel(value: string): string {
  const d = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function GCUploadDialog({
  open,
  onOpenChange,
  carrierSchemas,
  reports,
  defaultCarrierSchemaKey,
  onSubmit,
  isSubmitting = false,
}: GCUploadDialogProps) {
  const [carrierSchemaKey, setCarrierSchemaKey] = useState<string>(defaultCarrierSchemaKey ?? '');
  const [reportMonth, setReportMonth] = useState<string>(currentMonthValue);
  const [bonusProjection, setBonusProjection] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    if (justOpened) {
      setCarrierSchemaKey(defaultCarrierSchemaKey ?? carrierSchemas[0]?.schema_key ?? '');
      setReportMonth(currentMonthValue());
      setBonusProjection('');
      setFile(null);
      setSubmitError(null);
    }
    wasOpenRef.current = open;
  }, [open, defaultCarrierSchemaKey, carrierSchemas]);

  const selectedSchema = useMemo(
    () => carrierSchemas.find((schema) => schema.schema_key === carrierSchemaKey) ?? null,
    [carrierSchemaKey, carrierSchemas]
  );

  const duplicateReport = useMemo(() => {
    const monthDate = `${reportMonth}-01`;
    const selectedSchema = carrierSchemas.find((schema) => schema.schema_key === carrierSchemaKey);
    if (!selectedSchema) return null;
    return reports.find((report) => (
      report.report_month === monthDate && report.carrier_schema_id === selectedSchema.id
    )) ?? null;
  }, [reportMonth, reports, carrierSchemas, carrierSchemaKey]);

  const canSubmit = Boolean(selectedSchema && reportMonth && file && !isSubmitting);

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!selectedSchema || !file) {
      return;
    }

    setSubmitError(null);

    try {
      await onSubmit({
        file,
        reportMonth,
        carrierSchemaId: selectedSchema.id,
        carrierSchemaKey: selectedSchema.schema_key,
        bonusProjectionDollars: bonusProjection ? Number(bonusProjection) : null,
      });
      setFile(null);
      setBonusProjection('');
      setSubmitError(null);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Upload failed.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Business Metrics Report</DialogTitle>
          <DialogDescription>
            Upload your monthly carrier report and parse it into Growth Center metrics.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gc-carrier">Carrier</Label>
            <Select value={carrierSchemaKey} onValueChange={setCarrierSchemaKey}>
              <SelectTrigger id="gc-carrier">
                <SelectValue placeholder="Select carrier schema" />
              </SelectTrigger>
              <SelectContent>
                {carrierSchemas.map((schema) => (
                  <SelectItem key={schema.id} value={schema.schema_key}>
                    {schema.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gc-report-month">Report Month</Label>
            <Input
              id="gc-report-month"
              type="month"
              value={reportMonth}
              onChange={(event) => setReportMonth(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gc-bonus-projection">Bonus Projection (optional)</Label>
            <Input
              id="gc-bonus-projection"
              type="number"
              inputMode="decimal"
              placeholder="93259"
              value={bonusProjection}
              onChange={(event) => setBonusProjection(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gc-file">Report File (.xlsx)</Label>
            <Input
              id="gc-file"
              type="file"
              accept=".xlsx"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <div className="text-xs text-muted-foreground">
              Accepted format: `.xlsx`
            </div>
          </div>

          {duplicateReport && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Report month already exists</AlertTitle>
              <AlertDescription>
                A report for {toMonthLabel(duplicateReport.report_month)} already exists.
                Uploading again will replace data for that month.
              </AlertDescription>
            </Alert>
          )}

          {submitError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Upload failed</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Upload & Parse
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
