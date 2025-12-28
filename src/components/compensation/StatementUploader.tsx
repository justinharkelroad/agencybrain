import { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { format } from "date-fns";
import { Upload, CheckCircle, Loader2, AlertCircle, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { uploadStatement } from "@/lib/compensation/uploadStatement";
import { parseCompensationStatement } from "@/lib/allstate-parser";
import { compareStatements, validateRates } from "@/lib/allstate-analyzer";
import { AAPLevel } from "@/lib/allstate-rates";
import { toast } from "sonner";

interface StatementUploaderProps {
  onReportGenerated: (reportId: string) => void;
}

interface AgencyCompSettings {
  state: string;
  aap_level: string;
  agency_tier: string | null;
}

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const YEARS = [2024, 2025, 2026];

const getMonthName = (month: number) => {
  return format(new Date(2024, month - 1, 1), "MMM");
};

const isDateValid = (month: number | null, year: number | null): boolean => {
  if (!month || !year) return true; // Don't show error if not selected yet
  // October 2024 = month 10, year 2024
  return year > 2024 || (year === 2024 && month >= 10);
};

export function StatementUploader({ onReportGenerated }: StatementUploaderProps) {
  const { user } = useAuth();
  const { agencyId, loading: permissionsLoading } = useUserPermissions();
  
  // Period selection
  const [priorMonth, setPriorMonth] = useState<number | null>(null);
  const [priorYear, setPriorYear] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState<number | null>(null);
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  
  // Files
  const [priorFile, setPriorFile] = useState<File | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  
  // VC Baseline
  const [priorVcBaseline, setPriorVcBaseline] = useState(false);
  const [currentVcBaseline, setCurrentVcBaseline] = useState(false);
  
  // Settings & processing
  const [settings, setSettings] = useState<AgencyCompSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Load agency comp settings
  useEffect(() => {
    const loadSettings = async () => {
      console.log('[StatementUploader] loadSettings called', { agencyId, permissionsLoading });
      
      if (!agencyId) {
        console.log('[StatementUploader] No agencyId, skipping settings load');
        setSettingsLoading(false);
        return;
      }
      
      try {
        console.log('[StatementUploader] Fetching settings for agency:', agencyId);
        const { data, error } = await supabase
          .from('agency_comp_settings')
          .select('state, aap_level, agency_tier')
          .eq('agency_id', agencyId)
          .maybeSingle();
        
        console.log('[StatementUploader] Settings query result:', { data, error });
        
        if (error) {
          console.error('[StatementUploader] Error loading settings:', error);
        }
        
        setSettings(data);
      } catch (err) {
        console.error('[StatementUploader] Exception loading settings:', err);
      } finally {
        setSettingsLoading(false);
      }
    };
    
    console.log('[StatementUploader] useEffect triggered', { agencyId, permissionsLoading });
    
    if (!permissionsLoading) {
      loadSettings();
    }
  }, [agencyId, permissionsLoading]);
  
  // Debug log current state
  console.log('[StatementUploader] Current state:', { settings, settingsLoading, agencyId, permissionsLoading });

  // Prior file dropzone
  const onDropPrior = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setPriorFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps: getPriorRootProps, getInputProps: getPriorInputProps, isDragActive: isPriorDragActive } = useDropzone({
    onDrop: onDropPrior,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  });

  // Current file dropzone
  const onDropCurrent = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setCurrentFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps: getCurrentRootProps, getInputProps: getCurrentInputProps, isDragActive: isCurrentDragActive } = useDropzone({
    onDrop: onDropCurrent,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  });

  // Validation
  const priorDateValid = isDateValid(priorMonth, priorYear);
  const currentDateValid = isDateValid(currentMonth, currentYear);
  const periodsSelected = priorMonth && priorYear && currentMonth && currentYear;
  const filesUploaded = priorFile && currentFile;
  const canProcess = periodsSelected && priorDateValid && currentDateValid && filesUploaded && settings && !processing;

  const handleGenerateReport = async () => {
    if (!canProcess || !agencyId || !user?.id || !settings) return;
    
    setProcessing(true);
    
    try {
      // Step 1: Parse both files locally (we have the File objects)
      toast.info("Parsing statements...");
      const [priorParsed, currentParsed] = await Promise.all([
        parseCompensationStatement(priorFile!),
        parseCompensationStatement(currentFile!),
      ]);
      
      // Check for parsing errors
      if (priorParsed.parseErrors.length > 0 || currentParsed.parseErrors.length > 0) {
        console.warn('Parse warnings:', { prior: priorParsed.parseErrors, current: currentParsed.parseErrors });
      }
      
      // Step 2: Upload files to storage
      toast.info("Uploading statements...");
      const [priorUpload, currentUpload] = await Promise.all([
        uploadStatement({
          agencyId,
          file: priorFile!,
          month: priorMonth!,
          year: priorYear!,
          vcBaselineAchieved: priorVcBaseline,
          uploadedBy: user.id,
        }),
        uploadStatement({
          agencyId,
          file: currentFile!,
          month: currentMonth!,
          year: currentYear!,
          vcBaselineAchieved: currentVcBaseline,
          uploadedBy: user.id,
        }),
      ]);
      
      // Step 3: Run comparison
      toast.info("Comparing statements...");
      const comparison = compareStatements(priorParsed, currentParsed);
      
      // Step 4: Run rate validation on current period
      const aapLevel = settings.aap_level as AAPLevel;
      const validation = validateRates(
        currentParsed.transactions,
        settings.state,
        aapLevel,
        currentVcBaseline
      );
      
      // Step 5: Save report to database
      toast.info("Saving report...");
      const { data: report, error: reportError } = await supabase
        .from('comp_comparison_reports')
        .insert({
          agency_id: agencyId,
          prior_upload_id: priorUpload.id,
          current_upload_id: currentUpload.id,
          comparison_data: comparison as unknown as Record<string, unknown>,
          summary_data: comparison.summary as unknown as Record<string, unknown>,
          discrepancies_found: validation.summary.discrepanciesFound,
          potential_underpayment_cents: validation.summary.potentialUnderpaymentCents,
          created_by: user.id,
        })
        .select('id')
        .single();
      
      if (reportError) {
        throw new Error(`Failed to save report: ${reportError.message}`);
      }
      
      toast.success("Report generated successfully!");
      onReportGenerated(report.id);
    } catch (err) {
      console.error('Error generating report:', err);
      toast.error(err instanceof Error ? err.message : "Failed to generate report. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Select Comparison Period */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step 1: Select Comparison Period</CardTitle>
          <CardDescription>
            Choose the months you want to compare. Data must be from October 2024 or later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Prior Period */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Prior Period</Label>
              <div className="flex gap-3">
                <Select
                  value={priorMonth?.toString() || ""}
                  onValueChange={(v) => setPriorMonth(parseInt(v))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value.toString()}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={priorYear?.toString() || ""}
                  onValueChange={(v) => setPriorYear(parseInt(v))}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!priorDateValid && (
                <p className="text-sm text-destructive">Must be October 2024 or later</p>
              )}
            </div>

            {/* Current Period */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Current Period</Label>
              <div className="flex gap-3">
                <Select
                  value={currentMonth?.toString() || ""}
                  onValueChange={(v) => setCurrentMonth(parseInt(v))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value.toString()}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={currentYear?.toString() || ""}
                  onValueChange={(v) => setCurrentYear(parseInt(v))}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!currentDateValid && (
                <p className="text-sm text-destructive">Must be October 2024 or later</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Upload Statement Files */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step 2: Upload Statement Files</CardTitle>
          <CardDescription>
            Upload your compensation statement Excel files (.xlsx or .xls)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Prior File */}
            <div className="space-y-3">
              <Label className="text-base font-medium">
                Prior Period Statement
                {priorMonth && priorYear && (
                  <span className="text-muted-foreground font-normal ml-2">
                    ({getMonthName(priorMonth)} {priorYear})
                  </span>
                )}
              </Label>
              <div
                {...getPriorRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                  ${isPriorDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                  ${priorFile ? 'border-green-500 bg-green-500/5' : ''}
                `}
              >
                <input {...getPriorInputProps()} />
                {priorFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                    <p className="text-sm font-medium">{priorFile.name}</p>
                    <p className="text-xs text-muted-foreground">Click or drag to replace</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Drag & drop or click to select
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Current File */}
            <div className="space-y-3">
              <Label className="text-base font-medium">
                Current Period Statement
                {currentMonth && currentYear && (
                  <span className="text-muted-foreground font-normal ml-2">
                    ({getMonthName(currentMonth)} {currentYear})
                  </span>
                )}
              </Label>
              <div
                {...getCurrentRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                  ${isCurrentDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                  ${currentFile ? 'border-green-500 bg-green-500/5' : ''}
                `}
              >
                <input {...getCurrentInputProps()} />
                {currentFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                    <p className="text-sm font-medium">{currentFile.name}</p>
                    <p className="text-xs text-muted-foreground">Click or drag to replace</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Drag & drop or click to select
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Variable Compensation Baseline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step 3: Variable Compensation Baseline</CardTitle>
          <CardDescription>
            Indicate whether your agency achieved the VC baseline for each period. This affects bonus calculations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="prior-vc"
                checked={priorVcBaseline}
                onCheckedChange={(checked) => setPriorVcBaseline(checked === true)}
              />
              <Label htmlFor="prior-vc" className="text-sm font-normal cursor-pointer">
                {priorMonth && priorYear
                  ? `${getMonthName(priorMonth)} ${priorYear} - VC Baseline Achieved`
                  : "Prior Period - VC Baseline Achieved"}
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="current-vc"
                checked={currentVcBaseline}
                onCheckedChange={(checked) => setCurrentVcBaseline(checked === true)}
              />
              <Label htmlFor="current-vc" className="text-sm font-normal cursor-pointer">
                {currentMonth && currentYear
                  ? `${getMonthName(currentMonth)} ${currentYear} - VC Baseline Achieved`
                  : "Current Period - VC Baseline Achieved"}
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 4: Confirm & Process */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step 4: Confirm & Process</CardTitle>
          <CardDescription>
            Review your settings and generate the comparison report.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settingsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading settings...</span>
            </div>
          ) : settings ? (
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">State</p>
                <p className="font-medium">{settings.state}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">AAP Level</p>
                <p className="font-medium">{settings.aap_level}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Agency Tier</p>
                <p className="font-medium">{settings.agency_tier || "Not set"}</p>
              </div>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please configure your state and AAP level in the Settings tab before processing.
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleGenerateReport}
            disabled={!canProcess}
            className="w-full"
            size="lg"
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Generate Comparison Report"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
