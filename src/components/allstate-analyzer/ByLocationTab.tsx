import React, { useState, useMemo } from 'react';
import { Building2, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatementTransaction } from '@/lib/allstate-parser/excel-parser';
import { RateDiscrepancy } from '@/lib/allstate-analyzer/rate-validator';
import { TeamMemberForLookup } from '@/lib/allstate-analyzer/sub-producer-analyzer';

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
  priorPeriod?: string;
  potentialUnderpayments: RateDiscrepancy[];
  teamMembers?: TeamMemberForLookup[];
}

export function ByLocationTab({ 
  currentTransactions, 
  priorTransactions, 
  agentNumbers,
  statementPeriod,
  priorPeriod,
  potentialUnderpayments,
  teamMembers = []
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

  // Filter underpayments by agent number
  const filteredUnderpayments = useMemo(() => {
    if (!selectedAgent || !potentialUnderpayments) return [];
    return potentialUnderpayments.filter(d => {
      const matchingTx = filteredCurrent.find(tx => tx.policyNumber === d.policyNumber);
      return matchingTx !== undefined;
    });
  }, [potentialUnderpayments, selectedAgent, filteredCurrent]);
  
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

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  const formatPercent = (rate: number) => `${(rate * 100).toFixed(2)}%`;

  if (agentNumbers.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="space-y-3">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-lg font-medium">No location data available</p>
          <p className="text-sm text-muted-foreground">Upload statements to view location breakdown</p>
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
              <SelectTrigger className="w-[200px] bg-background">
                <SelectValue placeholder="Select Location" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {agentNumbers.map((agentNum) => (
                  <SelectItem key={agentNum} value={agentNum}>Agent #{agentNum}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{filteredCurrent.length.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Transactions</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">${totalPremium.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <p className="text-xs text-muted-foreground">Total Premium</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">${totalCommission.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <p className="text-xs text-muted-foreground">Total Commission</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{totalPremium > 0 ? ((totalCommission / totalPremium) * 100).toFixed(1) : '0'}%</div>
              <p className="text-xs text-muted-foreground">Effective Rate</p>
            </div>
          </div>
          {filteredPrior.length > 0 && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Comparing to prior period: {filteredPrior.length.toLocaleString()} transactions
            </p>
          )}
        </CardContent>
      </Card>

      <CommissionRateSummaryCard current={commissionSummary} prior={priorCommissionSummary ?? undefined} period={statementPeriod} />

      {businessTypeMix && filteredPrior.length > 0 && (
        <BusinessTypeMixAnalysis comparison={businessTypeMix} priorPeriod={priorPeriod || "Prior Period"} currentPeriod={statementPeriod} />
      )}

      {subProducerData && subProducerData.producerCount > 0 && (
        <SubProducerSummaryCard data={subProducerData} period={statementPeriod} teamMembers={teamMembers} />
      )}

      {largeCancellations && largeCancellations.count > 0 && (
        <LargeCancellationsAlert data={largeCancellations} />
      )}

      {/* Potential Underpayments for this location */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {filteredUnderpayments.length > 0 ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <CheckCircle className="h-5 w-5 text-green-500" />}
            Potential Underpayments - Agent #{selectedAgent}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredUnderpayments.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">No Potential Underpayments Found!</p>
              <p className="text-sm text-muted-foreground mt-2">All discrepancies for this location have been matched to legitimate exclusion reasons.</p>
            </div>
          ) : (
            <>
              <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200">{filteredUnderpayments.length} transaction{filteredUnderpayments.length !== 1 ? 's' : ''} requiring investigation</p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">Total potential missing VC: {formatCurrency(filteredUnderpayments.reduce((sum, d) => sum + d.missingVcDollars, 0))}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Policy</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Premium</TableHead>
                      <TableHead className="text-right">Missing VC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnderpayments.slice(0, 20).map((d, i) => (
                      <TableRow key={`${d.policyNumber}-${i}`}>
                        <TableCell className="font-mono text-xs">{d.policyNumber}</TableCell>
                        <TableCell>{d.productCategory}</TableCell>
                        <TableCell><Badge variant="outline">{d.businessType}</Badge></TableCell>
                        <TableCell className="text-right">{formatCurrency(d.writtenPremium)}</TableCell>
                        <TableCell className="text-right font-bold text-destructive">{formatCurrency(d.missingVcDollars)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filteredUnderpayments.length > 20 && <p className="text-sm text-muted-foreground mt-3 text-center">Showing 20 of {filteredUnderpayments.length} transactions</p>}
            </>
          )}
        </CardContent>
      </Card>

      {filteredCurrent.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No transactions found for Agent #{selectedAgent}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
