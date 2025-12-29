import React from 'react';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface CommissionRateSummary {
  totalPremium: number;
  totalCommissionablePremium: number;
  totalBaseCommission: number;
  totalVcAmount: number;
  totalCommission: number;
  avgBaseRate: number;
  avgVcRate: number;
  effectiveRate: number;
}

interface Props {
  current: CommissionRateSummary;
  prior?: CommissionRateSummary;
  period: string;
}

export function CommissionRateSummaryCard({ current, prior, period }: Props) {
  const rateChange = prior ? current.effectiveRate - prior.effectiveRate : null;
  
  // Avoid division by zero for composition percentages
  const baseComposition = current.effectiveRate > 0 
    ? (current.avgBaseRate / current.effectiveRate) * 100 
    : 0;
  const vcComposition = current.effectiveRate > 0 
    ? (current.avgVcRate / current.effectiveRate) * 100 
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          <CardTitle>Commission Rate Summary</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">{period}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Effective Rate */}
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground mb-1">Overall Effective Rate</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl font-bold">
              {current.effectiveRate.toFixed(2)}%
            </span>
            {rateChange !== null && (
              <span className={`flex items-center gap-1 text-sm ${rateChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {rateChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {rateChange >= 0 ? '+' : ''}{rateChange.toFixed(2)} pts
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            ${current.totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2 })} commission 
            ÷ ${current.totalPremium.toLocaleString(undefined, { minimumFractionDigits: 2 })} premium
          </p>
        </div>

        {/* Rate Breakdown */}
        <div className="grid grid-cols-2 gap-4">
          {/* Base Commission Rate */}
          <div className="p-3 border rounded-lg">
            <p className="text-xs text-muted-foreground">Avg Base Rate</p>
            <p className="text-2xl font-bold">{current.avgBaseRate.toFixed(2)}%</p>
            <p className="text-xs text-muted-foreground">
              ${current.totalBaseCommission.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            {prior && (
              <p className={`text-xs mt-1 ${current.avgBaseRate >= prior.avgBaseRate ? 'text-green-500' : 'text-red-500'}`}>
                {current.avgBaseRate >= prior.avgBaseRate ? '↑' : '↓'} from {prior.avgBaseRate.toFixed(2)}%
              </p>
            )}
          </div>

          {/* VC Rate */}
          <div className="p-3 border rounded-lg">
            <p className="text-xs text-muted-foreground">Avg VC Rate</p>
            <p className="text-2xl font-bold">{current.avgVcRate.toFixed(2)}%</p>
            <p className="text-xs text-muted-foreground">
              ${current.totalVcAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            {prior && (
              <p className={`text-xs mt-1 ${current.avgVcRate >= prior.avgVcRate ? 'text-green-500' : 'text-red-500'}`}>
                {current.avgVcRate >= prior.avgVcRate ? '↑' : '↓'} from {prior.avgVcRate.toFixed(2)}%
              </p>
            )}
          </div>
        </div>

        {/* Visual Breakdown Bar */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Commission Composition</p>
          <div className="h-4 rounded-full overflow-hidden flex bg-muted">
            <div 
              className="bg-blue-500 transition-all" 
              style={{ width: `${baseComposition}%` }}
            />
            <div 
              className="bg-green-500 transition-all" 
              style={{ width: `${vcComposition}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" />
              Base ({baseComposition.toFixed(0)}%)
            </span>
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />
              VC ({vcComposition.toFixed(0)}%)
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
