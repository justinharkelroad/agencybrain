import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, XCircle, AlertTriangle } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableHead, TableHeader, TableRow as TR } from '@/components/ui/table';
import { PayoutCalculation } from '@/lib/payout-calculator/types';
import { InsuredAggregate } from '@/lib/allstate-analyzer/sub-producer-analyzer';

interface Props {
  payout: PayoutCalculation;
  formatCurrency: (value: number) => string;
  getStatusBadge: (status: string) => React.ReactNode;
}

export function PayoutDetailRow({ payout, formatCurrency, getStatusBadge }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const hasChargebacks = payout.chargebackCount > 0;
  const hasExcludedChargebacks = payout.excludedChargebackCount > 0;
  const is3MonthRule = payout.chargebackRule === 'three_month';
  
  const creditInsureds = payout.creditInsureds || [];
  const chargebackInsureds = payout.chargebackInsureds || [];
  const totalInsureds = creditInsureds.length + chargebackInsureds.length;
  
  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50 transition-colors">
          <TableCell className="font-medium">
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
              {payout.teamMemberName}
            </div>
          </TableCell>
          <TableCell>{payout.compPlanName}</TableCell>
          <TableCell className="text-right">{formatCurrency(payout.writtenPremium)}</TableCell>
          <TableCell className="text-right">{formatCurrency(payout.netPremium)}</TableCell>
          <TableCell className="text-right">
            {payout.tierMatch 
              ? formatCurrency(payout.tierMatch.minThreshold) 
              : "-"}
          </TableCell>
          <TableCell className="text-right">
            {payout.tierCommissionValue > 0 
              ? `${payout.tierCommissionValue}%` 
              : "-"}
          </TableCell>
          <TableCell className="text-right font-bold text-primary">
            {formatCurrency(payout.totalPayout)}
          </TableCell>
          <TableCell>{getStatusBadge(payout.status)}</TableCell>
        </TableRow>
      </CollapsibleTrigger>
      
      <CollapsibleContent asChild>
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={8} className="p-4">
            <div className="space-y-4">
              {/* Premium Section */}
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">Premium</div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">Issued</div>
                    <div className="font-medium">{formatCurrency(payout.issuedPremium)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Chargebacks</div>
                    <div className={`font-medium ${hasChargebacks ? 'text-destructive' : ''}`}>
                      {hasChargebacks ? '-' : ''}{formatCurrency(payout.chargebackPremium)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Net</div>
                    <div className={`font-medium ${payout.netPremium >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {formatCurrency(payout.netPremium)}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Activity Section */}
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">Activity</div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{creditInsureds.length} Credits</span>
                  </div>
                  {payout.chargebackCount > 0 && (
                    <div className="flex items-center gap-1.5 text-destructive">
                      <XCircle className="h-3.5 w-3.5" />
                      <span>{payout.chargebackCount} Chargebacks</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Commission Section */}
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">Commission</div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">Base</div>
                    <div className="font-medium">{formatCurrency(payout.baseCommission)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Bonus</div>
                    <div className="font-medium">{formatCurrency(payout.bonusAmount)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Total</div>
                    <div className="font-medium text-primary">{formatCurrency(payout.totalPayout)}</div>
                  </div>
                </div>
              </div>
              
              {/* 3-Month Rule Warning */}
              {is3MonthRule && hasExcludedChargebacks && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-amber-600 dark:text-amber-400">
                    {payout.excludedChargebackCount} chargeback{payout.excludedChargebackCount !== 1 ? 's' : ''} excluded (policy in force &gt; 90 days)
                  </span>
                </div>
              )}
              
              {/* Chargeback Rule Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Chargeback Rule:</span>
                <Badge variant="outline" className="text-xs">
                  {payout.chargebackRule === 'none' && 'No Chargebacks'}
                  {payout.chargebackRule === 'three_month' && '3-Month Rule'}
                  {payout.chargebackRule === 'full' && 'Full Chargeback'}
                  {!payout.chargebackRule && 'Full Chargeback'}
                </Badge>
              </div>
              
              {/* Transaction Details Tabs */}
              {totalInsureds > 0 && (
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
                    {creditInsureds.length > 0 ? (
                      <InsuredTable insureds={creditInsureds} type="credits" formatCurrency={formatCurrency} />
                    ) : (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        No credit insureds
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="chargebacks" className="mt-3">
                    {chargebackInsureds.length > 0 ? (
                      <InsuredTable insureds={chargebackInsureds} type="chargebacks" formatCurrency={formatCurrency} />
                    ) : (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        No chargebacks 🎉
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Inline table component for insureds
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
  
  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between text-sm px-1">
        <span className="text-muted-foreground">
          {nonZeroInsureds.length} insured{nonZeroInsureds.length !== 1 ? 's' : ''}
        </span>
        <div className="flex gap-4">
          <span className={isChargeback ? 'text-destructive' : 'text-foreground'}>
            {isChargeback ? '-' : ''}{formatCurrency(totalPremium)} net premium
          </span>
          <span className={isChargeback ? 'text-destructive' : 'text-foreground'}>
            {isChargeback ? '-' : ''}{formatCurrency(totalCommission)} net comm
          </span>
        </div>
      </div>
      
      {/* Table */}
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TR>
              <TableHead>Insured Name</TableHead>
              <TableHead className="text-right">Net Premium</TableHead>
              <TableHead className="text-right">Net Commission</TableHead>
            </TR>
          </TableHeader>
          <TableBody>
            {nonZeroInsureds.slice(0, 10).map((ins, idx) => (
              <TR key={`${ins.insuredName}-${idx}`}>
                <TableCell className="max-w-[200px] truncate font-medium">
                  {ins.insuredName}
                </TableCell>
                <TableCell className={`text-right ${isChargeback ? 'text-destructive' : ''}`}>
                  {isChargeback ? '-' : ''}{formatCurrency(Math.abs(ins.netPremium))}
                </TableCell>
                <TableCell className={`text-right ${isChargeback ? 'text-destructive' : ''}`}>
                  {isChargeback ? '-' : ''}{formatCurrency(Math.abs(ins.netCommission))}
                </TableCell>
              </TR>
            ))}
            {nonZeroInsureds.length > 10 && (
              <TR>
                <TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-2">
                  + {nonZeroInsureds.length - 10} more insureds
                </TableCell>
              </TR>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}