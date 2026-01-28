import { useState, useCallback, useRef } from "react";
import { format } from "date-fns";
import { CheckCircle, Loader2, AlertCircle, FileSpreadsheet, Info } from "lucide-react";
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
import { parseCompensationStatement, ParsedStatement } from "@/lib/allstate-parser";
import { compareStatements, validateRates, analyzeBusinessTypeMix, calculateCommissionSummary, detectLargeCancellations, analyzeSubProducers } from "@/lib/allstate-analyzer";
import { AAPLevel } from "@/lib/allstate-rates";
import { toast } from "sonner";
import { useMultiLocationUpload } from "@/hooks/useMultiLocationUpload";
import { MultiLocationUploadSection } from "./MultiLocationUploadSection";

interface StatementUploaderProps {
  onReportGenerated: (reportId: string) => void;
}

interface AgencyCompSettings {
  state: string;
  aap_level: string;
  agency_tier: string | null;
}

interface ParsedLocationData {
  locationId: number;
  agentNumber: string;
  parsed: ParsedStatement;
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
  if (!month || !year) return true;
  return year > 2024 || (year === 2024 && month >= 10);
};

export function StatementUploader({ onReportGenerated }: StatementUploaderProps) {
  const { user } = useAuth();
  const upload = useMultiLocationUpload();
  
  // Store parsed transaction data per location
  const parsedPriorData = useRef<Map<number, ParsedLocationData>>(new Map());
  const parsedCurrentData = useRef<Map<number, ParsedLocationData>>(new Map());
  
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
      return data as AgencyCompSettings | null;
    },
    enabled: !!agencyId,
  });
  
  // Period selection
  const [priorMonth, setPriorMonth] = useState<number | null>(null);
  const [priorYear, setPriorYear] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState<number | null>(null);
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  
  // VC Baseline
  const [priorVcBaseline, setPriorVcBaseline] = useState(false);
  const [currentVcBaseline, setCurrentVcBaseline] = useState(false);
  
  // Processing
  const [processing, setProcessing] = useState(false);

  // Handle file selection and parsing
  const handleFileSelect = useCallback(async (
    period: 'prior' | 'current',
    locationId: number,
    file: File
  ) => {
    upload.setLocationFile(period, locationId, file);
    
    try {
      const result = await parseCompensationStatement(file);
      
      if (result.parseErrors.length > 0) {
        console.warn(`[Upload] Parse warnings for ${period} location ${locationId}:`, result.parseErrors);
      }
      
      // Store parsed data
      const dataMap = period === 'prior' ? parsedPriorData : parsedCurrentData;
      dataMap.current.set(locationId, {
        locationId,
        agentNumber: result.agentNumber,
        parsed: result
      });
      
      upload.setLocationParsed(
        period,
        locationId,
        result.agentNumber,
        result.transactions.length
      );
      
      console.log(`[Upload] Parsed ${period} location ${locationId}:`, {
        agentNumber: result.agentNumber,
        transactionCount: result.transactions.length
      });
      
    } catch (error) {
      console.error(`[Upload] Parse error for ${period} location ${locationId}:`, error);
      upload.setLocationError(
        period,
        locationId,
        error instanceof Error ? error.message : 'Failed to parse file'
      );
    }
  }, [upload]);

  // Handle file clear
  const handleClear = useCallback((period: 'prior' | 'current', locationId: number) => {
    upload.clearLocation(period, locationId);
    const dataMap = period === 'prior' ? parsedPriorData : parsedCurrentData;
    dataMap.current.delete(locationId);
  }, [upload]);

  // Validation
  const priorDateValid = isDateValid(priorMonth, priorYear);
  const currentDateValid = isDateValid(currentMonth, currentYear);
  const periodsSelected = priorMonth && priorYear && currentMonth && currentYear;
  
  // Settings validation
  const settingsConfigured = Boolean(settings?.state && settings?.aap_level);
  const isNoVcState = settings?.state ? NO_VC_STATES.includes(settings.state) : false;
  const showVcBaseline = settingsConfigured && !isNoVcState;
  
  // Check if all required files are uploaded
  const filesUploaded = upload.hasAllCurrentUploads && upload.hasAnyPriorUploads;
  const canProcess = periodsSelected && priorDateValid && currentDateValid && filesUploaded && settingsConfigured && !processing;

  // Calculate totals for display
  const currentTransactionCount = upload.currentPeriod
    .filter(l => l.status === 'parsed')
    .reduce((sum, l) => sum + (l.transactionCount || 0), 0);
    
  const priorTransactionCount = upload.priorPeriod
    .filter(l => l.status === 'parsed')
    .reduce((sum, l) => sum + (l.transactionCount || 0), 0);

  const parsedCurrentLocations = upload.currentPeriod.filter(l => l.status === 'parsed');
  const parsedPriorLocations = upload.priorPeriod.filter(l => l.status === 'parsed');

  const handleGenerateReport = async () => {
    if (!canProcess || !agencyId || !user?.id || !settings) return;
    
    setProcessing(true);
    
    try {
      // Combine all parsed data from all locations
      const combineParsedStatements = (dataMap: Map<number, ParsedLocationData>): ParsedStatement => {
        const allTransactions: ParsedStatement['transactions'] = [];
        let writtenPremium = 0;
        let baseCommission = 0;
        let variableComp = 0;
        let totalCommission = 0;
        const allErrors: string[] = [];
        let combinedAgentNumber = '';
        
        for (const [, data] of dataMap) {
          // Add agentNumber to each transaction for multi-location filtering
          const transactionsWithAgent = data.parsed.transactions.map(tx => ({
            ...tx,
            agentNumber: data.agentNumber
          }));
          allTransactions.push(...transactionsWithAgent);
          writtenPremium += data.parsed.totals.writtenPremium;
          baseCommission += data.parsed.totals.baseCommission;
          variableComp += data.parsed.totals.variableComp;
          totalCommission += data.parsed.totals.totalCommission;
          allErrors.push(...data.parsed.parseErrors);
          if (!combinedAgentNumber && data.agentNumber) {
            combinedAgentNumber = data.agentNumber;
          }
        }
        
        return {
          agentNumber: combinedAgentNumber,
          agentName: '',
          transactions: allTransactions,
          totals: {
            writtenPremium,
            baseCommission,
            variableComp,
            totalCommission
          },
          parseErrors: allErrors
        };
      };
      
      const priorParsed = combineParsedStatements(parsedPriorData.current);
      const currentParsed = combineParsedStatements(parsedCurrentData.current);
      
      console.log('=== COMBINED PRIOR STATEMENT ===');
      console.log('Locations:', parsedPriorData.current.size);
      console.log('Transactions:', priorParsed.transactions.length);
      console.log('Totals:', priorParsed.totals);
      
      console.log('=== COMBINED CURRENT STATEMENT ===');
      console.log('Locations:', parsedCurrentData.current.size);
      console.log('Transactions:', currentParsed.transactions.length);
      console.log('Totals:', currentParsed.totals);
      
      // Upload files to storage - use first location's file for now
      // In future, could store all files or create a combined reference
      toast.info("Uploading statements...");
      
      const firstPriorLocation = upload.priorPeriod.find(l => l.file);
      const firstCurrentLocation = upload.currentPeriod.find(l => l.file);
      
      if (!firstPriorLocation?.file || !firstCurrentLocation?.file) {
        throw new Error('Missing required files');
      }
      
      const [priorUpload, currentUpload] = await Promise.all([
        uploadStatement({
          agencyId,
          file: firstPriorLocation.file,
          month: priorMonth!,
          year: priorYear!,
          vcBaselineAchieved: priorVcBaseline,
          uploadedBy: user.id,
        }),
        uploadStatement({
          agencyId,
          file: firstCurrentLocation.file,
          month: currentMonth!,
          year: currentYear!,
          vcBaselineAchieved: currentVcBaseline,
          uploadedBy: user.id,
        }),
      ]);

      // Check for duplicate uploads and warn user
      const duplicates: string[] = [];
      if (priorUpload.isDuplicate) {
        duplicates.push(`Prior period statement (${priorMonth}/${priorYear})`);
      }
      if (currentUpload.isDuplicate) {
        duplicates.push(`Current period statement (${currentMonth}/${currentYear})`);
      }
      if (duplicates.length > 0) {
        toast.warning(`Duplicate file detected: ${duplicates.join(', ')}. The file content matches a previously uploaded statement.`, {
          duration: 6000,
        });
      }

      // Run comparison
      toast.info("Comparing statements...");
      const comparison = compareStatements(priorParsed, currentParsed);
      
      // Run rate validation on current period
      const aapLevel = settings.aap_level as AAPLevel;
      const validation = validateRates(
        currentParsed.transactions,
        settings.state,
        aapLevel,
        currentVcBaseline
      );
      
      // Run business type mix analysis
      const mixAnalysis = analyzeBusinessTypeMix(
        priorParsed.transactions,
        currentParsed.transactions
      );
      
      // Calculate commission rate summaries
      const priorCommissionSummary = calculateCommissionSummary(priorParsed.transactions);
      const currentCommissionSummary = calculateCommissionSummary(currentParsed.transactions);
      
      // Detect large cancellations
      const largeCancellations = detectLargeCancellations(currentParsed.transactions, 1000);
      
      // Analyze sub-producer breakdown
      const statementMonth = new Date(currentYear!, currentMonth! - 1, 1);
      const subProducerData = analyzeSubProducers(currentParsed.transactions, statementMonth);
      
      // Save report to database
      toast.info("Saving report...");
      
      // Get agent numbers from all locations
      const agentNumbers = Array.from(parsedCurrentData.current.values())
        .map(d => d.agentNumber)
        .filter(Boolean);
      
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
        multiLocation: {
          locationCount: upload.locationCount,
          agentNumbers,
        },
        // Store transactions for By Location tab
        currentTransactions: currentParsed.transactions,
        priorTransactions: priorParsed.transactions,
      };
      
      const { data: report, error: reportError } = await supabase
        .from('comp_comparison_reports')
        .insert({
          agency_id: agencyId,
          prior_upload_id: priorUpload.id,
          current_upload_id: currentUpload.id,
          comparison_data: combinedData as unknown as Record<string, unknown>,
          summary_data: comparison.summary as unknown as Record<string, unknown>,
          discrepancies_found: validation.potentialUnderpayments.length,
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

      {/* Step 2 & 3: Multi-Location Upload Section */}
      <MultiLocationUploadSection
        locationCount={upload.locationCount}
        priorPeriod={upload.priorPeriod}
        currentPeriod={upload.currentPeriod}
        onLocationCountChange={upload.setLocationCount}
        onFileSelect={handleFileSelect}
        onClear={handleClear}
      />

      {/* Step 4: Variable Compensation Baseline - Only show for VC-eligible states */}
      {showVcBaseline && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Step 4: Variable Compensation Baseline</CardTitle>
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
        <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <Info className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-400">
              {settings?.state} does not allow variable compensation
            </p>
            <p className="text-sm text-blue-400/80 mt-1">
              Analysis will focus on base commission rates only.
            </p>
          </div>
        </div>
      )}

      {/* Step 5: Confirm & Process */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step {isNoVcState ? '4' : '5'}: Confirm & Process</CardTitle>
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
          ) : !settingsConfigured ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please configure your state and AAP level in the Settings tab before processing.
              </AlertDescription>
            </Alert>
          ) : !upload.hasAllCurrentUploads ? (
            <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-400">
                Please upload current period statements for all {upload.locationCount} location{upload.locationCount > 1 ? 's' : ''}.
              </p>
            </div>
          ) : !upload.hasAnyPriorUploads ? (
            <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-400">
                Please upload at least one prior period statement for comparison.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-400">Ready to analyze</p>
                <div className="text-sm text-green-400/80 mt-1 space-y-0.5">
                  <p>
                    {parsedCurrentLocations.length} location{parsedCurrentLocations.length > 1 ? 's' : ''} • {currentTransactionCount.toLocaleString()} transactions
                  </p>
                  {parsedCurrentLocations.length > 1 && (
                    <p>
                      Agent Numbers: {parsedCurrentLocations.map(l => l.agentNumber).filter(Boolean).join(', ')}
                    </p>
                  )}
                  <p>
                    Prior period: {parsedPriorLocations.length} location{parsedPriorLocations.length > 1 ? 's' : ''} • {priorTransactionCount.toLocaleString()} transactions
                  </p>
                  <p className="text-xs">
                    Settings: {settings?.state} • {settings?.aap_level}
                    {isNoVcState ? ' • Base Commission Only' : ''}
                  </p>
                </div>
              </div>
            </div>
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
              <>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Generate {upload.locationCount > 1 ? 'Combined ' : ''}Comparison Report
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
