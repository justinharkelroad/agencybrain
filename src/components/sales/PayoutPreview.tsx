import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, Save, CheckCircle, DollarSign, AlertTriangle, Users, FileSpreadsheet, RotateCcw } from "lucide-react";
import { usePayoutCalculator } from "@/hooks/usePayoutCalculator";
import { PayoutCalculation } from "@/lib/payout-calculator/types";
import { SubProducerMetrics } from "@/lib/allstate-analyzer/sub-producer-analyzer";
import { toast } from "sonner";
import { PayoutDetailRow } from "./PayoutDetailRow";
import { PayoutDetailSheet } from "./PayoutDetailSheet";
import { ManualOverridePanel, ManualOverride } from "./ManualOverridePanel";
import { SalesReportUpload } from "./SalesReportUpload";
import { AgentTransactionDetailUpload } from "./AgentTransactionDetailUpload";
import { SubProducerSalesMetrics, NewBusinessParseResult, convertToCompensationMetrics } from "@/lib/new-business-details-parser";
import { StatementTransaction } from "@/lib/allstate-parser/excel-parser";

// The subProducerData from comparison reports is an object with producers array
interface SubProducerDataWrapper {
  producers: SubProducerMetrics[];
  producerCount: number;
  totals?: Record<string, unknown>;
  statementMonth?: string;
}

interface PayoutPreviewProps {
  agencyId: string | null;
  subProducerData?: SubProducerDataWrapper;
  statementMonth?: number;
  statementYear?: number;
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
}: PayoutPreviewProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState(statementMonth || currentMonth);
  const [selectedYear, setSelectedYear] = useState(statementYear || currentYear);
  const [calculatedPayouts, setCalculatedPayouts] = useState<PayoutCalculation[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [hasCalculated, setHasCalculated] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<PayoutCalculation | null>(null);
  const [manualOverrides, setManualOverrides] = useState<ManualOverride[]>([]);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // Sales report data (new flow)
  const [dataSource] = useState<"sales_report">("sales_report");
  const [salesReportMetrics, setSalesReportMetrics] = useState<SubProducerSalesMetrics[] | null>(null);
  const [salesReportResult, setSalesReportResult] = useState<NewBusinessParseResult | null>(null);

  // Agent Transaction Detail data (chargebacks with sub-producer codes)
  const [transactionDetailMetrics, setTransactionDetailMetrics] = useState<SubProducerMetrics[] | null>(null);
  const [transactionDetailTransactions, setTransactionDetailTransactions] = useState<StatementTransaction[] | null>(null);

  const clearCalculatedResults = useCallback(() => {
    setCalculatedPayouts([]);
    setWarnings([]);
    setHasCalculated(false);
  }, []);

  const {
    calculatePayouts,
    savePayoutsAsync,
    isSaving,
    finalizeCalculatedPayoutsAsync,
    isFinalizingCalculatedPayouts,
    deleteDraftPayoutsForPeriodAsync,
    isDeletingDraftPayouts,
    teamMembers,
    plans,
    assignments
  } = usePayoutCalculator(agencyId);

  // Generate year options
  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = currentYear; y >= currentYear - 2; y--) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  // Handler for when sales report is parsed
  const handleSalesReportParsed = useCallback(
    (metrics: SubProducerSalesMetrics[], result: NewBusinessParseResult) => {
      clearCalculatedResults();
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
    [clearCalculatedResults]
  );

  // Handler for when Agent Transaction Detail is parsed
  const handleTransactionDetailParsed = useCallback(
    (metrics: SubProducerMetrics[], transactions: StatementTransaction[]) => {
      clearCalculatedResults();
      setTransactionDetailMetrics(metrics);
      setTransactionDetailTransactions(transactions);

      // Count chargebacks from the metrics
      const totalChargebacks = metrics.reduce((sum, m) => sum + m.chargebackCount, 0);
      const chargebackPremium = metrics.reduce((sum, m) => sum + m.premiumChargebacks, 0);
      const formattedPremium = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(chargebackPremium);

      toast.success(`Loaded ${transactions.length} transactions (${totalChargebacks} chargebacks, ${formattedPremium})`);
    },
    [clearCalculatedResults]
  );

  // Build data by producer from Agent Transaction Detail (chargebacks AND bundle type breakdown)
  const transactionDetailByProducer = useMemo(() => {
    if (!transactionDetailMetrics || transactionDetailMetrics.length === 0) {
      return new Map<string, {
        premium: number;
        count: number;
        chargebackInsureds: typeof transactionDetailMetrics[0]['chargebackInsureds'];
        chargebackTransactions: typeof transactionDetailMetrics[0]['chargebackTransactions'];
        reinstatementPremium: number;
        reinstatementCount: number;
        reinstatementTransactions: typeof transactionDetailMetrics[0]['reinstatementTransactions'];
        byBundleType: typeof transactionDetailMetrics[0]['byBundleType'];
        byProduct: typeof transactionDetailMetrics[0]['byProduct'];
      }>();
    }

    console.log(`[PayoutPreview] Building transactionDetailByProducer map from ${transactionDetailMetrics.length} producers`);
    console.log(`[PayoutPreview] All producer codes:`, transactionDetailMetrics.map(m => ({
      code: m.code,
      displayCode: m.code ? `"${m.code}"` : '(empty)',
      credits: m.creditCount,
      chargebacks: m.chargebackCount,
      chargebackPremium: m.premiumChargebacks,
      bundleTypes: m.byBundleType?.map(b => `${b.bundleType}: $${b.premiumWritten?.toFixed(0) || 0}`),
    })));

    const summary = new Map<string, {
      premium: number;
      count: number;
      chargebackInsureds: typeof transactionDetailMetrics[0]['chargebackInsureds'];
      chargebackTransactions: typeof transactionDetailMetrics[0]['chargebackTransactions'];
      reinstatementPremium: number;
      reinstatementCount: number;
      reinstatementTransactions: typeof transactionDetailMetrics[0]['reinstatementTransactions'];
      byBundleType: typeof transactionDetailMetrics[0]['byBundleType'];
      byProduct: typeof transactionDetailMetrics[0]['byProduct'];
    }>();

    for (const metrics of transactionDetailMetrics) {
      const code = metrics.code;
      // Store ALL data from Agent Transaction Detail, not just chargebacks
      summary.set(code, {
        premium: metrics.premiumChargebacks,
        count: metrics.chargebackCount,
        chargebackInsureds: metrics.chargebackInsureds,
        chargebackTransactions: metrics.chargebackTransactions,
        reinstatementPremium: metrics.reinstatementPremium,
        reinstatementCount: metrics.reinstatementCount,
        reinstatementTransactions: metrics.reinstatementTransactions,
        byBundleType: metrics.byBundleType,
        byProduct: metrics.byProduct,
      });

      if (metrics.chargebackCount > 0 || metrics.premiumChargebacks > 0) {
        console.log(`[PayoutPreview] Producer code="${code}": ${metrics.chargebackCount} chargebacks ($${metrics.premiumChargebacks.toFixed(2)})`);
      }
      if (metrics.byBundleType && metrics.byBundleType.length > 0) {
        console.log(`[PayoutPreview] Producer code="${code}" bundle breakdown:`, metrics.byBundleType.map(b => `${b.bundleType}: $${b.premiumWritten?.toFixed(0) || 0}`));
      }
    }

    console.log(`[PayoutPreview] transactionDetailByProducer map has ${summary.size} entries with keys:`, Array.from(summary.keys()).map(k => k ? `"${k}"` : '(empty)'));

    return summary;
  }, [transactionDetailMetrics]);

  // Backwards compatibility alias
  const chargebacksByProducer = transactionDetailByProducer;

  // Convert sales report metrics to the format expected by the calculator
  // Also merges chargeback data from Agent Transaction Detail
  const getProducersForCalculation = useCallback((): SubProducerMetrics[] | null => {
    if (dataSource === "sales_report" && salesReportMetrics) {
      // Convert SubProducerSalesMetrics to SubProducerMetrics format
      const converted = convertToCompensationMetrics(salesReportMetrics);
      console.log('[PayoutPreview] Converted metrics:', converted.map(m => ({
        code: m.code,
        codeLen: m.code?.length,
        creditInsuredsCount: m.creditInsureds?.length || 0,
        creditTransactionsCount: m.creditTransactions?.length || 0,
      })));

      // Debug: Show all sales report codes
      console.log('[PayoutPreview] Sales report producer codes:', converted.map(m => m.code ? `"${m.code}"` : '(empty)'));
      console.log('[PayoutPreview] Available chargeback keys:', Array.from(chargebacksByProducer.keys()).map(k => k ? `"${k}"` : '(empty)'));

      // Merge data from Agent Transaction Detail (chargebacks AND bundle type proportions)
      return converted.map((m) => {
        // Look up data for this sub-producer from transaction detail
        const producerData = transactionDetailByProducer.get(m.code);

        const chargebackPremium = producerData?.premium || 0;
        const chargebackCount = producerData?.count || 0;
        const existingCreditKeys = new Set(
          (m.creditTransactions || []).map((tx) => {
            const policyNumber = (tx.policyNumber || '').trim();
            return policyNumber || `${tx.insuredName}|${tx.product}|${tx.premium}`;
          })
        );
        const reinstatementTransactions = (producerData?.reinstatementTransactions || []).filter((tx) => {
          const policyNumber = (tx.policyNumber || '').trim();
          const key = policyNumber || `${tx.insuredName}|${tx.product}|${tx.premium}`;
          return !existingCreditKeys.has(key);
        });
        const reinstatementPremium = reinstatementTransactions.reduce((sum, tx) => sum + Math.max(0, tx.premium || 0), 0);
        const reinstatementCount = reinstatementTransactions.length;

        // Keep New Business issued bundle/product amounts as payout basis.
        // Merge chargebacks from Agent Transaction Detail and restore explicit first-term reinstatements
        // that are not already present in New Business Details.
        let byBundleType = m.byBundleType;
        let byProduct = m.byProduct;

        if ((producerData?.byBundleType && producerData.byBundleType.length > 0) || reinstatementTransactions.length > 0) {
          const normalizeBundle = (bundleType: string) => {
            const normalized = (bundleType || '').trim().toLowerCase();
            if (!normalized || normalized === 'mono' || normalized === 'mono line' || normalized === 'monoline') return 'monoline';
            if (normalized === 'bundled' || normalized === 'standard' || normalized === 'std' || normalized === 'standard bundle') return 'standard';
            if (normalized === 'preferred' || normalized === 'pref' || normalized === 'preferred bundle') return 'preferred';
            return normalized;
          };

          const bundleMap = new Map<string, typeof m.byBundleType[number]>();
          for (const bundle of m.byBundleType) {
            const key = normalizeBundle(bundle.bundleType);
            bundleMap.set(key, { ...bundle, bundleType: key });
          }

          const chargebackByBundle = new Map<string, { premiumChargebacks: number; chargebackCount: number }>();
          for (const b of producerData?.byBundleType || []) {
            const key = normalizeBundle(b.bundleType);
            const existing = chargebackByBundle.get(key) || { premiumChargebacks: 0, chargebackCount: 0 };
            existing.premiumChargebacks += b.premiumChargebacks || 0;
            existing.chargebackCount += b.chargebackCount || 0;
            chargebackByBundle.set(key, existing);
          }

          for (const tx of reinstatementTransactions) {
            const key = normalizeBundle(tx.bundleType);
            const existing = bundleMap.get(key) || {
              bundleType: key,
              premiumWritten: 0,
              premiumChargebacks: 0,
              netPremium: 0,
              itemsIssued: 0,
              creditCount: 0,
              chargebackCount: 0,
            };
            existing.premiumWritten += Math.max(0, tx.premium || 0);
            existing.itemsIssued += 1;
            existing.creditCount += 1;
            bundleMap.set(key, existing);
          }

          byBundleType = Array.from(bundleMap.entries()).map(([key, b]) => {
            const chargeback = chargebackByBundle.get(key);
            return {
              ...b,
              premiumChargebacks: chargeback?.premiumChargebacks || 0,
              chargebackCount: chargeback?.chargebackCount || 0,
              netPremium: (b.premiumWritten || 0) - (chargeback?.premiumChargebacks || 0),
            };
          });

          console.log(`[PayoutPreview] ${m.code}: Using New Business bundle basis with ATD chargebacks merged`);
          console.log(`[PayoutPreview] ${m.code}: Bundle breakdown:`, byBundleType.map(b => `${b.bundleType}: issued=$${b.premiumWritten?.toFixed(0) || 0}, cbs=$${b.premiumChargebacks?.toFixed(0) || 0}`));
        } else {
          console.log(`[PayoutPreview] ${m.code}: Using New Business bundle breakdown (no Agent Transaction Detail data)`);
        }

        if ((producerData?.byProduct && producerData.byProduct.length > 0) || reinstatementTransactions.length > 0) {
          const productMap = new Map<string, typeof m.byProduct[number]>();
          for (const product of m.byProduct) {
            const key = (product.product || '').trim().toLowerCase();
            productMap.set(key, { ...product });
          }

          const chargebackByProduct = new Map<string, { premiumChargebacks: number; chargebackCount: number }>();
          for (const p of producerData?.byProduct || []) {
            const key = (p.product || '').trim().toLowerCase();
            const existing = chargebackByProduct.get(key) || { premiumChargebacks: 0, chargebackCount: 0 };
            existing.premiumChargebacks += p.premiumChargebacks || 0;
            existing.chargebackCount += p.chargebackCount || 0;
            chargebackByProduct.set(key, existing);
          }

          for (const tx of reinstatementTransactions) {
            const key = (tx.product || '').trim().toLowerCase();
            const existing = productMap.get(key) || {
              product: tx.product || 'Unknown',
              premiumWritten: 0,
              premiumChargebacks: 0,
              netPremium: 0,
              itemsIssued: 0,
              creditCount: 0,
              chargebackCount: 0,
            };
            existing.premiumWritten += Math.max(0, tx.premium || 0);
            existing.itemsIssued += 1;
            existing.creditCount += 1;
            productMap.set(key, existing);
          }

          byProduct = Array.from(productMap.entries()).map(([key, p]) => {
            const chargeback = chargebackByProduct.get(key);
            return {
              ...p,
              premiumChargebacks: chargeback?.premiumChargebacks || 0,
              chargebackCount: chargeback?.chargebackCount || 0,
              netPremium: (p.premiumWritten || 0) - (chargeback?.premiumChargebacks || 0),
            };
          });
        }

        // Always log the lookup attempt for debugging
        console.log(`[PayoutPreview] Lookup code="${m.code}": found=${!!producerData}, chargebacks=${chargebackCount}, bundleTypes=${byBundleType?.length || 0}`);

        if (chargebackCount > 0) {
          console.log(`[PayoutPreview] ${m.code}: Merged ${chargebackCount} chargebacks from Agent Transaction Detail ($${chargebackPremium.toFixed(2)})`);
        }
        if (reinstatementCount > 0) {
          console.log(`[PayoutPreview] ${m.code}: Restored ${reinstatementCount} ATD reinstatements to issued basis ($${reinstatementPremium.toFixed(2)})`);
        }

        return {
          code: m.code,
          displayName: m.displayName,
          itemsIssued: m.itemsIssued + reinstatementCount,
          policiesIssued: m.policiesIssued + reinstatementCount,
          premiumWritten: m.premiumWritten + reinstatementPremium,
          creditCount: m.creditCount + reinstatementCount,
          netPremium: m.netPremium - chargebackPremium + reinstatementPremium,
          premiumChargebacks: chargebackPremium,
          chargebackCount: chargebackCount,
          commissionEarned: m.commissionEarned + (reinstatementPremium * 0.15),
          commissionChargebacks: chargebackPremium * 0.15, // Approximate commission on chargebacks
          netCommission: m.netCommission - (chargebackPremium * 0.15) + (reinstatementPremium * 0.15),
          effectiveRate: m.effectiveRate,
          // Pass through credit/chargeback detail data for PayoutDetailSheet
          creditTransactions: m.creditTransactions.concat(reinstatementTransactions),
          chargebackTransactions: producerData?.chargebackTransactions || [],
          creditInsureds: m.creditInsureds,
          chargebackInsureds: producerData?.chargebackInsureds || [],
          // Use New Business issued bundle/product basis with ATD chargebacks merged
          byBundleType,
          byProduct,
        };
      }) as SubProducerMetrics[];
    }
    return null;
  }, [dataSource, salesReportMetrics, chargebacksByProducer, transactionDetailByProducer]);

  const handleCalculate = async () => {
    const producers = getProducersForCalculation();

    if (!salesReportMetrics || salesReportMetrics.length === 0) {
      toast.error("Upload a New Business Details report before running monthly comp");
      setWarnings(["Monthly comp requires a New Business Details report for issued production."]);
      return;
    }

    if (!transactionDetailMetrics || transactionDetailMetrics.length === 0) {
      toast.error("Upload Agent Transaction Detail before running monthly comp");
      setWarnings(["Monthly comp requires Agent Transaction Detail for chargebacks."]);
      return;
    }

    if (!producers || producers.length === 0) {
      toast.error("No comp data available from the uploaded reports");
      setWarnings(["No sub-producer data available from the required monthly comp reports."]);
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
    !!salesReportMetrics?.length && !!transactionDetailMetrics?.length;

  const handleSave = async () => {
    if (calculatedPayouts.length === 0) return;
    await savePayoutsAsync(calculatedPayouts);
  };

  const handleFinalize = async () => {
    if (calculatedPayouts.length === 0) return;
    await finalizeCalculatedPayoutsAsync(calculatedPayouts);
  };

  const handleStartOver = async () => {
    await deleteDraftPayoutsForPeriodAsync({ month: selectedMonth, year: selectedYear });
    clearCalculatedResults();
    setSelectedPayout(null);
    setManualOverrides([]);
    setSalesReportMetrics(null);
    setSalesReportResult(null);
    setTransactionDetailMetrics(null);
    setTransactionDetailTransactions(null);
    setConfirmResetOpen(false);
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
    salesReportMetrics?.length || 0;

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
          <Tabs value={dataSource}>
            <TabsList className="grid w-full grid-cols-1 max-w-md">
              <TabsTrigger value="sales_report" className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Monthly Comp Run
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sales_report" className="mt-4 space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Official monthly comp run: tier qualification comes from the sales dashboard, issued production comes from New Business Details, and chargebacks come from Agent Transaction Detail.
                </AlertDescription>
              </Alert>
              <SalesReportUpload
                agencyId={agencyId}
                teamMembers={teamMembers}
                onDataParsed={handleSalesReportParsed}
              />
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
                onValueChange={(v) => {
                  clearCalculatedResults();
                  setSelectedMonth(parseInt(v));
                }}
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
                onValueChange={(v) => {
                  clearCalculatedResults();
                  setSelectedYear(parseInt(v));
                }}
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

            <Button
              onClick={() => setConfirmResetOpen(true)}
              disabled={isDeletingDraftPayouts}
              variant="outline"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {isDeletingDraftPayouts ? "Resetting..." : "Delete Draft Run & Start Over"}
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
                  disabled={isFinalizingCalculatedPayouts}
                  variant="default"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isFinalizingCalculatedPayouts ? "Saving & Finalizing..." : "Save & Finalize"}
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
          onChange={(nextOverrides) => {
            clearCalculatedResults();
            setManualOverrides(nextOverrides);
          }}
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

      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Draft Run And Start Over?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete draft payouts for {MONTHS[selectedMonth - 1]} {selectedYear} and clear the uploaded monthly comp files from this screen. Finalized or paid runs are not deleted here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStartOver}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Draft Run
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
