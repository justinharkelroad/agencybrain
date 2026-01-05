import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calculator, Save, CheckCircle, DollarSign, AlertTriangle, Users } from "lucide-react";
import { usePayoutCalculator } from "@/hooks/usePayoutCalculator";
import { PayoutCalculation } from "@/lib/payout-calculator/types";
import { SubProducerMetrics } from "@/lib/allstate-analyzer/sub-producer-analyzer";
import { toast } from "sonner";
import { PayoutDetailRow } from "./PayoutDetailRow";
import { PayoutDetailSheet } from "./PayoutDetailSheet";

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
  statementYear 
}: PayoutPreviewProps) {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(statementMonth || currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(statementYear || currentDate.getFullYear());
  const [calculatedPayouts, setCalculatedPayouts] = useState<PayoutCalculation[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [hasCalculated, setHasCalculated] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<PayoutCalculation | null>(null);

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

  const handleCalculate = async () => {
    // subProducerData is an object with producers array, not an array itself
    const producers = subProducerData?.producers;
    if (!producers || producers.length === 0) {
      toast.error("Please select a statement report with sub-producer data");
      setWarnings(["No sub-producer data available. Upload a commission statement first."]);
      return;
    }

    const result = await calculatePayouts(producers, selectedMonth, selectedYear);
    setCalculatedPayouts(result.payouts);
    setWarnings(result.warnings);
    setHasCalculated(true);
  };

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

  return (
    <div className="space-y-6">
      {/* Period Selection */}
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
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
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

            <Button onClick={handleCalculate} disabled={!subProducerData}>
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
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <div className="text-2xl font-bold">{subProducerData?.producerCount || subProducerData?.producers?.length || 0}</div>
            </div>
          </div>
        </CardContent>
      </Card>

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
