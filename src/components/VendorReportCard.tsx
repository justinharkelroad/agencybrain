import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  Users,
  FileText,
  CheckCircle,
  AlertTriangle,
  X,
  Download,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { VendorVerifierFormInputs, VendorVerifierDerived } from '@/utils/vendorVerifier';

interface VendorReportCardProps {
  inputs: VendorVerifierFormInputs;
  derived: VendorVerifierDerived;
  onClose: () => void;
  onSave?: () => void;
}

const VendorReportCard = ({ inputs, derived, onClose, onSave }: VendorReportCardProps) => {
  // Calculate ROI
  const roi = derived.projectedCommissionAmount && inputs.amountSpent
    ? ((derived.projectedCommissionAmount - inputs.amountSpent) / inputs.amountSpent) * 100
    : null;

  const profit = derived.projectedCommissionAmount && inputs.amountSpent
    ? derived.projectedCommissionAmount - inputs.amountSpent
    : null;

  // Determine overall verdict
  const getVerdict = () => {
    if (roi === null) return { label: 'INCOMPLETE DATA', color: 'gray', icon: AlertTriangle };
    if (roi >= 50) return { label: 'HIGHLY PROFITABLE', color: 'green', icon: TrendingUp };
    if (roi >= 0) return { label: 'PROFITABLE', color: 'green', icon: CheckCircle };
    if (roi >= -25) return { label: 'MARGINAL', color: 'yellow', icon: AlertTriangle };
    return { label: 'LOSING MONEY', color: 'red', icon: TrendingDown };
  };

  const verdict = getVerdict();

  // Color helpers
  const getCloseRateColor = (rate: number | null | undefined) => {
    if (!rate) return 'text-muted-foreground';
    if (rate >= 0.30) return 'text-green-500';
    if (rate >= 0.20) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getCostColor = (cost: number | null | undefined, threshold: number) => {
    if (!cost) return 'text-muted-foreground';
    if (cost <= threshold) return 'text-green-500';
    if (cost <= threshold * 1.5) return 'text-yellow-500';
    return 'text-red-500';
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '--';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '--';
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleCopy = async () => {
    const lines = [
      `VENDOR PERFORMANCE REPORT`,
      `========================`,
      `Vendor: ${inputs.vendorName || 'Unknown'}`,
      `Period: ${formatDate(inputs.dateStart)} → ${formatDate(inputs.dateEnd)}`,
      ``,
      `ROI: ${roi !== null ? `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%` : '--'}`,
      `Net Profit/Loss: ${formatCurrency(profit)}`,
      `Verdict: ${verdict.label}`,
      ``,
      `INVESTMENT`,
      `Amount Spent: ${formatCurrency(inputs.amountSpent)}`,
      `Projected Commission: ${formatCurrency(derived.projectedCommissionAmount)}`,
      ``,
      `ACTIVITY`,
      `Inbound Calls: ${inputs.inboundCalls || '--'}`,
      `Quoted HH: ${inputs.quotedHH || '--'}`,
      `Closed HH: ${inputs.closedHH || '--'}`,
      `Policies Sold: ${inputs.policiesSold || '--'}`,
      ``,
      `COST ANALYSIS`,
      `Cost per Call: ${formatCurrency(derived.avgCostPerCall)}`,
      `Cost per Quoted HH: ${formatCurrency(derived.costPerQuotedHH)}`,
      `Cost per Sold Policy: ${formatCurrency(derived.costPerSoldPolicy)}`,
      `CPA: ${formatCurrency(derived.cpa)}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('Report copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="relative p-6 rounded-xl bg-gradient-to-r from-card to-card/80 border border-border">
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-4 right-4"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-primary font-medium uppercase tracking-wider">Vendor Performance Report</p>
            <h2 className="text-3xl font-bold mt-1">{inputs.vendorName || 'Unknown Vendor'}</h2>
            <p className="text-muted-foreground mt-1">
              {formatDate(inputs.dateStart)} → {formatDate(inputs.dateEnd)}
            </p>
          </div>
          
          <Badge 
            className={`text-lg px-4 py-2 ${
              verdict.color === 'green' ? 'bg-green-500/20 text-green-500 border-green-500/30' :
              verdict.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' :
              verdict.color === 'red' ? 'bg-red-500/20 text-red-500 border-red-500/30' :
              'bg-muted text-muted-foreground border-border'
            }`}
          >
            <verdict.icon className="h-5 w-5 mr-2" />
            {verdict.label}
          </Badge>
        </div>

        {/* ROI Hero Number */}
        {roi !== null && (
          <div className="mt-6 flex items-center gap-8 flex-wrap">
            <div>
              <p className="text-sm text-muted-foreground">Return on Investment</p>
              <p className={`text-5xl font-bold ${roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
              </p>
            </div>
            <div className="h-16 w-px bg-border hidden sm:block" />
            <div>
              <p className="text-sm text-muted-foreground">Net Profit/Loss</p>
              <p className={`text-3xl font-bold ${profit && profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatCurrency(profit)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Investment Card */}
        <Card className="bg-card/50 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              INVESTMENT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(inputs.amountSpent)}</p>
            <p className="text-sm text-muted-foreground mt-1">Total spend this period</p>
          </CardContent>
        </Card>

        {/* Commission Card */}
        <Card className="bg-card/50 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              PROJECTED COMMISSION
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">
              {formatCurrency(derived.projectedCommissionAmount)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {inputs.commissionPct || 0}% of {formatCurrency(inputs.premiumSold)} premium
            </p>
          </CardContent>
        </Card>

        {/* Close Rate Card */}
        <Card className="bg-card/50 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Target className="h-4 w-4" />
              CLOSE RATE
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${getCloseRateColor(derived.policyCloseRate)}`}>
              {formatPercent(derived.policyCloseRate)}
            </p>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${
                  (derived.policyCloseRate || 0) >= 0.30 ? 'bg-green-500' :
                  (derived.policyCloseRate || 0) >= 0.20 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min((derived.policyCloseRate || 0) * 100, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Stats */}
      <Card className="bg-card/50 border-border">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            ACTIVITY BREAKDOWN
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold">{inputs.inboundCalls || '--'}</p>
              <p className="text-sm text-muted-foreground">Inbound Calls</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold">{inputs.quotedHH || '--'}</p>
              <p className="text-sm text-muted-foreground">Households Quoted</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold">{inputs.closedHH || '--'}</p>
              <p className="text-sm text-muted-foreground">Households Closed</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold">{inputs.policiesSold || '--'}</p>
              <p className="text-sm text-muted-foreground">Policies Sold</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost Analysis */}
      <Card className="bg-card/50 border-border">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            COST ANALYSIS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Cost per Call</p>
              <p className={`text-xl font-bold ${getCostColor(derived.avgCostPerCall, 100)}`}>
                {formatCurrency(derived.avgCostPerCall)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Cost per Quoted HH</p>
              <p className={`text-xl font-bold ${getCostColor(derived.costPerQuotedHH, 150)}`}>
                {formatCurrency(derived.costPerQuotedHH)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Cost per Sold Policy</p>
              <p className={`text-xl font-bold ${getCostColor(derived.costPerSoldPolicy, 300)}`}>
                {formatCurrency(derived.costPerSoldPolicy)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">CPA (Acquisition)</p>
              <p className={`text-xl font-bold ${getCostColor(derived.cpa, 400)}`}>
                {formatCurrency(derived.cpa)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Value Metrics */}
      <Card className="bg-card/50 border-border">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            VALUE METRICS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Average Policy Value</p>
              <p className="text-xl font-bold text-blue-500">
                {formatCurrency(derived.averagePolicyValue)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Average Item Value</p>
              <p className="text-xl font-bold text-blue-500">
                {formatCurrency(derived.averageItemValue)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Total Premium Sold</p>
              <p className="text-xl font-bold text-green-500">
                {formatCurrency(inputs.premiumSold)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendation Box */}
      <Card className={`border-2 ${
        verdict.color === 'green' ? 'bg-green-500/10 border-green-500/30' :
        verdict.color === 'yellow' ? 'bg-yellow-500/10 border-yellow-500/30' :
        verdict.color === 'red' ? 'bg-red-500/10 border-red-500/30' :
        'bg-card border-border'
      }`}>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full ${
              verdict.color === 'green' ? 'bg-green-500/20' :
              verdict.color === 'yellow' ? 'bg-yellow-500/20' :
              verdict.color === 'red' ? 'bg-red-500/20' :
              'bg-muted'
            }`}>
              <verdict.icon className={`h-6 w-6 ${
                verdict.color === 'green' ? 'text-green-500' :
                verdict.color === 'yellow' ? 'text-yellow-500' :
                verdict.color === 'red' ? 'text-red-500' :
                'text-muted-foreground'
              }`} />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Recommendation</h3>
              <p className="text-muted-foreground mt-1">
                {verdict.color === 'green' && roi !== null && roi >= 50 && (
                  `Excellent performance! ${inputs.vendorName} is generating strong returns. Consider increasing spend to scale results.`
                )}
                {verdict.color === 'green' && roi !== null && roi < 50 && (
                  `${inputs.vendorName} is profitable. Monitor close rates and continue optimizing to improve ROI further.`
                )}
                {verdict.color === 'yellow' && (
                  `${inputs.vendorName} is borderline. Review your follow-up process and quoting efficiency to improve conversion.`
                )}
                {verdict.color === 'red' && (
                  `${inputs.vendorName} is not generating positive returns. Consider pausing spend and analyzing what's not working.`
                )}
                {verdict.color === 'gray' && (
                  `Add more data to get a complete analysis. Ensure you've entered premium sold and commission percentage.`
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end flex-wrap">
        <Button variant="outline" onClick={handleCopy}>
          <Copy className="h-4 w-4 mr-2" />
          Copy Results
        </Button>
        {onSave && (
          <Button variant="outline" onClick={onSave}>
            <Download className="h-4 w-4 mr-2" />
            Save to Reports
          </Button>
        )}
      </div>
    </div>
  );
};

export default VendorReportCard;
