import React from 'react';
import { TrendingUp, TrendingDown, FileText, Package, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SubProducerMetrics } from '@/lib/allstate-analyzer/sub-producer-analyzer';

interface Props {
  producer: SubProducerMetrics;
  isAgency?: boolean;
}

export function SubProducerCard({ producer, isAgency }: Props) {
  const hasChargebacks = producer.premiumChargebacks > 0;
  
  return (
    <Card className={isAgency ? 'border-primary/30' : ''}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-base">
            {producer.displayName}
          </div>
          <div className="text-sm text-muted-foreground">
            {producer.effectiveRate.toFixed(1)}% effective rate
          </div>
        </div>
        
        {/* Premium Section */}
        <div className="mb-4">
          <div className="text-xs font-medium text-muted-foreground mb-2">Premium</div>
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
            {producer.cancellationCount > 0 && (
              <div className="flex items-center gap-1.5 text-red-500">
                <XCircle className="h-3.5 w-3.5" />
                <span>{producer.cancellationCount} Cancels</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Commission Section */}
        <div>
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
      </CardContent>
    </Card>
  );
}
