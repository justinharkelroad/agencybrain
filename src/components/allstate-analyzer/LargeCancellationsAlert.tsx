import React, { useState } from 'react';
import { AlertTriangle, DollarSign, TrendingDown, ChevronDown, ChevronUp, Download, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface LargeCancellation {
  policyNumber: string;
  insuredName: string;
  product: string;
  businessType: string;
  bundleType: string;
  transType: string;
  cancelledPremium: number;
  lostCommission: number;
  channel: string;
  origPolicyEffDate?: string;
}

export interface LargeCancellationSummary {
  cancellations: LargeCancellation[];
  totalCancelledPremium: number;
  totalLostCommission: number;
  count: number;
}

interface Props {
  data: LargeCancellationSummary;
}

const THRESHOLD_OPTIONS = [
  { value: '1000', label: '$1,000+' },
  { value: '1500', label: '$1,500+' },
  { value: '2000', label: '$2,000+' },
  { value: '2500', label: '$2,500+' },
  { value: '3000', label: '$3,000+' },
];

export function LargeCancellationsAlert({ data }: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const [threshold, setThreshold] = useState('2000'); // Default to $2,000
  
  const allCancellations = data.cancellations;
  
  // Filter cancellations based on selected threshold
  const filteredCancellations = allCancellations.filter(
    c => c.cancelledPremium >= parseInt(threshold)
  );
  
  const totalCancelledPremium = filteredCancellations.reduce((sum, c) => sum + c.cancelledPremium, 0);
  const totalLostCommission = filteredCancellations.reduce((sum, c) => sum + c.lostCommission, 0);
  const count = filteredCancellations.length;
  
  if (allCancellations.length === 0) {
    return null;
  }

  const exportToCsv = () => {
    const headers = ['Policy Number', 'Insured', 'Product', 'Business Type', 'Bundle', 'Cancel Type', 'Cancelled Premium', 'Lost Commission', 'Channel', 'Orig Policy Date'];
    const rows = filteredCancellations.map(c => [
      c.policyNumber,
      c.insuredName,
      c.product,
      c.businessType,
      c.bundleType,
      c.transType,
      c.cancelledPremium.toFixed(2),
      c.lostCommission.toFixed(2),
      c.channel,
      c.origPolicyEffDate || ''
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `large_cancellations_${threshold}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Large Cancellations ({count})
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Threshold Filter */}
              <Select value={threshold} onValueChange={setThreshold}>
                <SelectTrigger className="h-8 w-[110px]">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THRESHOLD_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={exportToCsv} className="h-8">
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Policies with cancellations over ${parseInt(threshold).toLocaleString()} in premium
          </p>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-3 bg-background/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <TrendingDown className="h-4 w-4" />
                  Total Cancelled Premium
                </div>
                <div className="text-xl font-semibold text-destructive">
                  ${totalCancelledPremium.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-3 bg-background/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  Lost Commission
                </div>
                <div className="text-xl font-semibold text-destructive">
                  ${totalLostCommission.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Cancellation List */}
            {count === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No cancellations over ${parseInt(threshold).toLocaleString()}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCancellations.map((cancel, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border/50">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">{cancel.policyNumber}</span>
                        <Badge variant="secondary" className="text-xs">
                          {cancel.businessType}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {cancel.bundleType}
                        </Badge>
                      </div>
                      <div className="text-sm font-medium">
                        {cancel.insuredName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {cancel.product} • {cancel.transType}
                      </div>
                      {cancel.origPolicyEffDate && (
                        <div className="text-xs text-muted-foreground">
                          Orig: {cancel.origPolicyEffDate}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-destructive">
                        -${cancel.cancelledPremium.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        -${cancel.lostCommission.toLocaleString(undefined, { minimumFractionDigits: 2 })} comm
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
