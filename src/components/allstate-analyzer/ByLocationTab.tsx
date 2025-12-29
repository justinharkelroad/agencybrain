import React, { useState, useMemo } from 'react';
import { Building2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatementTransaction } from '@/lib/allstate-parser/excel-parser';

// Import existing analysis components
import { CommissionRateSummaryCard } from './CommissionRateSummaryCard';
import { BusinessTypeMixAnalysis } from './BusinessTypeMixAnalysis';
import { LargeCancellationsAlert } from './LargeCancellationsAlert';
import { SubProducerSummaryCard } from './SubProducerSummaryCard';

// Import existing analysis functions
import { 
  calculateCommissionSummary,
  analyzeBusinessTypeMix,
  detectLargeCancellations
} from '@/lib/allstate-analyzer/rate-validator';
import { analyzeSubProducers } from '@/lib/allstate-analyzer/sub-producer-analyzer';

interface Props {
  currentTransactions: StatementTransaction[];
  priorTransactions: StatementTransaction[];
  agentNumbers: string[];
  statementPeriod: string;
}

export function ByLocationTab({ 
  currentTransactions, 
  priorTransactions, 
  agentNumbers,
  statementPeriod 
}: Props) {
  
  // Default to first agent number
  const [selectedAgent, setSelectedAgent] = useState(agentNumbers[0] || '');
  
  // Filter transactions by selected agent number
  const filteredCurrent = useMemo(() => {
    if (!selectedAgent) return [];
    return currentTransactions.filter(tx => tx.agentNumber === selectedAgent);
  }, [currentTransactions, selectedAgent]);
  
  const filteredPrior = useMemo(() => {
    if (!selectedAgent) return [];
    return priorTransactions.filter(tx => tx.agentNumber === selectedAgent);
  }, [priorTransactions, selectedAgent]);
  
  // Run analysis on filtered data
  const commissionSummary = useMemo(() => {
    return calculateCommissionSummary(filteredCurrent);
  }, [filteredCurrent]);
  
  const priorCommissionSummary = useMemo(() => {
    if (filteredPrior.length === 0) return null;
    return calculateCommissionSummary(filteredPrior);
  }, [filteredPrior]);
  
  const businessTypeMix = useMemo(() => {
    return analyzeBusinessTypeMix(filteredPrior, filteredCurrent);
  }, [filteredPrior, filteredCurrent]);
  
  const largeCancellations = useMemo(() => {
    return detectLargeCancellations(filteredCurrent, 1000);
  }, [filteredCurrent]);
  
  const subProducerData = useMemo(() => {
    return analyzeSubProducers(filteredCurrent);
  }, [filteredCurrent]);
  
  // Calculate quick stats for the header
  const totalPremium = filteredCurrent.reduce((sum, tx) => sum + (tx.writtenPremium || 0), 0);
  const totalCommission = filteredCurrent.reduce((sum, tx) => {
    const base = tx.baseCommissionAmount || 0;
    const vc = tx.vcAmount || 0;
    return sum + (tx.totalCommission || (base + vc));
  }, 0);

  if (agentNumbers.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="space-y-3">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-lg font-medium">No location data available</p>
          <p className="text-sm text-muted-foreground">
            Upload statements to view location breakdown
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Location Selector Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Location Analysis
            </CardTitle>
            
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select Location" />
              </SelectTrigger>
              <SelectContent>
                {agentNumbers.map((agentNum) => (
                  <SelectItem key={agentNum} value={agentNum}>
                    Agent #{agentNum}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">
                {filteredCurrent.length.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Transactions</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">
                ${totalPremium.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground">Total Premium</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">
                ${totalCommission.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground">Total Commission</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">
                {totalPremium > 0 ? ((totalCommission / totalPremium) * 100).toFixed(1) : '0'}%
              </div>
              <p className="text-xs text-muted-foreground">Effective Rate</p>
            </div>
          </div>
          
          {/* Comparison indicator */}
          {filteredPrior.length > 0 && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Comparing to prior period: {filteredPrior.length.toLocaleString()} transactions
            </p>
          )}
        </CardContent>
      </Card>

      {/* Commission Rate Summary */}
      <CommissionRateSummaryCard 
        current={commissionSummary}
        prior={priorCommissionSummary ?? undefined}
        period={statementPeriod}
      />

      {/* Business Type Mix */}
      {businessTypeMix && filteredPrior.length > 0 && (
        <BusinessTypeMixAnalysis 
          comparison={businessTypeMix}
          priorPeriod="Prior Period"
          currentPeriod={statementPeriod}
        />
      )}

      {/* Sub-Producer Breakdown */}
      {subProducerData && subProducerData.producerCount > 0 && (
        <SubProducerSummaryCard data={subProducerData} period={statementPeriod} />
      )}

      {/* Large Cancellations */}
      {largeCancellations && largeCancellations.count > 0 && (
        <LargeCancellationsAlert data={largeCancellations} />
      )}

      {/* Empty State for No Data */}
      {filteredCurrent.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No transactions found for Agent #{selectedAgent}
            </p>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
