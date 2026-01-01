import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  CheckCircle, 
  DollarSign, 
  FileText,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  Building2,
  LayoutDashboard
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ValidationResult, RateDiscrepancy, ExclusionReason, BusinessTypeMixComparison, CommissionRateSummary, LargeCancellationSummary } from '@/lib/allstate-analyzer/rate-validator';
import { SubProducerSummary, TeamMemberForLookup } from '@/lib/allstate-analyzer/sub-producer-analyzer';
import { StatementTransaction } from '@/lib/allstate-parser/excel-parser';
import { BusinessTypeMixAnalysis } from './BusinessTypeMixAnalysis';
import { CommissionRateSummaryCard } from './CommissionRateSummaryCard';
import { LargeCancellationsAlert } from './LargeCancellationsAlert';
import { SubProducerSummaryCard } from './SubProducerSummaryCard';
import { ByLocationTab } from './ByLocationTab';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface DiscrepancyResultsProps {
  results: ValidationResult;
  mixAnalysis?: BusinessTypeMixComparison;
  commissionSummary?: {
    prior: CommissionRateSummary;
    current: CommissionRateSummary;
  };
  largeCancellations?: LargeCancellationSummary;
  subProducerData?: SubProducerSummary;
  priorPeriod?: string;
  currentPeriod?: string;
  // Props for By Location tab
  currentTransactions?: StatementTransaction[];
  priorTransactions?: StatementTransaction[];
  agentNumbers?: string[];
}

const EXCLUSION_LABELS: Record<ExclusionReason, string> = {
  'NONE': 'No Exclusion',
  'EXCLUDED_DIRECT_BOUND': 'Direct/Web Bound',
  'EXCLUDED_FIRST_RENEWAL_6MO': 'First Renewal (6-mo)',
  'EXCLUDED_SERVICE_FEE': 'Service Fee Policy',
  'EXCLUDED_PLUS_POLICY': 'Plus Policy',
  'EXCLUDED_NONSTANDARD_AUTO': 'Non-Standard Auto',
  'EXCLUDED_PRE_2023_POLICY': 'Pre-2023 Policy',
  'EXCLUDED_JUA_JUP': 'JUA/JUP Policy',
  'EXCLUDED_FACILITY_CEDED': 'Facility Ceded',
  'EXCLUDED_MONOLINE_RENEWAL': 'Monoline Renewal',
  'EXCLUDED_NB_ITEM_ADDITION': 'NB Item Addition',
  'EXCLUDED_ENDORSEMENT_ADD_DROP': 'Add/Drop Endorsement',
  'UNKNOWN_EXCLUSION': 'Unknown - Investigate',
};

const EXCLUSION_DESCRIPTIONS: Record<ExclusionReason, string> = {
  'NONE': 'No exclusion applies',
  'EXCLUDED_DIRECT_BOUND': 'Policies bound via 1-800-Allstate or Allstate.com are excluded from agent VC',
  'EXCLUDED_FIRST_RENEWAL_6MO': 'First renewals of 6-month auto use NB VC rates (Elite only), not renewal rates',
  'EXCLUDED_SERVICE_FEE': 'Service Fee policies do not qualify for variable compensation',
  'EXCLUDED_PLUS_POLICY': 'Plus Policies do not qualify for variable compensation',
  'EXCLUDED_NONSTANDARD_AUTO': 'Non-Standard Auto is excluded from all variable compensation',
  'EXCLUDED_PRE_2023_POLICY': 'Variable Compensation only applies to policies with an original effective date of January 1, 2023 or later. This policy predates the VC program.',
  'EXCLUDED_JUA_JUP': 'JUA/JUP/Assigned Risk policies are excluded from variable compensation',
  'EXCLUDED_FACILITY_CEDED': 'Premium ceded to Facility is excluded from variable compensation',
  'EXCLUDED_MONOLINE_RENEWAL': 'Monoline renewal policies do not receive renewal VC - only Bundled/Preferred qualify',
  'EXCLUDED_NB_ITEM_ADDITION': 'This "New Business" transaction is for a new item (vehicle/coverage) added to an existing policy, not a truly new policy. NB VC only applies to brand new policies bound in the period.',
  'EXCLUDED_ENDORSEMENT_ADD_DROP': 'Add car/add item and drop item endorsement premium is excluded from variable compensation. The premium becomes VC-eligible upon the next policy renewal.',
  'UNKNOWN_EXCLUSION': 'No exclusion reason detected - this may be a potential underpayment to investigate',
};

export function DiscrepancyResults({ 
  results, 
  mixAnalysis, 
  commissionSummary, 
  largeCancellations, 
  subProducerData, 
  priorPeriod, 
  currentPeriod,
  currentTransactions = [],
  priorTransactions = [],
  agentNumbers = []
}: DiscrepancyResultsProps) {
  const { user } = useAuth();
  const [expandedSection, setExpandedSection] = useState<string | null>('underpayments');
  const [showAllUnderpayments, setShowAllUnderpayments] = useState(false);
  const [topLevelTab, setTopLevelTab] = useState<string>('combined');

  // Fetch agency ID from user profile
  const { data: agencyId } = useQuery({
    queryKey: ['user-agency-id', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user!.id)
        .single();
      if (error) throw error;
      return data?.agency_id as string | null;
    },
  });

  // Fetch team members for sub-producer display names
  const { data: teamMembers = [] } = useQuery<TeamMemberForLookup[]>({
    queryKey: ['team-members-sub-prod', agencyId],
    enabled: !!agencyId && !!subProducerData,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, sub_producer_code')
        .eq('agency_id', agencyId!)
        .eq('status', 'active');
      if (error) throw error;
      return (data || []) as TeamMemberForLookup[];
    },
  });

  const {
    potentialUnderpayments,
    excludedTransactions,
    exclusionBreakdown,
    totalMissingVcDollars,
    analyzed,
    aapLevel,
    state,
  } = results;

  // Group excluded transactions by reason
  const excludedByReason = excludedTransactions.reduce((acc, tx) => {
    const reason = tx.exclusionReason;
    if (!acc[reason]) acc[reason] = [];
    acc[reason].push(tx);
    return acc;
  }, {} as Record<ExclusionReason, RateDiscrepancy[]>);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercent = (rate: number) => {
    return `${(rate * 100).toFixed(2)}%`;
  };

  const exportToCSV = (data: RateDiscrepancy[], filename: string) => {
    const headers = [
      'Policy Number',
      'Row',
      'Transaction Type',
      'Product',
      'Category',
      'Business Type',
      'Bundle Type',
      'Written Premium',
      'Actual VC Rate',
      'Expected VC Rate',
      'Missing VC $',
      'Exclusion Reason',
      'Notes',
    ];

    const rows = data.map(d => [
      d.policyNumber,
      d.rowNumber,
      d.transactionType,
      d.productRaw,
      d.productCategory || '',
      d.businessType,
      d.bundleType,
      d.writtenPremium.toFixed(2),
      formatPercent(d.actualVcRate),
      formatPercent(d.expectedVcRate),
      d.missingVcDollars.toFixed(2),
      d.exclusionReason,
      d.exclusionNote,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Ensure we have at least one agent number for By Location tab
  const effectiveAgentNumbers = agentNumbers.length > 0 ? agentNumbers : ['Unknown'];

  return (
    <div className="space-y-6">
      {/* Top-Level Tabs: Combined vs By Location */}
      <Tabs value={topLevelTab} onValueChange={setTopLevelTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="combined" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Combined
          </TabsTrigger>
          <TabsTrigger value="by-location" className="gap-2">
            <Building2 className="h-4 w-4" />
            By Location
            {agentNumbers.length > 1 && (
              <Badge variant="secondary" className="ml-1">
                {agentNumbers.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ========== COMBINED TAB ========== */}
        <TabsContent value="combined" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Transactions Analyzed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{analyzed.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {state} • {aapLevel}
                </p>
              </CardContent>
            </Card>

            <Card className={potentialUnderpayments.length > 0 ? 'border-destructive border-2' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  {potentialUnderpayments.length > 0 ? (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  Potential Underpayments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${potentialUnderpayments.length > 0 ? 'text-destructive' : 'text-green-500'}`}>
                  {potentialUnderpayments.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Require investigation
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Legitimately Excluded
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  {excludedTransactions.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  0% VC is correct
                </p>
              </CardContent>
            </Card>

            <Card className={totalMissingVcDollars > 0 ? 'border-amber-500 border-2' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Potential Missing VC
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${totalMissingVcDollars > 0 ? 'text-amber-500' : ''}`}>
                  {formatCurrency(totalMissingVcDollars)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  If underpayments confirmed
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Exclusion Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-5 w-5" />
                Exclusion Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <TooltipProvider>
                  {Object.entries(exclusionBreakdown)
                    .filter(([_, count]) => count > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([reason, count]) => (
                      <Tooltip key={reason}>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50 cursor-help">
                            <span className="text-sm font-medium">
                              {EXCLUSION_LABELS[reason as ExclusionReason]}
                            </span>
                            <Badge variant={reason === 'UNKNOWN_EXCLUSION' ? 'destructive' : 'secondary'}>
                              {count}
                            </Badge>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <p>{EXCLUSION_DESCRIPTIONS[reason as ExclusionReason]}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                </TooltipProvider>
              </div>
            </CardContent>
          </Card>

          {/* Commission Rate Summary */}
          {commissionSummary && currentPeriod && (
            <CommissionRateSummaryCard 
              current={commissionSummary.current}
              prior={commissionSummary.prior}
              period={currentPeriod}
            />
          )}

          {/* Business Type Mix Analysis */}
          {mixAnalysis && priorPeriod && currentPeriod && (
            <BusinessTypeMixAnalysis 
              comparison={mixAnalysis}
              priorPeriod={priorPeriod}
              currentPeriod={currentPeriod}
            />
          )}

          {/* Large Cancellations Alert */}
          {largeCancellations && largeCancellations.count > 0 && (
            <LargeCancellationsAlert data={largeCancellations} />
          )}

          {/* Sub-Producer Breakdown */}
          {subProducerData && subProducerData.producerCount > 0 && currentPeriod && (
            <SubProducerSummaryCard data={subProducerData} period={currentPeriod} teamMembers={teamMembers} />
          )}

          {/* Sub-tabs for Underpayments and Excluded */}
          <Tabs defaultValue="underpayments" className="space-y-4">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="underpayments" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Potential Underpayments ({potentialUnderpayments.length})
              </TabsTrigger>
              <TabsTrigger value="excluded" className="gap-2">
                <CheckCircle className="h-4 w-4" />
                Excluded Transactions ({excludedTransactions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="underpayments">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">
                    🚨 Transactions Requiring Investigation
                  </CardTitle>
                  {potentialUnderpayments.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportToCSV(potentialUnderpayments, 'potential-underpayments.csv')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {potentialUnderpayments.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                      <p className="text-lg font-medium">No Potential Underpayments Found!</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        All discrepancies have been matched to legitimate exclusion reasons.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <div className="flex gap-3">
                          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-amber-800 dark:text-amber-200">Investigation Required</p>
                            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                              These transactions show 0% VC but no exclusion reason was detected. 
                              Check the original Excel/statement data for: Channel of Bind, Service Fee flags, 
                              Policy Type, and Original Effective Date.
                            </p>
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
                              <TableHead>Bundle</TableHead>
                              <TableHead className="text-right">Premium</TableHead>
                              <TableHead className="text-right">Expected</TableHead>
                              <TableHead className="text-right">Missing VC</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(showAllUnderpayments 
                              ? potentialUnderpayments 
                              : potentialUnderpayments.slice(0, 20)
                            ).map((d, i) => (
                              <TableRow key={`${d.policyNumber}-${i}`}>
                                <TableCell className="font-mono text-xs">
                                  {d.policyNumber}
                                </TableCell>
                                <TableCell>
                                  <p className="font-medium text-sm">{d.productCategory}</p>
                                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                    {d.productRaw}
                                  </p>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{d.businessType}</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{d.bundleType}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(d.writtenPremium)}
                                </TableCell>
                                <TableCell className="text-right font-medium text-green-600">
                                  {formatPercent(d.expectedVcRate)}
                                </TableCell>
                                <TableCell className="text-right font-bold text-destructive">
                                  {formatCurrency(d.missingVcDollars)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {potentialUnderpayments.length > 20 && (
                        <div className="mt-4 text-center">
                          <Button
                            variant="ghost"
                            onClick={() => setShowAllUnderpayments(!showAllUnderpayments)}
                          >
                            {showAllUnderpayments ? (
                              <>
                                <ChevronUp className="h-4 w-4 mr-2" />
                                Show Less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4 mr-2" />
                                Show All {potentialUnderpayments.length} Transactions
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="excluded">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">
                    ✓ Legitimately Excluded from VC
                  </CardTitle>
                  {excludedTransactions.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportToCSV(excludedTransactions, 'excluded-transactions.csv')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {excludedTransactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No excluded transactions to display.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(excludedByReason)
                        .sort((a, b) => b[1].length - a[1].length)
                        .map(([reason, transactions]) => (
                          <div key={reason} className="border rounded-lg">
                            <button
                              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                              onClick={() => setExpandedSection(
                                expandedSection === reason ? null : reason
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <CheckCircle className="h-5 w-5 text-green-500" />
                                <div className="text-left">
                                  <p className="font-medium">
                                    {EXCLUSION_LABELS[reason as ExclusionReason]}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {EXCLUSION_DESCRIPTIONS[reason as ExclusionReason]}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{transactions.length} transactions</Badge>
                                {expandedSection === reason ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </div>
                            </button>

                            {expandedSection === reason && (
                              <div className="border-t p-4">
                                <div className="rounded-md border overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Policy</TableHead>
                                        <TableHead>Product</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="text-right">Premium</TableHead>
                                        <TableHead className="text-right">Expected Rate</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {transactions.slice(0, 10).map((d, i) => (
                                        <TableRow key={`${d.policyNumber}-${i}`}>
                                          <TableCell className="font-mono text-xs">
                                            {d.policyNumber}
                                          </TableCell>
                                          <TableCell>{d.productCategory}</TableCell>
                                          <TableCell>{d.businessType}</TableCell>
                                          <TableCell className="text-right">
                                            {formatCurrency(d.writtenPremium)}
                                          </TableCell>
                                          <TableCell className="text-right text-muted-foreground">
                                            {formatPercent(d.expectedVcRate)} → 0%
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                                {transactions.length > 10 && (
                                  <p className="text-sm text-muted-foreground mt-3 text-center">
                                    ... and {transactions.length - 10} more
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ========== BY LOCATION TAB ========== */}
        <TabsContent value="by-location">
          <ByLocationTab
            currentTransactions={currentTransactions}
            priorTransactions={priorTransactions}
            agentNumbers={effectiveAgentNumbers}
            statementPeriod={currentPeriod || 'Current Period'}
            priorPeriod={priorPeriod}
            potentialUnderpayments={potentialUnderpayments}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default DiscrepancyResults;
