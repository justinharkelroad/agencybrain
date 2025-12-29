import React from 'react';
import { TrendingUp, TrendingDown, ArrowRight, PieChart, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface BusinessTypeMixItem {
  businessType: string;
  transactionCount: number;
  totalPremium: number;
  totalCommission: number;
  percentOfPremium: number;
  percentOfTransactions: number;
}

export interface BusinessTypeMixComparison {
  prior: BusinessTypeMixItem[];
  current: BusinessTypeMixItem[];
  changes: {
    businessType: string;
    premiumChange: number;
    premiumChangePercent: number;
    mixShift: number;
    commissionChange: number;
  }[];
  summary: {
    priorNewBusinessPercent: number;
    currentNewBusinessPercent: number;
    newBusinessMixShift: number;
    isRenewalHeavy: boolean;
  };
}

interface Props {
  comparison: BusinessTypeMixComparison;
  priorPeriod: string;
  currentPeriod: string;
}

const TYPE_COLORS: Record<string, string> = {
  'New Business': 'bg-green-500',
  'New': 'bg-green-500',
  'Renewal': 'bg-blue-500',
  'First Renewal': 'bg-purple-500',
  'FirstRenewal': 'bg-purple-500',
  'Unknown': 'bg-gray-500'
};

export function BusinessTypeMixAnalysis({ comparison, priorPeriod, currentPeriod }: Props) {
  const { prior, current, changes, summary } = comparison;

  const getColorClass = (type: string) => TYPE_COLORS[type] || 'bg-gray-500';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <PieChart className="h-5 w-5" />
          <CardTitle>Business Type Mix Analysis</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          {priorPeriod} → {currentPeriod}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Alert if renewal-heavy shift */}
        {summary.isRenewalHeavy && Math.abs(summary.newBusinessMixShift) > 2 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-500">New Business Mix Declined</p>
              <p className="text-sm text-muted-foreground">
                New Business dropped from {summary.priorNewBusinessPercent.toFixed(1)}% to {summary.currentNewBusinessPercent.toFixed(1)}% of premium 
                ({summary.newBusinessMixShift.toFixed(1)} percentage points). 
                Book is becoming more renewal-heavy.
              </p>
            </div>
          </div>
        )}

        {/* Side by Side Comparison */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Prior Period */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">{priorPeriod}</h4>
            <div className="space-y-2">
              {prior.map(item => (
                <div key={item.businessType} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{item.businessType}</span>
                    <span className="font-medium">{item.percentOfPremium.toFixed(1)}%</span>
                  </div>
                  <Progress value={item.percentOfPremium} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    ${item.totalPremium.toLocaleString(undefined, { minimumFractionDigits: 0 })} premium
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Current Period */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">{currentPeriod}</h4>
            <div className="space-y-2">
              {current.map(item => (
                <div key={item.businessType} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{item.businessType}</span>
                    <span className="font-medium">{item.percentOfPremium.toFixed(1)}%</span>
                  </div>
                  <Progress value={item.percentOfPremium} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    ${item.totalPremium.toLocaleString(undefined, { minimumFractionDigits: 0 })} premium
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Changes Table */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Year-over-Year Changes</h4>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business Type</TableHead>
                  <TableHead>Premium Δ</TableHead>
                  <TableHead>Mix Shift</TableHead>
                  <TableHead>Commission Δ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changes.map(change => (
                  <TableRow key={change.businessType}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getColorClass(change.businessType)}`} />
                        {change.businessType}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`flex items-center gap-1 ${change.premiumChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {change.premiumChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        ${Math.abs(change.premiumChange).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                        <span className="text-xs text-muted-foreground">
                          ({change.premiumChangePercent >= 0 ? '+' : ''}{change.premiumChangePercent.toFixed(1)}%)
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={Math.abs(change.mixShift) > 2 ? 'default' : 'outline'}
                        className={Math.abs(change.mixShift) > 2 ? (change.mixShift > 0 ? 'bg-green-500' : 'bg-red-500') : ''}
                      >
                        {change.mixShift >= 0 ? '+' : ''}{change.mixShift.toFixed(1)} pts
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={change.commissionChange >= 0 ? 'text-green-500' : 'text-red-500'}>
                        {change.commissionChange >= 0 ? '+' : ''}${change.commissionChange.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
