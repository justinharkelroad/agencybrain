import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, Save, CheckCircle, DollarSign, AlertTriangle, Users, FileSpreadsheet, FileText } from "lucide-react";
import { usePayoutCalculator } from "@/hooks/usePayoutCalculator";
import { PayoutCalculation } from "@/lib/payout-calculator/types";
import { SubProducerMetrics } from "@/lib/allstate-analyzer/sub-producer-analyzer";
import { toast } from "sonner";
import { PayoutDetailRow } from "./PayoutDetailRow";
import { PayoutDetailSheet } from "./PayoutDetailSheet";
import { ManualOverridePanel, ManualOverride } from "./ManualOverridePanel";
import { SalesReportUpload } from "./SalesReportUpload";
import { AgentTransactionDetailUpload } from "./AgentTransactionDetailUpload";
import { StatementReportSelector } from "./StatementReportSelector";
import { SubProducerSalesMetrics, NewBusinessParseResult, convertToCompensationMetrics } from "@/lib/new-business-details-parser";
import { StatementTransaction } from "@/lib/allstate-parser/excel-parser";

// The subProducerData from comparison reports is an object with producers array
interface SubProducerDataWrapper {
  producers: SubProducerMetrics[];
  producerCount: number;
  totals?: Record<string, unknown>;
  statementMonth?: string;
}

interface StatementReport {
  id: string;
  statement_month: number;
  statement_year: number;
  comparison_data: { subProducerData?: SubProducerDataWrapper };
}

interface PayoutPreviewProps {
  agencyId: string | null;
  subProducerData?: SubProducerDataWrapper;
  statementMonth?: number;
  statementYear?: number;
  onStatementReportSelect?: (report: StatementReport | null) => void;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function PayoutPreview({
  agencyId,
  subProducerData,
  statementMonth,
  statementYear,
  onStatementReportSelect
}: PayoutPreviewProps) {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(statementMonth || currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(statementYear || currentDate.getFullYear());
  const [calculatedPayouts, setCalculatedPayouts] = useState<PayoutCalculation[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [hasCalculated, setHasCalculated] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<PayoutCalculation | null>(null);
  const [manualOverrides, setManualOverrides] = useState<ManualOverride[]>([]);

  // Sales report data (new flow)
  const [dataSource, setDataSource] = useState<"sales_report" | "commission_statement">("sales_report");
  const [salesReportMetrics, setSalesReportMetrics] = useState<SubProducerSalesMetrics[] | null>(null);
  const [salesReportResult, setSalesReportResult] = useState<NewBusinessParseResult | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Agent Transaction Detail data (chargebacks with sub-producer codes)
  const [transactionDetailMetrics, setTransactionDetailMetrics] = useState<SubProducerMetrics[] | null>(null);
  const [transactionDetailTransactions, setTransactionDetailTransactions] = useState<StatementTransaction[] | null>(null);

  // Handle statement report selection
  const handleStatementReportSelect = useCallback((report: StatementReport | null) => {
    if (report) {
      setSelectedReportId(report.id);
      if (report.statement_month) setSelectedMonth(report.statement_month);
      if (report.statement_year) setSelectedYear(report.statement_year);
    } else {
      setSelectedReportId(null);
    }
    onStatementReportSelect?.(report);
  }, [onStatementReportSelect]);

  const {
    calculatePayouts,
    savePayouts,
    savePayoutsAsync,
    isSaving,
    finalizePayouts,
    isFinalizingPayouts,
    teamMembers,
    plans,
    assignments
  } = usePayoutCalculator(agencyId);

  // Generate year options
  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = currentDate.getFullYear(); y >= currentDate.getFullYear() - 2; y--) {
      years.push(y);
    }
    return years;
  }, [currentDate]);

  // Handler for when sales report is parsed
  const handleSalesReportParsed = useCallback(
    (metrics: SubProducerSalesMetrics[], result: NewBusinessParseResult) => {
      setSalesReportMetrics(metrics);
      setSalesReportResult(result);

      // Auto-set period based on date range
      if (result.dateRange) {
        const [year, month] = result.dateRange.end.split("-");
        setSelectedYear(parseInt(year));
        setSelectedMonth(parseInt(month));
      }

      toast.success(`Loaded ${result.summary.totalRecords} sales records`);
    },
    []
  );

  // Handler for when Agent Transaction Detail is parsed
  const handleTransactionDetailParsed = useCallback(
    (metrics: SubProducerMetrics[], transactions: StatementTransaction[]) => {
      setTransactionDetailMetrics(metrics);
      setTransactionDetailTransactions(transactions);

      // Count chargebacks from the metrics
      const totalChargebacks = metrics.reduce((sum, m) => sum + m.chargebackCount, 0);
      const chargebackPremium = metrics.reduce((sum, m) => sum + m.premiumChargebacks, 0);
      const formattedPremium = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(chargebackPremium);

      toast.success(`Loaded ${transactions.length} transactions (${totalChargebacks} chargebacks, ${formattedPremium})`);
    },
    []
  );

  // Build chargeback data by producer from Agent Transaction Detail
  const chargebacksByProducer = useMemo(() => {
    if (!transactionDetailMetrics || transactionDetailMetrics.length === 0) {
      return new Map<string, { premium: number; count: number; chargebackInsureds: typeof transactionDetailMetrics[0]['chargebackInsureds']; chargebackTransactions: typeof transactionDetailMetrics[0]['chargebackTransactions'] }>();
    }

    const summary = new Map<string, { premium: number; count: number; chargebackInsureds: typeof transactionDetailMetrics[0]['chargebackInsureds']; chargebackTransactions: typeof transactionDetailMetrics[0]['chargebackTransactions'] }>();

    for (const metrics of transactionDetailMetrics) {
      if (metrics.chargebackCount > 0 || metrics.premiumChargebacks > 0) {
        summary.set(metrics.code, {
          premium: metrics.premiumChargebacks,
          count: metrics.chargebackCount,
          chargebackInsureds: metrics.chargebackInsureds,
          chargebackTransactions: metrics.chargebackTransactions,
        });
        console.log(`[PayoutPreview] ${metrics.code}: ${metrics.chargebackCount} chargebacks ($${metrics.premiumChargebacks.toFixed(2)})`);
      }
    }

    return summary;
  }, [transactionDetailMetrics]);

  // Convert sales report metrics to the format expected by the calculator
  // Also merges chargeback data from Agent Transaction Detail
  const getProducersForCalculation = useCallback((): SubProducerMetrics[] | null => {
    if (dataSource === "sales_report" && salesReportMetrics) {
      // Convert SubProducerSalesMetrics to SubProducerMetrics format
      const converted = convertToCompensationMetrics(salesReportMetrics);
      console.log('[PayoutPreview] Converted metrics:', converted.map(m => ({
        code: m.code,
        creditInsuredsCount: m.creditInsureds?.length || 0,
        creditTransactionsCount: m.creditTransactions?.length || 0,
      })));

      // Merge chargeback data from Agent Transaction Detail
      return converted.map((m) => {
        // Look up chargebacks for this sub-producer from transaction detail
        const producerChargebacks = chargebacksByProducer.get(m.code);

        const chargebackPremium = producerChargebacks?.premium || 0;
        const chargebackCount = producerChargebacks?.count || 0;

        if (chargebackCount > 0) {
          console.log(`[PayoutPreview] ${m.code}: Merged ${chargebackCount} chargebacks from Agent Transaction Detail ($${chargebackPremium.toFixed(2)})`);
        }

        return {
          code: m.code,
          displayName: m.displayName,
          itemsIssued: m.itemsIssued,
          policiesIssued: m.policiesIssued,
          premiumWritten: m.premiumWritten,
          creditCount: m.creditCount,
          netPremium: m.netPremium - chargebackPremium, // Subtract chargebacks from net
          premiumChargebacks: chargebackPremium,
          chargebackCount: chargebackCount,
          commissionEarned: m.commissionEarned,
          commissionChargebacks: chargebackPremium * 0.15, // Approximate commission on chargebacks
          netCommission: m.netCommission - (chargebackPremium * 0.15),
          effectiveRate: m.effectiveRate,
          // Pass through credit/chargeback detail data for PayoutDetailSheet
          creditTransactions: m.creditTransactions,
          chargebackTransactions: producerChargebacks?.chargebackTransactions || [],
          creditInsureds: m.creditInsureds,
          chargebackInsureds: producerChargebacks?.chargebackInsureds || [],
          byBundleType: m.byBundleType,
          byProduct: m.byProduct,
        };
      }) as SubProducerMetrics[];
    } else if (dataSource === "commission_statement" && subProducerData?.producers) {
      return subProducerData.producers;
    }
    return null;
  }, [dataSource, salesReportMetrics, subProducerData, chargebacksByProducer]);

  const handleCalculate = async () => {
    const producers = getProducersForCalculation();

    if (!producers || producers.length === 0) {
      if (dataSource === "sales_report") {
        toast.error("Please upload a New Business Details report first");
        setWarnings(["No sales data available. Upload a New Business Details report."]);
      } else {
        toast.error("Please select a statement report with sub-producer data");
        setWarnings(["No sub-producer data available. Upload a commission statement first."]);
      }
      return;
    }

    // Check if any overrides are active for user feedback
    const hasActiveOverrides = manualOverrides.some(
      (o) => o.writtenItems !== null || o.writtenPremium !== null
    );
    if (hasActiveOverrides) {
      toast.info("Calculating with manual overrides applied");
    }

    const result = await calculatePayouts(producers, selectedMonth, selectedYear, manualOverrides);
    setCalculatedPayouts(result.payouts);
    setWarnings(result.warnings);
    setHasCalculated(true);
  };

  // Check if we have data ready for calculation
  const hasDataForCalculation =
    (dataSource === "sales_report" && salesReportMetrics && salesReportMetrics.length > 0) ||
    (dataSource === "commission_statement" && subProducerData?.producers && subProducerData.producers.length > 0);

  const handleSave = async () => {
    if (calculatedPayouts.length === 0) return;
    await savePayoutsAsync(calculatedPayouts);
  };

  const handleFinalize = () => {
    finalizePayouts({ month: selectedMonth, year: selectedYear });
  };

  // Calculate totals
  const totals = useMemo(() => {
    return calculatedPayouts.reduce((acc, p) => ({
      writtenPremium: acc.writtenPremium + p.writtenPremium,
      issuedPremium: acc.issuedPremium + p.issuedPremium,
      netPremium: acc.netPremium + p.netPremium,
      totalPayout: acc.totalPayout + p.totalPayout,
    }), { writtenPremium: 0, issuedPremium: 0, netPremium: 0, totalPayout: 0 });
  }, [calculatedPayouts]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500">Paid</Badge>;
      case "finalized":
        return <Badge className="bg-blue-500">Finalized</Badge>;
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  // Get sub-producer count based on data source
  const subProducerCount =
    dataSource === "sales_report"
      ? salesReportMetrics?.length || 0
      : subProducerData?.producerCount || subProducerData?.producers?.length || 0;

  // Get producers for manual override panel
  const producersForOverride = getProducersForCalculation();

  return (
    <div className="space-y-6">
      {/* Data Source Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Payout Calculator
          </CardTitle>
          <CardDescription>
            Calculate commissions based on sub-producer performance and compensation plans
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Data Source Tabs */}
          <Tabs value={dataSource} onValueChange={(v) => setDataSource(v as "sales_report" | "commission_statement")}>
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="sales_report" className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Sales Report
              </TabsTrigger>
              <TabsTrigger value="commission_statement" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Commission Statement
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sales_report" className="mt-4 space-y-4">
              <SalesReportUpload
                agencyId={agencyId}
                teamMembers={teamMembers}
                onDataParsed={handleSalesReportParsed}
              />
            </TabsContent>

            <TabsContent value="commission_statement" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Select Commission Statement</CardTitle>
                  <CardDescription>
                    Choose a statement from the Comp Analyzer to use for calculations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <StatementReportSelector
                    agencyId={agencyId}
                    selectedReportId={selectedReportId}
                    onSelect={handleStatementReportSelect}
                  />
                </CardContent>
              </Card>
              {subProducerData?.producers && subProducerData.producers.length > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Commission statement loaded with {subProducerData.producers.length} sub-producers.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>

          {/* Agent Transaction Detail for Chargebacks - Always visible */}
          <AgentTransactionDetailUpload
            onDataParsed={handleTransactionDetailParsed}
          />

          {/* Chargeback status */}
          {transactionDetailMetrics && transactionDetailMetrics.length > 0 && chargebacksByProducer.size > 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {Array.from(chargebacksByProducer.values()).reduce((sum, p) => sum + p.count, 0)} chargebacks from{' '}
                {chargebacksByProducer.size} sub-producers will be applied to calculations
              </AlertDescription>
            </Alert>
          )}

          {/* Period Selection & Actions */}
          <div className="flex flex-wrap gap-4 items-end pt-4 border-t">
            <div className="space-y-2">
              <label className="text-sm font-medium">Month</label>
              <Select
                value={String(selectedMonth)}
                onValueChange={(v) => setSelectedMonth(parseInt(v))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, idx) => (
                    <SelectItem key={idx} value={String(idx + 1)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Year</label>
              <Select
                value={String(selectedYear)}
                onValueChange={(v) => setSelectedYear(parseInt(v))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleCalculate} disabled={!hasDataForCalculation}>
              <Calculator className="h-4 w-4 mr-2" />
              Calculate Payouts
            </Button>

            {hasCalculated && calculatedPayouts.length > 0 && (
              <>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  variant="secondary"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Draft"}
                </Button>
                <Button
                  onClick={handleFinalize}
                  disabled={isFinalizingPayouts}
                  variant="default"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isFinalizingPayouts ? "Finalizing..." : "Finalize"}
                </Button>
              </>
            )}
          </div>

          {/* Status Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-muted">
              <div className="text-sm text-muted-foreground">Team Members</div>
              <div className="text-2xl font-bold">{teamMembers.length}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <div className="text-sm text-muted-foreground">Active Plans</div>
              <div className="text-2xl font-bold">{plans.filter(p => p.is_active).length}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <div className="text-sm text-muted-foreground">Assignments</div>
              <div className="text-2xl font-bold">{assignments.length}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <div className="text-sm text-muted-foreground">Sub-Producers</div>
              <div className="text-2xl font-bold">{subProducerCount}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual Override Panel */}
      {producersForOverride && producersForOverride.length > 0 && (
        <ManualOverridePanel
          subProducerData={producersForOverride}
          teamMembers={teamMembers}
          overrides={manualOverrides}
          onChange={setManualOverrides}
        />
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {hasCalculated && calculatedPayouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payout Preview - {MONTHS[selectedMonth - 1]} {selectedYear}
            </CardTitle>
            <CardDescription>
              {calculatedPayouts.length} payout calculations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Totals Summary */}
            <div className="mb-6 p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Written Premium</div>
                  <div className="text-xl font-bold">{formatCurrency(totals.writtenPremium)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Net Premium</div>
                  <div className="text-xl font-bold">{formatCurrency(totals.netPremium)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Payouts</div>
                  <div className="text-xl font-bold text-primary">{formatCurrency(totals.totalPayout)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Avg Commission Rate</div>
                  <div className="text-xl font-bold">
                    {totals.netPremium > 0 
                      ? ((totals.totalPayout / totals.netPremium) * 100).toFixed(2) 
                      : 0}%
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team Member</TableHead>
                    <TableHead className="text-right">Written</TableHead>
                    <TableHead className="text-right">Issued</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Tier</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Payout</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calculatedPayouts.map((payout, idx) => (
                    <PayoutDetailRow 
                      key={idx}
                      payout={payout}
                      formatCurrency={formatCurrency}
                      onClick={() => setSelectedPayout(payout)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {hasCalculated && calculatedPayouts.length === 0 && warnings.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Payouts to Calculate</h3>
            <p className="text-muted-foreground mt-2">
              Make sure team members have sub-producer codes and are assigned to compensation plans.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Detail Sheet */}
      <PayoutDetailSheet
        payout={selectedPayout}
        open={!!selectedPayout}
        onOpenChange={(open) => !open && setSelectedPayout(null)}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}
