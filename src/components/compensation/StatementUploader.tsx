import { useState, useCallback } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { uploadStatement } from "@/lib/compensation/uploadStatement";
import { parseCompensationStatement } from "@/lib/allstate-parser";
import { compareStatements, validateRates, analyzeBusinessTypeMix, calculateCommissionSummary, detectLargeCancellations, analyzeSubProducers } from "@/lib/allstate-analyzer";
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

// States that don't allow variable compensation
const NO_VC_STATES = ['NY', 'NJ', 'CA', 'CT', 'FL'];

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
  
  // Fetch agencyId from user's profile directly
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile-for-comp', user?.id],
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', authUser.id)
        .maybeSingle();
      
      if (error) {
        console.error('[StatementUploader] Profile fetch error:', error);
        return null;
      }
      console.log('[StatementUploader] Profile loaded:', data);
      return data;
    },
    enabled: !!user?.id,
  });

  const agencyId = profile?.agency_id;

  // Fetch settings using that agencyId
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['comp-settings', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agency_comp_settings')
        .select('state, aap_level, agency_tier')
        .eq('agency_id', agencyId!)
        .maybeSingle();
      
      if (error) {
        console.error('[StatementUploader] Settings fetch error:', error);
        return null;
      }
      console.log('[StatementUploader] Settings loaded:', data);
      return data as AgencyCompSettings | null;
    },
    enabled: !!agencyId,
  });
  
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
  
  // Processing
  const [processing, setProcessing] = useState(false);

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
  
  // Settings validation
  const settingsConfigured = Boolean(settings?.state && settings?.aap_level);
  const isNoVcState = settings?.state ? NO_VC_STATES.includes(settings.state) : false;
  const showVcBaseline = settingsConfigured && !isNoVcState;
  
  const canProcess = periodsSelected && priorDateValid && currentDateValid && filesUploaded && settingsConfigured && !processing;

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
      
      // Debug logging for parsed statements
      console.log('=== PRIOR STATEMENT ===');
      console.log('Transactions:', priorParsed.transactions.length);
      console.log('Totals:', priorParsed.totals);
      
      console.log('=== CURRENT STATEMENT ===');
      console.log('Transactions:', currentParsed.transactions.length);
      console.log('Totals:', currentParsed.totals);
      
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
      
      // Step 5: Run business type mix analysis
      const mixAnalysis = analyzeBusinessTypeMix(
        priorParsed.transactions,
        currentParsed.transactions
      );
      
      // Step 6: Calculate commission rate summaries
      const priorCommissionSummary = calculateCommissionSummary(priorParsed.transactions);
      const currentCommissionSummary = calculateCommissionSummary(currentParsed.transactions);
      
      // Step 7: Detect large cancellations (use $1,000 threshold to capture all, component filters)
      const largeCancellations = detectLargeCancellations(currentParsed.transactions, 1000);
      
      // Step 8: Analyze sub-producer breakdown (First-term New Business only)
      // Pass the statement month for accurate first-term cutoff calculation
      const statementMonth = new Date(currentYear!, currentMonth! - 1, 1); // Month is 0-indexed in Date
      const subProducerData = analyzeSubProducers(currentParsed.transactions, statementMonth);
      
      // Step 9: Save report to database
      toast.info("Saving report...");
      
      // Combine comparison, validation, and analysis results for storage
      const combinedData = {
        comparison,
        validation: {
          total: validation.total,
          analyzed: validation.analyzed,
          discrepancies: validation.discrepancies,
          potentialUnderpayments: validation.potentialUnderpayments,
          excludedTransactions: validation.excludedTransactions,
          exclusionBreakdown: validation.exclusionBreakdown,
          totalMissingVcDollars: validation.totalMissingVcDollars,
          vcBaselineAchieved: validation.vcBaselineAchieved,
          state: validation.state,
          aapLevel: validation.aapLevel,
          summary: validation.summary,
          warnings: validation.warnings,
        },
        mixAnalysis,
        commissionSummary: {
          prior: priorCommissionSummary,
          current: currentCommissionSummary,
        },
        largeCancellations,
        subProducerData,
        periodLabels: {
          prior: `${getMonthName(priorMonth!)} ${priorYear}`,
          current: `${getMonthName(currentMonth!)} ${currentYear}`,
        },
      };
      
      const { data: report, error: reportError } = await supabase
        .from('comp_comparison_reports')
        .insert({
          agency_id: agencyId,
          prior_upload_id: priorUpload.id,
          current_upload_id: currentUpload.id,
          comparison_data: combinedData as unknown as Record<string, unknown>,
          summary_data: comparison.summary as unknown as Record<string, unknown>,
          discrepancies_found: validation.potentialUnderpayments.length, // Only count real underpayments
          potential_underpayment_cents: Math.round(validation.totalMissingVcDollars * 100),
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

  if (profileLoading) {
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

      {/* Step 3: Variable Compensation Baseline - Only show for VC-eligible states */}
      {showVcBaseline && (
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
      )}

      {/* Info message for no-VC states */}
      {settingsConfigured && isNoVcState && (
        <Card>
          <CardContent className="pt-6">
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-400">
                {settings?.state} does not allow variable compensation. Analysis will focus on base commission rates only.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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
          ) : settingsConfigured ? (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-sm text-green-400">
                Settings configured: {settings?.state} • {settings?.aap_level}
                {isNoVcState ? ' • Base Commission Only' : ''}
              </p>
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
