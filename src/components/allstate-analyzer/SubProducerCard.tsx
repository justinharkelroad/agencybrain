import React, { useState } from 'react';
import { FileText, Package, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SubProducerMetrics } from '@/lib/allstate-analyzer/sub-producer-analyzer';
import { SubProducerTransactionTable } from './SubProducerTransactionTable';

interface Props {
  producer: SubProducerMetrics;
  isAgency?: boolean;
}

export function SubProducerCard({ producer, isAgency }: Props) {
  const [showTransactions, setShowTransactions] = useState(false);
  const hasChargebacks = producer.premiumChargebacks > 0;
  const isNetNegative = producer.netPremium < 0;
  
  // Defensive defaults for legacy data + filter out zero-premium transactions
  const creditTransactions = producer.creditTransactions || [];
  const chargebackTransactions = producer.chargebackTransactions || [];
  const nonZeroCredits = creditTransactions.filter(tx => Math.abs(tx.premium) > 0);
  const nonZeroChargebacks = chargebackTransactions.filter(tx => Math.abs(tx.premium) > 0);
  const totalNonZero = nonZeroCredits.length + nonZeroChargebacks.length;
  
  return (
    <Card className={isAgency ? 'border-primary/30' : ''}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-base">
              {producer.displayName}
            </span>
            {isNetNegative && (
              <Badge variant="destructive" className="text-xs">
                Net Negative
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {producer.effectiveRate.toFixed(1)}% effective rate
          </div>
        </div>
        
        {/* Premium Section */}
        <div className="mb-4">
          <div className="text-xs font-medium text-muted-foreground mb-2">Premium (First-Term Only)</div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Written</div>
              <div className="font-medium">
                ${producer.premiumWritten.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Chargebacks</div>
              <div className={`font-medium ${hasChargebacks ? 'text-red-500' : ''}`}>
                {hasChargebacks ? '-' : ''}${producer.premiumChargebacks.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Net</div>
              <div className={`font-medium ${producer.netPremium >= 0 ? 'text-primary' : 'text-red-400'}`}>
                ${producer.netPremium.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
        
        {/* Counts Section */}
        <div className="mb-4">
          <div className="text-xs font-medium text-muted-foreground mb-2">Activity</div>
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{producer.policiesIssued} Policies</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{producer.itemsIssued} Items</span>
            </div>
            {producer.chargebackCount > 0 && (
              <div className="flex items-center gap-1.5 text-red-500">
                <XCircle className="h-3.5 w-3.5" />
                <span>{producer.chargebackCount} Chargebacks</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Commission Section */}
        <div className="mb-4">
          <div className="text-xs font-medium text-muted-foreground mb-2">Commission</div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Earned</div>
              <div className="font-medium">
                ${producer.commissionEarned.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Chargebacks</div>
              <div className={`font-medium ${producer.commissionChargebacks > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                {producer.commissionChargebacks > 0 ? '-' : ''}${producer.commissionChargebacks.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Net</div>
              <div className={`font-medium ${producer.netCommission >= 0 ? 'text-primary' : 'text-red-400'}`}>
                ${producer.netCommission.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
        
        {/* Transaction Drill-Down */}
        {totalNonZero > 0 && (
          <Collapsible open={showTransactions} onOpenChange={setShowTransactions}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-center gap-1 text-muted-foreground hover:text-foreground">
                {showTransactions ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Hide Transactions
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    View Transactions ({totalNonZero})
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <Tabs defaultValue="credits" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="credits">
                    Credits ({nonZeroCredits.length})
                  </TabsTrigger>
                  <TabsTrigger value="chargebacks">
                    Chargebacks ({nonZeroChargebacks.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="credits" className="mt-3">
                  {nonZeroCredits.length > 0 ? (
                    <SubProducerTransactionTable transactions={creditTransactions} type="credits" />
                  ) : (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      No credit transactions
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="chargebacks" className="mt-3">
                  {nonZeroChargebacks.length > 0 ? (
                    <SubProducerTransactionTable transactions={chargebackTransactions} type="chargebacks" />
                  ) : (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      No chargebacks 🎉
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
