import React from 'react';
import { FileText, XCircle, AlertTriangle, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PayoutCalculation } from '@/lib/payout-calculator/types';
import { InsuredAggregate } from '@/lib/allstate-analyzer/sub-producer-analyzer';

interface PayoutDetailSheetProps {
  payout: PayoutCalculation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatCurrency: (value: number) => string;
}

export function PayoutDetailSheet({ payout, open, onOpenChange, formatCurrency }: PayoutDetailSheetProps) {
  if (!payout) return null;

  const hasChargebacks = payout.chargebackCount > 0;
  const hasExcludedChargebacks = payout.excludedChargebackCount > 0;
  const is3MonthRule = payout.chargebackRule === 'three_month';
  
  const creditInsureds = payout.creditInsureds || [];
  const chargebackInsureds = payout.chargebackInsureds || [];

  const getChargebackRuleLabel = () => {
    switch (payout.chargebackRule) {
      case 'none': return 'No Chargebacks';
      case 'three_month': return '3-Month Rule';
      case 'full': return 'Full Chargeback';
      default: return 'Full Chargeback';
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="text-lg font-semibold">
            {payout.teamMemberName}
          </SheetTitle>
          <SheetDescription className="text-sm">
            {payout.compPlanName}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Premium Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Premium</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-muted">
                  <div className="text-xs text-muted-foreground">Issued</div>
                  <div className="text-lg font-semibold">{formatCurrency(payout.issuedPremium)}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <div className="text-xs text-muted-foreground">Chargebacks</div>
                  <div className={`text-lg font-semibold ${hasChargebacks ? 'text-destructive' : ''}`}>
                    {hasChargebacks ? '-' : ''}{formatCurrency(payout.chargebackPremium)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="text-xs text-muted-foreground">Net</div>
                  <div className={`text-lg font-semibold ${payout.netPremium >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {formatCurrency(payout.netPremium)}
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity</h4>
              <div className="flex flex-wrap gap-3">
                <Badge variant="secondary" className="gap-1.5 py-1.5 px-3">
                  <FileText className="h-3.5 w-3.5" />
                  {creditInsureds.length} Credits
                </Badge>
                {payout.chargebackCount > 0 && (
                  <Badge variant="destructive" className="gap-1.5 py-1.5 px-3">
                    <XCircle className="h-3.5 w-3.5" />
                    {payout.chargebackCount} Chargebacks
                  </Badge>
                )}
              </div>
            </div>

            {/* Commission Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Commission</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-muted">
                  <div className="text-xs text-muted-foreground">Base</div>
                  <div className="text-lg font-semibold">{formatCurrency(payout.baseCommission)}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <div className="text-xs text-muted-foreground">Bonus</div>
                  <div className="text-lg font-semibold">{formatCurrency(payout.bonusAmount)}</div>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="text-lg font-semibold text-primary">{formatCurrency(payout.totalPayout)}</div>
                </div>
              </div>
            </div>

            {/* Chargeback Rule */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Chargeback Rule:</span>
              <Badge variant="outline" className="text-xs">
                {getChargebackRuleLabel()}
              </Badge>
            </div>

            {/* 3-Month Rule Warning */}
            {is3MonthRule && hasExcludedChargebacks && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <span className="text-sm text-amber-600 dark:text-amber-400">
                  {payout.excludedChargebackCount} chargeback{payout.excludedChargebackCount !== 1 ? 's' : ''} excluded (policy in force &gt; 90 days)
                </span>
              </div>
            )}

            {/* Transaction Details Tabs */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transaction Details</h4>
              <Tabs defaultValue="credits" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="credits">
                    Credits ({creditInsureds.length})
                  </TabsTrigger>
                  <TabsTrigger value="chargebacks">
                    Chargebacks ({chargebackInsureds.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="credits" className="mt-3">
                  <InsuredTable insureds={creditInsureds} type="credits" formatCurrency={formatCurrency} />
                </TabsContent>
                <TabsContent value="chargebacks" className="mt-3">
                  <InsuredTable insureds={chargebackInsureds} type="chargebacks" formatCurrency={formatCurrency} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function InsuredTable({ 
  insureds, 
  type, 
  formatCurrency 
}: { 
  insureds: InsuredAggregate[]; 
  type: 'credits' | 'chargebacks';
  formatCurrency: (value: number) => string;
}) {
  const isChargeback = type === 'chargebacks';
  const nonZeroInsureds = insureds.filter(ins => Math.abs(ins.netPremium) > 0.01);
  const totalPremium = nonZeroInsureds.reduce((sum, ins) => sum + Math.abs(ins.netPremium), 0);
  const totalCommission = nonZeroInsureds.reduce((sum, ins) => sum + Math.abs(ins.netCommission), 0);

  if (nonZeroInsureds.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground border rounded-md">
        {isChargeback ? 'No chargebacks 🎉' : 'No credits found'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between text-sm px-1">
        <span className="text-muted-foreground">
          {nonZeroInsureds.length} insured{nonZeroInsureds.length !== 1 ? 's' : ''}
        </span>
        <div className="flex gap-4 text-xs">
          <span className={isChargeback ? 'text-destructive' : 'text-foreground'}>
            {isChargeback ? '-' : ''}{formatCurrency(totalPremium)} premium
          </span>
          <span className={isChargeback ? 'text-destructive' : 'text-foreground'}>
            {isChargeback ? '-' : ''}{formatCurrency(totalCommission)} comm
          </span>
        </div>
      </div>
      
      {/* Table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">Insured Name</TableHead>
              <TableHead className="text-right min-w-[100px]">Net Premium</TableHead>
              <TableHead className="text-right min-w-[100px]">Net Commission</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nonZeroInsureds.map((ins, idx) => (
              <TableRow key={`${ins.insuredName}-${idx}`}>
                <TableCell className="font-medium truncate max-w-[200px]">
                  {ins.insuredName}
                </TableCell>
                <TableCell className={`text-right ${isChargeback ? 'text-destructive' : ''}`}>
                  {isChargeback ? '-' : ''}{formatCurrency(Math.abs(ins.netPremium))}
                </TableCell>
                <TableCell className={`text-right ${isChargeback ? 'text-destructive' : ''}`}>
                  {isChargeback ? '-' : ''}{formatCurrency(Math.abs(ins.netCommission))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
