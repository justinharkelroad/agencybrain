import React, { useState } from 'react';
import { FileText, XCircle, AlertTriangle, Info, Download, Trophy, Sparkles, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PayoutCalculation } from '@/lib/payout-calculator/types';
import { InsuredAggregate } from '@/lib/allstate-analyzer/sub-producer-analyzer';
import { CommissionStatementExport } from './CommissionStatementExport';

interface PayoutDetailSheetProps {
  payout: PayoutCalculation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatCurrency: (value: number) => string;
}

export function PayoutDetailSheet({ payout, open, onOpenChange, formatCurrency }: PayoutDetailSheetProps) {
  const [showExportDialog, setShowExportDialog] = useState(false);
  
  if (!payout) return null;

  const hasChargebacks = payout.chargebackCount > 0;
  const hasExcludedChargebacks = payout.excludedChargebackCount > 0;
  const is3MonthRule = payout.chargebackRule === 'three_month';
  const isNoChargebacks = payout.chargebackRule === 'none';
  
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
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-lg font-semibold">
                {payout.teamMemberName}
              </SheetTitle>
              <SheetDescription className="text-sm">
                {payout.compPlanName}
              </SheetDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowExportDialog(true)}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export Statement
            </Button>
          </div>
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

            {/* Tier Achieved Section */}
            {payout.tierMatch && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tier Achieved</h4>
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-emerald-500" />
                      <div>
                        <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                          {payout.tierMatch.minThreshold}+ items ({payout.tierMatch.commissionValue}%)
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Written: {payout.writtenItems} items
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                      Tier Rate: {payout.tierMatch.commissionValue}%
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Commission Breakdown by Bundle Type */}
            {payout.commissionByBundleType && payout.commissionByBundleType.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Commission Breakdown</h4>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Premium</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Commission</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payout.commissionByBundleType.map((bt, idx) => {
                        const rate = bt.premium > 0 ? (bt.commission / bt.premium) * 100 : 0;
                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-medium capitalize">
                              {bt.bundleType === 'monoline' ? '🔹 Monoline' : bt.bundleType === 'standard' ? '📦 Bundled (Standard)' : bt.bundleType === 'preferred' ? '⭐ Bundled (Preferred)' : bt.bundleType}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(bt.premium)}</TableCell>
                            <TableCell className="text-right">{bt.items}</TableCell>
                            <TableCell className="text-right">{rate.toFixed(1)}%</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(bt.commission)}</TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Total row */}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(payout.commissionByBundleType.reduce((sum, bt) => sum + bt.premium, 0))}
                        </TableCell>
                        <TableCell className="text-right">
                          {payout.commissionByBundleType.reduce((sum, bt) => sum + bt.items, 0)}
                        </TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right text-primary">
                          {formatCurrency(payout.commissionByBundleType.reduce((sum, bt) => sum + bt.commission, 0))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Monoline items pay flat rate. Bundled items pay tier rate ({payout.tierMatch?.commissionValue || 0}%).
                </p>
              </div>
            )}

            {/* Commission Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Commission Total</h4>
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

            {/* Bonus Breakdown - shows promos, self-gen kicker, bundling multiplier */}
            {(payout.achievedPromos?.length > 0 || payout.selfGenKickerAmount || payout.bundlingMultiplier) && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bonus Breakdown</h4>
                <div className="space-y-2">
                  {/* Achieved Promos */}
                  {payout.achievedPromos?.map((promo) => (
                    <div
                      key={promo.promoId}
                      className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
                    >
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-amber-500" />
                        <div>
                          <div className="text-sm font-medium">{promo.promoName}</div>
                          <div className="text-xs text-muted-foreground">
                            Achieved: {promo.achievedValue.toLocaleString()} / {promo.targetValue.toLocaleString()} target
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                        +{formatCurrency(promo.bonusAmount)}
                      </div>
                    </div>
                  ))}

                  {/* Self-Gen Kicker */}
                  {payout.selfGenKickerAmount && payout.selfGenKickerAmount > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-emerald-500" />
                        <div>
                          <div className="text-sm font-medium">Self-Gen Kicker</div>
                          <div className="text-xs text-muted-foreground">
                            {payout.selfGenPercent?.toFixed(1)}% self-generated
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        +{formatCurrency(payout.selfGenKickerAmount)}
                      </div>
                    </div>
                  )}

                  {/* Bundling Multiplier */}
                  {payout.bundlingMultiplier && payout.bundlingMultiplier > 1 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-blue-500" />
                        <div>
                          <div className="text-sm font-medium">Bundling Multiplier</div>
                          <div className="text-xs text-muted-foreground">
                            {payout.bundlingPercent?.toFixed(1)}% bundled policies
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                        {payout.bundlingMultiplier}x
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

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

            {/* No Chargebacks Rule Info */}
            {isNoChargebacks && payout.chargebackCount > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
                <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <span className="text-sm text-blue-600 dark:text-blue-400">
                  Chargebacks not applied per comp plan settings
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
        
        {/* Export Dialog */}
        <CommissionStatementExport
          payout={payout}
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
        />
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
