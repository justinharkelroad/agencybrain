import React, { useState, useMemo } from 'react';
import { FileText, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SubProducerMetrics, InsuredAggregate } from '@/lib/allstate-analyzer/sub-producer-analyzer';
import { SubProducerTransactionTable } from './SubProducerTransactionTable';

interface Props {
  producer: SubProducerMetrics;
  isAgency?: boolean;
}

export function SubProducerCard({ producer, isAgency }: Props) {
  const [showTransactions, setShowTransactions] = useState(false);
  const hasChargebacks = producer.premiumChargebacks > 0;
  const isNetNegative = producer.netPremium < 0;
  
  // Hydrate insured arrays from raw transactions if missing
  const { creditInsureds, chargebackInsureds } = useMemo(() => {
    // If we already have insured arrays with data, use them
    if ((producer.creditInsureds?.length || 0) > 0 || (producer.chargebackInsureds?.length || 0) > 0) {
      return {
        creditInsureds: producer.creditInsureds || [],
        chargebackInsureds: producer.chargebackInsureds || []
      };
    }
    
    // Otherwise, rebuild from raw transaction arrays
    const allTransactions = [
      ...(producer.creditTransactions || []),
      ...(producer.chargebackTransactions || [])
    ];
    
    if (allTransactions.length === 0) {
      return { creditInsureds: [], chargebackInsureds: [] };
    }
    
    // Group by insured name
    const insuredMap = new Map<string, { netPremium: number; netCommission: number; txnCount: number }>();
    
    for (const txn of allTransactions) {
      const name = txn.insuredName || 'Unknown';
      const existing = insuredMap.get(name) || { netPremium: 0, netCommission: 0, txnCount: 0 };
      existing.netPremium += txn.premium || 0;
      existing.netCommission += txn.commission || 0;
      existing.txnCount += 1;
      insuredMap.set(name, existing);
    }
    
    // Categorize by net premium
    const credits: InsuredAggregate[] = [];
    const chargebacks: InsuredAggregate[] = [];
    
    insuredMap.forEach((data, name) => {
      if (data.netPremium > 0.005) {
        credits.push({ insuredName: name, netPremium: data.netPremium, netCommission: data.netCommission, transactionCount: data.txnCount });
      } else if (data.netPremium < -0.005) {
        chargebacks.push({ insuredName: name, netPremium: data.netPremium, netCommission: data.netCommission, transactionCount: data.txnCount });
      }
      // Net zero excluded
    });
    
    // Sort: credits desc, chargebacks asc (most negative first)
    credits.sort((a, b) => b.netPremium - a.netPremium);
    chargebacks.sort((a, b) => a.netPremium - b.netPremium);
    
    return { creditInsureds: credits, chargebackInsureds: chargebacks };
  }, [producer]);
  
  const totalInsureds = creditInsureds.length + chargebackInsureds.length;
  
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
          <div className="text-xs font-medium text-muted-foreground mb-2">Premium (First-Term, Net per Insured)</div>
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
              <span>{producer.creditCount || 0} Credits</span>
            </div>
            {(producer.chargebackCount || 0) > 0 && (
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
        {totalInsureds > 0 && (
          <Collapsible open={showTransactions} onOpenChange={setShowTransactions}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-center gap-1 text-muted-foreground hover:text-foreground">
                {showTransactions ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    View Details ({totalInsureds} insureds)
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
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
                    <SubProducerTransactionTable insureds={creditInsureds} type="credits" />
                  ) : (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      No credit insureds
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="chargebacks" className="mt-3">
                  {chargebackInsureds.length > 0 ? (
                    <SubProducerTransactionTable insureds={chargebackInsureds} type="chargebacks" />
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
