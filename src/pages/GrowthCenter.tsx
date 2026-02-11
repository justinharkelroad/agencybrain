import { useEffect, useMemo, useState } from 'react';
import { Bot, ChevronDown, ChevronUp, FileSpreadsheet, Loader2, RefreshCcw, Trash2, TrendingUp, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { isStrictlyOneOnOne } from '@/utils/tierAccess';
import { useCarrierSchemas } from '@/hooks/useCarrierSchemas';
import { useBusinessMetricsReports } from '@/hooks/useBusinessMetricsReports';
import { useBusinessMetricsSnapshots } from '@/hooks/useBusinessMetricsSnapshots';
import { useGICAnalysis } from '@/hooks/useGICAnalysis';
import { GCUploadDialog } from '@/components/growth-center/GCUploadDialog';
import { GCTrendChart } from '@/components/growth-center/GCTrendChart';
import { GCComparisonTable } from '@/components/growth-center/GCComparisonTable';
import { GCRetentionTab } from '@/components/growth-center/GCRetentionTab';
import { GCPremiumTab } from '@/components/growth-center/GCPremiumTab';
import { GCLossRatioTab } from '@/components/growth-center/GCLossRatioTab';

function currencyFromCents(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '--';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function percentValue(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '--';
  }
  return `${(value * 100).toFixed(2)}%`;
}

function numberValue(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '--';
  }
  return new Intl.NumberFormat('en-US').format(value);
}

function monthLabelFromDateString(value: string): string {
  const d = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function monthLabelFromYearMonth(value: string): string {
  return monthLabelFromDateString(`${value}-01`);
}

function yearMonthFromReportDate(value: string): string {
  return value.slice(0, 7);
}

function uploadedAtLabel(value: string): string {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function sortByReportMonthAsc<T extends { report_month: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.report_month.localeCompare(b.report_month));
}

function sortByReportMonthDesc<T extends { report_month: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.report_month.localeCompare(a.report_month));
}

export default function GrowthCenter() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { membershipTier, tierLoading, isAdmin } = useAuth();
  const [selectedCarrierSchemaKey, setSelectedCarrierSchemaKey] = useState<string>('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [includeLqsData, setIncludeLqsData] = useState(true);
  const [includeScorecardData, setIncludeScorecardData] = useState(true);
  const [customQuestion, setCustomQuestion] = useState('');
  const [analysisPage, setAnalysisPage] = useState(1);
  const [reportsPickerOpen, setReportsPickerOpen] = useState(true);
  const [uploadedReportsOpen, setUploadedReportsOpen] = useState(false);
  const [lastRunDataUsage, setLastRunDataUsage] = useState<{
    quoting: 'included' | 'not_found' | 'off';
    scorecard: 'included' | 'not_found' | 'off';
  } | null>(null);
  const [uploadPrefillReportMonth, setUploadPrefillReportMonth] = useState<string | null>(null);
  const [uploadPrefillCarrierSchemaKey, setUploadPrefillCarrierSchemaKey] = useState<string | null>(null);

  const carrierSchemasQuery = useCarrierSchemas();
  const selectedCarrier = useMemo(
    () => carrierSchemasQuery.data?.find((schema) => schema.schema_key === selectedCarrierSchemaKey) ?? null,
    [carrierSchemasQuery.data, selectedCarrierSchemaKey]
  );

  useEffect(() => {
    if (!carrierSchemasQuery.data || carrierSchemasQuery.data.length === 0) return;
    const stillExists = carrierSchemasQuery.data.some((schema) => schema.schema_key === selectedCarrierSchemaKey);
    if (!selectedCarrierSchemaKey || !stillExists) {
      setSelectedCarrierSchemaKey(carrierSchemasQuery.data[0].schema_key);
    }
  }, [carrierSchemasQuery.data, selectedCarrierSchemaKey]);

  useEffect(() => {
    if (tierLoading) return;
    if (!isAdmin && !isStrictlyOneOnOne(membershipTier)) {
      toast({
        title: 'Access Restricted',
        description: "Growth Center is accessible to '1:1 Coaching' clients only.",
        variant: 'destructive',
      });
      navigate('/dashboard');
    }
  }, [membershipTier, tierLoading, isAdmin, navigate, toast]);

  const reportsQuery = useBusinessMetricsReports(selectedCarrier?.id);
  const snapshotsQuery = useBusinessMetricsSnapshots();
  const analysisQuery = useGICAnalysis();

  const latestReport = reportsQuery.latestReport;
  const carrierReportIds = useMemo(
    () => new Set(
      reportsQuery.reports
        .filter((report) => report.parse_status === 'parsed')
        .map((report) => report.id)
    ),
    [reportsQuery.reports]
  );
  const carrierSnapshots = useMemo(
    () => snapshotsQuery.snapshots.filter((snapshot) => carrierReportIds.has(snapshot.report_id)),
    [snapshotsQuery.snapshots, carrierReportIds]
  );
  const sortedCarrierSnapshots = useMemo(
    () => sortByReportMonthAsc(carrierSnapshots),
    [carrierSnapshots]
  );
  const latestSnapshot = sortedCarrierSnapshots[sortedCarrierSnapshots.length - 1] ?? null;

  const handleUpload = async (input: Parameters<typeof reportsQuery.createReport>[0]) => {
    await reportsQuery.createReport(input);
    toast({
      title: 'Report uploaded',
      description: `${monthLabelFromYearMonth(input.reportMonth)} report uploaded and parsed.`,
    });
  };

  const openUploadDialog = (opts?: { reportMonth?: string; carrierSchemaKey?: string }) => {
    setUploadPrefillReportMonth(opts?.reportMonth ?? null);
    setUploadPrefillCarrierSchemaKey(opts?.carrierSchemaKey ?? selectedCarrierSchemaKey ?? null);
    setUploadOpen(true);
  };

  const handleUploadDialogOpenChange = (nextOpen: boolean) => {
    setUploadOpen(nextOpen);
    if (!nextOpen) {
      setUploadPrefillReportMonth(null);
      setUploadPrefillCarrierSchemaKey(null);
    }
  };

  const handleDeleteReport = async (reportId: string, reportMonth: string, filename: string) => {
    const confirmed = window.confirm(
      `Delete ${filename} (${monthLabelFromDateString(reportMonth)})? This removes parsed data and trends for that month.`
    );
    if (!confirmed) {
      return;
    }

    try {
      await reportsQuery.deleteReport(reportId);
      toast({
        title: 'Report deleted',
        description: `${monthLabelFromDateString(reportMonth)} was removed.`,
      });
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Could not delete report.',
        variant: 'destructive',
      });
    }
  };

  const isLoading = carrierSchemasQuery.isLoading || reportsQuery.isLoading || snapshotsQuery.isLoading || tierLoading;
  const hasReports = reportsQuery.reports.length > 0;
  const analysisEligibleReports = useMemo(
    () => sortByReportMonthDesc(reportsQuery.reports.filter((report) => report.parse_status === 'parsed')),
    [reportsQuery.reports]
  );
  const latestAnalysis = analysisQuery.analyses[0] ?? null;
  const ANALYSIS_PAGE_SIZE = 6;
  const latestSavedDataUsage = useMemo(() => {
    if (!latestAnalysis) return null;
    return {
      quoting: latestAnalysis.included_lqs_data ? 'included' : 'not_found',
      scorecard: latestAnalysis.included_scorecard_data ? 'included' : 'not_found',
    };
  }, [latestAnalysis]);

  useEffect(() => {
    const validIds = new Set(analysisEligibleReports.map((report) => report.id));
    const filtered = selectedReportIds.filter((id) => validIds.has(id));
    if (filtered.length > 0) {
      if (filtered.length !== selectedReportIds.length) {
        setSelectedReportIds(filtered);
      }
      return;
    }

    const defaults = analysisEligibleReports
      .slice(0, 3)
      .map((report) => report.id);

    if (defaults.length > 0) {
      setSelectedReportIds(defaults);
    } else if (selectedReportIds.length > 0) {
      setSelectedReportIds([]);
    }
  }, [analysisEligibleReports, selectedReportIds]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(analysisEligibleReports.length / ANALYSIS_PAGE_SIZE));
    if (analysisPage > totalPages) {
      setAnalysisPage(totalPages);
    }
  }, [analysisEligibleReports.length, analysisPage]);

  const handleToggleReport = (reportId: string, checked: boolean) => {
    if (checked && !selectedReportIds.includes(reportId) && selectedReportIds.length >= 3) {
      toast({
        title: 'Maximum reached',
        description: 'You can analyze up to 3 reports (one quarter) at a time.',
      });
      return;
    }

    setSelectedReportIds((prev) => {
      if (checked) {
        return prev.includes(reportId) ? prev : [...prev, reportId];
      }
      return prev.filter((id) => id !== reportId);
    });
  };

  const runAnalysis = async () => {
    if (selectedReportIds.length === 0) {
      toast({
        title: 'Select reports',
        description: 'Choose at least one report for analysis.',
        variant: 'destructive',
      });
      return;
    }
    if (selectedReportIds.length > 3) {
      toast({
        title: 'Too many reports selected',
        description: 'Please select at most 3 reports.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await analysisQuery.runAnalysis({
        reportIds: selectedReportIds,
        analysisType: 'monthly',
        includeLqsData,
        includeScorecardData,
        customQuestion: customQuestion.trim() || undefined,
      });

      const quotingStatus: 'included' | 'not_found' | 'off' =
        includeLqsData ? (result.included_lqs_data ? 'included' : 'not_found') : 'off';
      const scorecardStatus: 'included' | 'not_found' | 'off' =
        includeScorecardData ? (result.included_scorecard_data ? 'included' : 'not_found') : 'off';

      setLastRunDataUsage({
        quoting: quotingStatus,
        scorecard: scorecardStatus,
      });

      toast({
        title: 'Analysis complete',
        description: `Growth analysis generated. Quoting: ${quotingStatus.replace('_', ' ')}. Scorecard: ${scorecardStatus.replace('_', ' ')}.`,
      });
    } catch (error) {
      toast({
        title: 'Analysis failed',
        description: error instanceof Error ? error.message : 'Could not generate analysis.',
        variant: 'destructive',
      });
    }
  };

  const analysisTotalPages = Math.max(1, Math.ceil(analysisEligibleReports.length / ANALYSIS_PAGE_SIZE));
  const analysisPageStart = (analysisPage - 1) * ANALYSIS_PAGE_SIZE;
  const visibleAnalysisReports = analysisEligibleReports.slice(analysisPageStart, analysisPageStart + ANALYSIS_PAGE_SIZE);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              Growth Center
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Business metrics intelligence, trend diagnostics, and bonus planning.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedCarrierSchemaKey} onValueChange={setSelectedCarrierSchemaKey}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select carrier" />
              </SelectTrigger>
              <SelectContent>
                {(carrierSchemasQuery.data ?? []).map((schema) => (
                  <SelectItem key={schema.id} value={schema.schema_key}>
                    {schema.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => openUploadDialog()}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Report
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="py-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Agent</div>
                <div className="font-medium">{latestReport?.agent_name ?? 'Not parsed yet'}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Agent Code</div>
                <div className="font-medium">{latestReport?.agent_code ?? '--'}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Latest Report</div>
                <div className="font-medium">
                  {latestReport?.report_month ? monthLabelFromDateString(latestReport.report_month) : '--'}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Uploads</div>
                <div className="font-medium">{reportsQuery.reports.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {reportsQuery.error && (
          <Alert variant="destructive">
            <AlertTitle>Could not load Growth Center reports</AlertTitle>
            <AlertDescription>
              {(reportsQuery.error as Error).message}
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !hasReports ? (
          <Card>
            <CardContent className="text-center py-16">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground/50" strokeWidth={1} />
              </div>
              <h3 className="font-medium mb-2">No reports uploaded yet</h3>
              <p className="text-sm text-muted-foreground/70 mb-6 max-w-md mx-auto">
                Upload your first Business Metrics report to start tracking growth trajectory.
              </p>
              <Button onClick={() => openUploadDialog()}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Your First Report
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-5 w-full max-w-3xl">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="retention">Retention</TabsTrigger>
              <TabsTrigger value="premium">Premium</TabsTrigger>
              <TabsTrigger value="loss-ratio">Loss Ratio</TabsTrigger>
              <TabsTrigger value="bonus-planner">Bonus Planner</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Capped Items</CardDescription>
                    <CardTitle className="text-2xl">{numberValue(latestSnapshot?.capped_items_total)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary">Total P&C</Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Retention</CardDescription>
                    <CardTitle className="text-2xl">{percentValue(latestSnapshot?.retention_current)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary">Current Month</Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Premium YTD</CardDescription>
                    <CardTitle className="text-2xl">{currencyFromCents(latestSnapshot?.premium_ytd_total)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary">Total</Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Loss Ratio (12MM)</CardDescription>
                    <CardTitle className="text-2xl">{percentValue(latestSnapshot?.loss_ratio_12mm)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary">Adjusted Paid</Badge>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-medium">Uploaded Reports</CardTitle>
                      <CardDescription>
                        Verify months before analysis. Replace overwrites the same month and carrier.
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setUploadedReportsOpen((open) => !open)}
                    >
                      {uploadedReportsOpen ? <ChevronUp className="h-4 w-4 mr-1.5" /> : <ChevronDown className="h-4 w-4 mr-1.5" />}
                      {uploadedReportsOpen ? 'Hide uploads' : `Show uploads (${reportsQuery.reports.length})`}
                    </Button>
                  </div>
                </CardHeader>
                {uploadedReportsOpen ? (
                  <CardContent className="space-y-2">
                    {reportsQuery.reports.map((report) => (
                      <div key={report.id} className="border rounded-md px-3 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{monthLabelFromDateString(report.report_month)}</span>
                            <Badge variant={report.parse_status === 'parsed' ? 'secondary' : report.parse_status === 'error' ? 'destructive' : 'outline'}>
                              {report.parse_status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">{report.original_filename}</div>
                          <div className="text-xs text-muted-foreground">
                            Uploaded: {uploadedAtLabel(report.updated_at)}
                          </div>
                          {report.parse_error ? (
                            <div className="text-xs text-red-400">{report.parse_error}</div>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              openUploadDialog({
                                reportMonth: yearMonthFromReportDate(report.report_month),
                                carrierSchemaKey: selectedCarrierSchemaKey,
                              })
                            }
                          >
                            <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
                            Replace
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-400 border-red-500/40 hover:text-red-300"
                            onClick={() => handleDeleteReport(report.id, report.report_month, report.original_filename)}
                            disabled={reportsQuery.isDeletingReport}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                ) : null}
              </Card>

              <GCTrendChart snapshots={sortedCarrierSnapshots} />
              <GCComparisonTable snapshots={sortedCarrierSnapshots} />

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    AI Growth Analysis
                  </CardTitle>
                  <CardDescription>
                    Run a structured diagnostic against selected uploaded reports.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border rounded-md px-3 py-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <div className="text-sm font-medium">Reports to compare</div>
                        <div className="text-xs text-muted-foreground">
                          Selected {selectedReportIds.length}/3
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReportsPickerOpen((open) => !open)}
                      >
                        {reportsPickerOpen ? <ChevronUp className="h-4 w-4 mr-1.5" /> : <ChevronDown className="h-4 w-4 mr-1.5" />}
                        {reportsPickerOpen ? 'Hide selector' : 'Show selector'}
                      </Button>
                    </div>

                    {reportsPickerOpen ? (
                      <div className="space-y-3">
                        <div className="grid gap-2 sm:grid-cols-2">
                          {visibleAnalysisReports.map((report) => (
                            <label key={report.id} className="flex items-center gap-2 text-sm border rounded-md px-3 py-2">
                              <Checkbox
                                checked={selectedReportIds.includes(report.id)}
                                onCheckedChange={(checked) => handleToggleReport(report.id, Boolean(checked))}
                              />
                              <span>{monthLabelFromDateString(report.report_month)}</span>
                              <Badge variant="secondary" className="ml-auto">
                                {report.parse_status}
                              </Badge>
                            </label>
                          ))}
                        </div>

                        {analysisEligibleReports.length > ANALYSIS_PAGE_SIZE ? (
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">
                              Page {analysisPage} of {analysisTotalPages}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setAnalysisPage((p) => Math.max(1, p - 1))}
                                disabled={analysisPage === 1}
                              >
                                Previous
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setAnalysisPage((p) => Math.min(analysisTotalPages, p + 1))}
                                disabled={analysisPage === analysisTotalPages}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        {analysisEligibleReports.length === 0 ? (
                          <div className="text-sm text-muted-foreground">
                            No parsed reports available yet. Upload and parse at least one report to run analysis.
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={includeLqsData} onCheckedChange={(checked) => setIncludeLqsData(Boolean(checked))} />
                      Include quoting activity
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={includeScorecardData} onCheckedChange={(checked) => setIncludeScorecardData(Boolean(checked))} />
                      Include scorecard data
                    </label>
                  </div>
                  <div className="text-xs text-muted-foreground border rounded-md px-3 py-2">
                    Toggle behavior: when enabled, these datasets are queried for the selected report-month range and added to the AI prompt only if matching rows are found.
                  </div>
                  {lastRunDataUsage ? (
                    <div className="text-xs text-muted-foreground border rounded-md px-3 py-2">
                      Last run data usage: quoting {lastRunDataUsage.quoting.replace('_', ' ')}, scorecard {lastRunDataUsage.scorecard.replace('_', ' ')}.
                    </div>
                  ) : null}
                  {!lastRunDataUsage && latestSavedDataUsage ? (
                    <div className="text-xs text-muted-foreground border rounded-md px-3 py-2">
                      Last saved analysis usage: quoting {latestSavedDataUsage.quoting.replace('_', ' ')}, scorecard {latestSavedDataUsage.scorecard.replace('_', ' ')}.
                    </div>
                  ) : null}

                  <Input
                    placeholder="Optional focus question for this analysis..."
                    value={customQuestion}
                    onChange={(event) => setCustomQuestion(event.target.value)}
                  />

                  <div className="flex items-center gap-2">
                    <Button onClick={runAnalysis} disabled={analysisQuery.isRunningAnalysis || selectedReportIds.length === 0}>
                      {analysisQuery.isRunningAnalysis ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Run Analysis
                    </Button>
                  </div>

                  {analysisQuery.runAnalysisError && (
                    <Alert variant="destructive">
                      <AlertTitle>Analysis failed</AlertTitle>
                      <AlertDescription>
                        {(analysisQuery.runAnalysisError as Error).message}
                      </AlertDescription>
                    </Alert>
                  )}

                  {latestAnalysis && (
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-muted/40 border border-border rounded-md p-3">
                        {latestAnalysis.analysis_result}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="retention" className="mt-4">
              <GCRetentionTab snapshots={sortedCarrierSnapshots} reports={reportsQuery.reports} />
            </TabsContent>

            <TabsContent value="premium" className="mt-4">
              <GCPremiumTab snapshots={sortedCarrierSnapshots} reports={reportsQuery.reports} />
            </TabsContent>

            <TabsContent value="loss-ratio" className="mt-4">
              <GCLossRatioTab snapshots={sortedCarrierSnapshots} reports={reportsQuery.reports} />
            </TabsContent>

            <TabsContent value="bonus-planner" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Bonus Planner</CardTitle>
                  <CardDescription>
                    Bonus Grid embed and auto-fill mapping from latest report are planned in Phase 8.
                  </CardDescription>
                </CardHeader>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      <GCUploadDialog
        open={uploadOpen}
        onOpenChange={handleUploadDialogOpenChange}
        carrierSchemas={carrierSchemasQuery.data ?? []}
        reports={reportsQuery.reports}
        defaultCarrierSchemaKey={selectedCarrierSchemaKey}
        prefillReportMonth={uploadPrefillReportMonth}
        prefillCarrierSchemaKey={uploadPrefillCarrierSchemaKey}
        onSubmit={handleUpload}
        isSubmitting={reportsQuery.isCreatingReport}
      />
    </div>
  );
}
