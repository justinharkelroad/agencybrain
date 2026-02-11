import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Upload } from 'lucide-react';
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
  prefillReportMonth?: string | null;
  prefillCarrierSchemaKey?: string | null;
  onSubmit: (input: CreateBusinessMetricsReportInput) => Promise<void>;
  isSubmitting?: boolean;
}

const MONTH_OPTIONS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const MONTH_NAME_TO_NUMBER: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

function currentMonthValue(): string {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function normalizeToYearMonth(value: string | null | undefined): string | null {
  if (!value) return null;
  const yearMonth = value.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) return null;
  const month = Number(yearMonth.slice(5, 7));
  if (month < 1 || month > 12) return null;
  return yearMonth;
}

function toMonthLabelFromYearMonth(value: string): string {
  const d = new Date(`${value}-01T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function detectReportMonthFromFilename(fileName: string): string | null {
  const text = fileName.toLowerCase();

  const yyyyMm = text.match(/\b(20\d{2})[-_ ](0[1-9]|1[0-2])\b/);
  if (yyyyMm) {
    return `${yyyyMm[1]}-${yyyyMm[2]}`;
  }

  const mmYyyy = text.match(/\b(0[1-9]|1[0-2])[-_ ](20\d{2})\b/);
  if (mmYyyy) {
    return `${mmYyyy[2]}-${mmYyyy[1]}`;
  }

  const monthNameRegex = /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)/i;

  const monthThenYear = text.match(new RegExp(`${monthNameRegex.source}[\\s._-]*(20\\d{2})`, 'i'));
  if (monthThenYear) {
    const month = MONTH_NAME_TO_NUMBER[monthThenYear[1].toLowerCase()];
    if (month) return `${monthThenYear[2]}-${month}`;
  }

  const yearThenMonth = text.match(new RegExp(`(20\\d{2})[\\s._-]*${monthNameRegex.source}`, 'i'));
  if (yearThenMonth) {
    const month = MONTH_NAME_TO_NUMBER[yearThenMonth[2].toLowerCase()];
    if (month) return `${yearThenMonth[1]}-${month}`;
  }

  return null;
}

export function GCUploadDialog({
  open,
  onOpenChange,
  carrierSchemas,
  reports,
  defaultCarrierSchemaKey,
  prefillReportMonth,
  prefillCarrierSchemaKey,
  onSubmit,
  isSubmitting = false,
}: GCUploadDialogProps) {
  const [carrierSchemaKey, setCarrierSchemaKey] = useState<string>(defaultCarrierSchemaKey ?? '');
  const [reportMonth, setReportMonth] = useState<string>(currentMonthValue);
  const [bonusProjection, setBonusProjection] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [monthManuallyEdited, setMonthManuallyEdited] = useState(false);
  const [detectedMonthFromFile, setDetectedMonthFromFile] = useState<string | null>(null);
  const wasOpenRef = useRef(false);

  const effectivePrefillMonth = normalizeToYearMonth(prefillReportMonth) ?? currentMonthValue();
  const effectivePrefillSchemaKey = prefillCarrierSchemaKey ?? defaultCarrierSchemaKey ?? carrierSchemas[0]?.schema_key ?? '';

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    if (justOpened) {
      setCarrierSchemaKey(effectivePrefillSchemaKey);
      setReportMonth(effectivePrefillMonth);
      setBonusProjection('');
      setFile(null);
      setSubmitError(null);
      setMonthManuallyEdited(false);
      setDetectedMonthFromFile(null);
    }
    wasOpenRef.current = open;
  }, [open, effectivePrefillSchemaKey, effectivePrefillMonth]);

  const selectedSchema = useMemo(
    () => carrierSchemas.find((schema) => schema.schema_key === carrierSchemaKey) ?? null,
    [carrierSchemaKey, carrierSchemas]
  );

  const selectedYear = reportMonth.slice(0, 4);
  const selectedMonthNumber = reportMonth.slice(5, 7);

  const yearOptions = useMemo(() => {
    const yearSet = new Set<number>();
    const currentYear = new Date().getFullYear();

    yearSet.add(currentYear - 1);
    yearSet.add(currentYear);
    yearSet.add(currentYear + 1);

    for (const report of reports) {
      const year = Number(report.report_month.slice(0, 4));
      if (Number.isFinite(year)) {
        yearSet.add(year);
      }
    }

    const prefillYear = Number(effectivePrefillMonth.slice(0, 4));
    if (Number.isFinite(prefillYear)) {
      yearSet.add(prefillYear);
    }

    return Array.from(yearSet).sort((a, b) => b - a).map(String);
  }, [reports, effectivePrefillMonth]);

  const duplicateReport = useMemo(() => {
    const monthDate = `${reportMonth}-01`;
    const schema = carrierSchemas.find((item) => item.schema_key === carrierSchemaKey);
    if (!schema) return null;
    return reports.find((report) => (
      report.report_month === monthDate && report.carrier_schema_id === schema.id
    )) ?? null;
  }, [reportMonth, reports, carrierSchemas, carrierSchemaKey]);

  const fileMonthMismatch = detectedMonthFromFile && detectedMonthFromFile !== reportMonth;
  const canSubmit = Boolean(selectedSchema && reportMonth && file && !isSubmitting);

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  const handleYearChange = (year: string) => {
    setMonthManuallyEdited(true);
    setReportMonth(`${year}-${selectedMonthNumber || '01'}`);
  };

  const handleMonthChange = (month: string) => {
    setMonthManuallyEdited(true);
    setReportMonth(`${selectedYear || String(new Date().getFullYear())}-${month}`);
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
            <Label>Report Month</Label>
            <div className="grid grid-cols-2 gap-2">
              <Select value={selectedMonthNumber} onValueChange={handleMonthChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedYear} onValueChange={handleYearChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground">
              Selected month: <span className="font-medium">{toMonthLabelFromYearMonth(reportMonth)}</span>
            </div>
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
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                setFile(nextFile);

                if (!nextFile) {
                  setDetectedMonthFromFile(null);
                  return;
                }

                const detectedMonth = detectReportMonthFromFilename(nextFile.name);
                setDetectedMonthFromFile(detectedMonth);

                if (detectedMonth && !monthManuallyEdited) {
                  setReportMonth(detectedMonth);
                }
              }}
            />
            <div className="text-xs text-muted-foreground">
              Accepted format: `.xlsx`
            </div>
          </div>

          {detectedMonthFromFile && fileMonthMismatch && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Filename month differs from selected month</AlertTitle>
              <AlertDescription>
                File looks like <strong>{toMonthLabelFromYearMonth(detectedMonthFromFile)}</strong>, but selected month is <strong>{toMonthLabelFromYearMonth(reportMonth)}</strong>.
                Confirm this is intentional before uploading.
              </AlertDescription>
            </Alert>
          )}

          {duplicateReport && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Report month already exists</AlertTitle>
              <AlertDescription>
                A report for {toMonthLabelFromYearMonth(reportMonth)} already exists.
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
