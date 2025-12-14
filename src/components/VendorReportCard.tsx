import { useRef, useState } from 'react';
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
  Copy,
  Loader2,
  ImageIcon,
  FileDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { VendorVerifierFormInputs, VendorVerifierDerived } from '@/utils/vendorVerifier';
import SaveVendorReportButton from '@/components/SaveVendorReportButton';

// Explicit hex colors for export compatibility
const COLORS = {
  bgPrimary: '#0f172a',
  bgCard: '#1e293b',
  bgCardAlt: '#334155',
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  green: '#22c55e',
  greenBg: 'rgba(34, 197, 94, 0.2)',
  greenBorder: 'rgba(34, 197, 94, 0.3)',
  yellow: '#eab308',
  yellowBg: 'rgba(234, 179, 8, 0.2)',
  yellowBorder: 'rgba(234, 179, 8, 0.3)',
  red: '#ef4444',
  redBg: 'rgba(239, 68, 68, 0.2)',
  redBorder: 'rgba(239, 68, 68, 0.3)',
  blue: '#3b82f6',
  borderColor: '#334155',
  primary: '#3b82f6',
};

interface VendorReportCardProps {
  inputs: VendorVerifierFormInputs;
  derived: VendorVerifierDerived;
  onClose: () => void;
  onSave?: () => void;
}

const VendorReportCard = ({ inputs, derived, onClose, onSave }: VendorReportCardProps) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Calculate ROI
  const roi = derived.projectedCommissionAmount && inputs.amountSpent
    ? ((derived.projectedCommissionAmount - inputs.amountSpent) / inputs.amountSpent) * 100
    : null;

  const profit = derived.projectedCommissionAmount && inputs.amountSpent
    ? derived.projectedCommissionAmount - inputs.amountSpent
    : null;

  // Determine overall verdict
  const getVerdict = () => {
    if (roi === null) return { label: 'INCOMPLETE DATA', color: 'gray' as const, icon: AlertTriangle };
    if (roi >= 50) return { label: 'HIGHLY PROFITABLE', color: 'green' as const, icon: TrendingUp };
    if (roi >= 0) return { label: 'PROFITABLE', color: 'green' as const, icon: CheckCircle };
    if (roi >= -25) return { label: 'MARGINAL', color: 'yellow' as const, icon: AlertTriangle };
    return { label: 'LOSING MONEY', color: 'red' as const, icon: TrendingDown };
  };

  const verdict = getVerdict();

  // Get hex colors based on verdict
  const getVerdictColors = () => {
    switch (verdict.color) {
      case 'green':
        return { bg: COLORS.greenBg, text: COLORS.green, border: COLORS.greenBorder };
      case 'yellow':
        return { bg: COLORS.yellowBg, text: COLORS.yellow, border: COLORS.yellowBorder };
      case 'red':
        return { bg: COLORS.redBg, text: COLORS.red, border: COLORS.redBorder };
      default:
        return { bg: COLORS.bgCardAlt, text: COLORS.textMuted, border: COLORS.borderColor };
    }
  };

  const verdictColors = getVerdictColors();

  // Color helpers returning hex values
  const getCloseRateColorHex = (rate: number | null | undefined): string => {
    if (!rate) return COLORS.textMuted;
    if (rate >= 0.30) return COLORS.green;
    if (rate >= 0.20) return COLORS.yellow;
    return COLORS.red;
  };

  const getCostColorHex = (cost: number | null | undefined, threshold: number): string => {
    if (!cost) return COLORS.textMuted;
    if (cost <= threshold) return COLORS.green;
    if (cost <= threshold * 1.5) return COLORS.yellow;
    return COLORS.red;
  };

  const getProgressBarColor = (rate: number | null | undefined): string => {
    if (!rate) return COLORS.red;
    if (rate >= 0.30) return COLORS.green;
    if (rate >= 0.20) return COLORS.yellow;
    return COLORS.red;
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

  const getFileName = (extension: string) => {
    const vendorName = inputs.vendorName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Unknown';
    const date = new Date().toISOString().split('T')[0];
    return `AgencyBrain_Vendor_Verifier_${vendorName}_${date}.${extension}`;
  };

  const handleExportPNG = async () => {
    if (!reportRef.current) return;
    
    setIsExporting(true);
    try {
      const dataUrl = await toPng(reportRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: COLORS.bgPrimary,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        },
      });
      
      const link = document.createElement('a');
      link.download = getFileName('png');
      link.href = dataUrl;
      link.click();
      
      toast.success('Report exported as PNG');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    
    setIsExporting(true);
    try {
      const dataUrl = await toPng(reportRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: COLORS.bgPrimary,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        },
      });
      
      // Create image to get dimensions
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => { img.onload = resolve; });
      
      const imgWidth = img.width;
      const imgHeight = img.height;
      
      const pdfWidth = 210;
      const pdfHeight = (imgHeight * pdfWidth) / imgWidth;
      
      const pdf = new jsPDF({
        orientation: pdfHeight > pdfWidth ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [pdfWidth, pdfHeight],
      });
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(getFileName('pdf'));
      
      toast.success('Report exported as PDF');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export report');
    } finally {
      setIsExporting(false);
    }
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

  const VerdictIcon = verdict.icon;

  return (
    <>
    <div 
      ref={reportRef} 
      style={{ backgroundColor: COLORS.bgPrimary, color: COLORS.textPrimary }}
      className="mt-8 p-6 rounded-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
    >
      {/* Header */}
      <div 
        style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.borderColor }}
        className="relative p-6 rounded-xl border"
      >
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-4 right-4"
          onClick={onClose}
          style={{ color: COLORS.textSecondary }}
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p style={{ color: COLORS.primary }} className="text-sm font-medium uppercase tracking-wider">
              Vendor Performance Report
            </p>
            <h2 style={{ color: COLORS.textPrimary }} className="text-3xl font-bold mt-1">
              {inputs.vendorName || 'Unknown Vendor'}
            </h2>
            <p style={{ color: COLORS.textSecondary }} className="mt-1">
              {formatDate(inputs.dateStart)} → {formatDate(inputs.dateEnd)}
            </p>
          </div>
          
          <div 
            style={{ 
              backgroundColor: verdictColors.bg, 
              color: verdictColors.text, 
              borderColor: verdictColors.border 
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-full border text-lg font-semibold"
          >
            <VerdictIcon className="h-5 w-5" style={{ color: verdictColors.text }} />
            {verdict.label}
          </div>
        </div>

        {/* ROI Hero Number */}
        {roi !== null && (
          <div className="mt-6 flex items-center gap-8 flex-wrap">
            <div>
              <p style={{ color: COLORS.textSecondary }} className="text-sm">Return on Investment</p>
              <p 
                style={{ color: roi >= 0 ? COLORS.green : COLORS.red }}
                className="text-5xl font-bold"
              >
                {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
              </p>
            </div>
            <div style={{ backgroundColor: COLORS.borderColor }} className="h-16 w-px hidden sm:block" />
            <div>
              <p style={{ color: COLORS.textSecondary }} className="text-sm">Net Profit/Loss</p>
              <p 
                style={{ color: profit && profit >= 0 ? COLORS.green : COLORS.red }}
                className="text-3xl font-bold"
              >
                {formatCurrency(profit)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Investment Card */}
        <div 
          style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.borderColor }}
          className="p-4 rounded-lg border"
        >
          <div className="flex items-center gap-2 pb-2">
            <DollarSign className="h-4 w-4" style={{ color: COLORS.textSecondary }} />
            <span style={{ color: COLORS.textSecondary }} className="text-sm">INVESTMENT</span>
          </div>
          <p style={{ color: COLORS.textPrimary }} className="text-2xl font-bold">
            {formatCurrency(inputs.amountSpent)}
          </p>
          <p style={{ color: COLORS.textSecondary }} className="text-sm mt-1">Total spend this period</p>
        </div>

        {/* Commission Card */}
        <div 
          style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.borderColor }}
          className="p-4 rounded-lg border"
        >
          <div className="flex items-center gap-2 pb-2">
            <TrendingUp className="h-4 w-4" style={{ color: COLORS.textSecondary }} />
            <span style={{ color: COLORS.textSecondary }} className="text-sm">PROJECTED COMMISSION</span>
          </div>
          <p style={{ color: COLORS.green }} className="text-2xl font-bold">
            {formatCurrency(derived.projectedCommissionAmount)}
          </p>
          <p style={{ color: COLORS.textSecondary }} className="text-sm mt-1">
            {inputs.commissionPct || 0}% of {formatCurrency(inputs.premiumSold)} premium
          </p>
        </div>

        {/* Close Rate Card */}
        <div 
          style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.borderColor }}
          className="p-4 rounded-lg border"
        >
          <div className="flex items-center gap-2 pb-2">
            <Target className="h-4 w-4" style={{ color: COLORS.textSecondary }} />
            <span style={{ color: COLORS.textSecondary }} className="text-sm">CLOSE RATE</span>
          </div>
          <p 
            style={{ color: getCloseRateColorHex(derived.policyCloseRate) }}
            className="text-2xl font-bold"
          >
            {formatPercent(derived.policyCloseRate)}
          </p>
          <div 
            style={{ backgroundColor: COLORS.bgCardAlt }}
            className="mt-2 h-2 rounded-full overflow-hidden"
          >
            <div 
              style={{ 
                backgroundColor: getProgressBarColor(derived.policyCloseRate),
                width: `${Math.min((derived.policyCloseRate || 0) * 100, 100)}%`
              }}
              className="h-full rounded-full transition-all"
            />
          </div>
        </div>
      </div>

      {/* Activity Stats */}
      <div 
        style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.borderColor }}
        className="p-4 rounded-lg border"
      >
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4" style={{ color: COLORS.textPrimary }} />
          <span style={{ color: COLORS.textPrimary }} className="text-sm font-semibold">ACTIVITY BREAKDOWN</span>
        </div>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[
            { value: inputs.inboundCalls, label: 'Inbound Calls' },
            { value: inputs.quotedHH, label: 'Households Quoted' },
            { value: inputs.closedHH, label: 'Households Closed' },
            { value: inputs.policiesSold, label: 'Policies Sold' },
          ].map((item, i) => (
            <div 
              key={i}
              style={{ backgroundColor: COLORS.bgCardAlt }}
              className="text-center p-4 rounded-lg"
            >
              <p style={{ color: COLORS.textPrimary }} className="text-3xl font-bold">
                {item.value || '--'}
              </p>
              <p style={{ color: COLORS.textSecondary }} className="text-sm">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cost Analysis */}
      <div 
        style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.borderColor }}
        className="p-4 rounded-lg border"
      >
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-4 w-4" style={{ color: COLORS.textPrimary }} />
          <span style={{ color: COLORS.textPrimary }} className="text-sm font-semibold">COST ANALYSIS</span>
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[
            { value: derived.avgCostPerCall, label: 'Cost per Call', threshold: 100 },
            { value: derived.costPerQuotedHH, label: 'Cost per Quoted HH', threshold: 150 },
            { value: derived.costPerSoldPolicy, label: 'Cost per Sold Policy', threshold: 300 },
            { value: derived.cpa, label: 'CPA (Acquisition)', threshold: 400 },
          ].map((item, i) => (
            <div 
              key={i}
              style={{ backgroundColor: COLORS.bgCardAlt }}
              className="p-4 rounded-lg"
            >
              <p style={{ color: COLORS.textSecondary }} className="text-sm">{item.label}</p>
              <p 
                style={{ color: getCostColorHex(item.value, item.threshold) }}
                className="text-xl font-bold"
              >
                {formatCurrency(item.value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Value Metrics */}
      <div 
        style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.borderColor }}
        className="p-4 rounded-lg border"
      >
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-4 w-4" style={{ color: COLORS.textPrimary }} />
          <span style={{ color: COLORS.textPrimary }} className="text-sm font-semibold">VALUE METRICS</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div style={{ backgroundColor: COLORS.bgCardAlt }} className="p-4 rounded-lg">
            <p style={{ color: COLORS.textSecondary }} className="text-sm">Average Policy Value</p>
            <p style={{ color: COLORS.blue }} className="text-xl font-bold">
              {formatCurrency(derived.averagePolicyValue)}
            </p>
          </div>
          <div style={{ backgroundColor: COLORS.bgCardAlt }} className="p-4 rounded-lg">
            <p style={{ color: COLORS.textSecondary }} className="text-sm">Average Item Value</p>
            <p style={{ color: COLORS.blue }} className="text-xl font-bold">
              {formatCurrency(derived.averageItemValue)}
            </p>
          </div>
          <div style={{ backgroundColor: COLORS.bgCardAlt }} className="p-4 rounded-lg">
            <p style={{ color: COLORS.textSecondary }} className="text-sm">Total Premium Sold</p>
            <p style={{ color: COLORS.green }} className="text-xl font-bold">
              {formatCurrency(inputs.premiumSold)}
            </p>
          </div>
        </div>
      </div>

      {/* Recommendation Box */}
      <div 
        style={{ 
          backgroundColor: verdictColors.bg, 
          borderColor: verdictColors.border 
        }}
        className="p-6 rounded-lg border-2"
      >
        <div className="flex items-start gap-4">
          <div 
            style={{ backgroundColor: verdictColors.bg }}
            className="p-3 rounded-full"
          >
            <VerdictIcon className="h-6 w-6" style={{ color: verdictColors.text }} />
          </div>
          <div>
            <h3 style={{ color: COLORS.textPrimary }} className="font-semibold text-lg">Recommendation</h3>
            <p style={{ color: COLORS.textSecondary }} className="mt-1">
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
      </div>

      {/* Branding footer for exports */}
      <div 
        style={{ borderColor: COLORS.borderColor, color: COLORS.textSecondary }}
        className="flex items-center justify-between pt-4 mt-4 border-t text-sm"
      >
        <span>Generated by AgencyBrain</span>
        <span>{new Date().toLocaleDateString()}</span>
      </div>
    </div>

    {/* Action Buttons - OUTSIDE the ref so they don't appear in export */}
    <div className="flex gap-3 justify-end flex-wrap mt-6">
      <Button 
        variant="outline" 
        onClick={handleExportPNG}
        disabled={isExporting}
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <ImageIcon className="h-4 w-4 mr-2" />
        )}
        PNG
      </Button>
      <Button 
        variant="outline" 
        onClick={handleExportPDF}
        disabled={isExporting}
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4 mr-2" />
        )}
        PDF
      </Button>
      <Button variant="outline" onClick={handleCopy}>
        <Copy className="h-4 w-4 mr-2" />
        Copy Results
      </Button>
      <SaveVendorReportButton
        input={{
          vendorName: inputs.vendorName,
          dateStart: inputs.dateStart,
          dateEnd: inputs.dateEnd,
          amountSpent: inputs.amountSpent,
          policiesSold: inputs.policiesSold,
          premiumSold: inputs.premiumSold,
        }}
        derived={{
          cpa: derived.cpa,
          projectedCommissionAmount: derived.projectedCommissionAmount,
          policyCloseRate: derived.policyCloseRate,
        }}
        data={{ inputs, derived }}
      />
    </div>
    </>
  );
};

export default VendorReportCard;
