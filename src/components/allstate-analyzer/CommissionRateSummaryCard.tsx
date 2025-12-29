import React from 'react';
import { Percent, TrendingUp, TrendingDown } from 'lucide-react';
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
  newBusiness: {
    premium: number;
    commission: number;
    avgBaseRate: number;
    avgVcRate: number;
    effectiveRate: number;
  };
}

interface Props {
  current: CommissionRateSummary;
  prior?: CommissionRateSummary;
  period: string;
}

export function CommissionRateSummaryCard({ current, prior, period }: Props) {
  const rateChange = prior ? current.effectiveRate - prior.effectiveRate : null;
  const nbRateChange = prior ? current.newBusiness.effectiveRate - prior.newBusiness.effectiveRate : null;

  // Avoid division by zero for composition bar
  const totalRate = current.avgBaseRate + current.avgVcRate;
  const baseBarWidth = totalRate > 0 ? (current.avgBaseRate / totalRate) * 100 : 50;
  const vcBarWidth = totalRate > 0 ? (current.avgVcRate / totalRate) * 100 : 50;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Percent className="h-5 w-5" />
          <CardTitle>Commission Rate Summary</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">{period}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Effective Rate */}
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground mb-1">Overall Effective Rate</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl font-bold text-primary">
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

        {/* Three Column Rate Breakdown */}
        <div className="grid grid-cols-3 gap-3">
          {/* Base Commission Rate */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Avg Base Rate</p>
            <p className="text-2xl font-semibold">{current.avgBaseRate.toFixed(2)}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              ${current.totalBaseCommission.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            {prior && (
              <p className={`text-xs mt-1 ${current.avgBaseRate >= prior.avgBaseRate ? 'text-green-500' : 'text-red-500'}`}>
                {current.avgBaseRate >= prior.avgBaseRate ? '↑' : '↓'} from {prior.avgBaseRate.toFixed(2)}%
              </p>
            )}
          </div>

          {/* VC Rate */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Avg VC Rate</p>
            <p className="text-2xl font-semibold text-green-500">{current.avgVcRate.toFixed(2)}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              ${current.totalVcAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            {prior && (
              <p className={`text-xs mt-1 ${current.avgVcRate >= prior.avgVcRate ? 'text-green-500' : 'text-red-500'}`}>
                {current.avgVcRate >= prior.avgVcRate ? '↑' : '↓'} from {prior.avgVcRate.toFixed(2)}%
              </p>
            )}
          </div>

          {/* New Business Effective Rate */}
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">New Business Rate</p>
            <p className="text-2xl font-semibold text-green-500">
              {current.newBusiness.effectiveRate.toFixed(2)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ${current.newBusiness.commission.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            {prior && (
              <p className={`text-xs mt-1 ${current.newBusiness.effectiveRate >= prior.newBusiness.effectiveRate ? 'text-green-500' : 'text-red-500'}`}>
                {current.newBusiness.effectiveRate >= prior.newBusiness.effectiveRate ? '↑' : '↓'} from {prior.newBusiness.effectiveRate.toFixed(2)}%
              </p>
            )}
          </div>
        </div>

        {/* Visual Breakdown Bar */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Commission Composition</p>
          <div className="h-4 rounded-full overflow-hidden flex bg-muted">
            <div 
              className="bg-blue-500 h-full transition-all" 
              style={{ width: `${baseBarWidth}%` }}
              title={`Base: ${current.avgBaseRate.toFixed(2)}%`}
            />
            <div 
              className="bg-green-500 h-full transition-all" 
              style={{ width: `${vcBarWidth}%` }}
              title={`VC: ${current.avgVcRate.toFixed(2)}%`}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-blue-500 rounded-full" /> Base
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full" /> VC
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
