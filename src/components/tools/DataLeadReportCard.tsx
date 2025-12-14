import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  BarChart3,
  FileText,
  CheckCircle,
  AlertTriangle,
  X,
  Copy,
  Loader2,
  ImageIcon,
  FileDown,
  Lightbulb,
} from 'lucide-react';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { MarketingInputs, MarketingDerived } from '@/utils/marketingCalculator';
import { SaveDataLeadReportButton } from '@/components/SaveDataLeadReportButton';

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

interface DataLeadReportCardProps {
  inputs: MarketingInputs;
  derived: MarketingDerived;
  onClose?: () => void;
  isReadOnly?: boolean;
}

export const DataLeadReportCard = ({ inputs, derived, onClose, isReadOnly }: DataLeadReportCardProps) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Calculate ROI
  const roi = derived.totalComp && inputs.spend
    ? ((derived.totalComp - inputs.spend) / inputs.spend) * 100
    : null;

  const profit = derived.totalComp && inputs.spend
    ? derived.totalComp - inputs.spend
    : null;

  // Determine overall verdict
  const getVerdict = () => {
    if (roi === null) return { label: 'INCOMPLETE DATA', color: 'gray' as const, icon: AlertTriangle };
    if (roi >= 10) return { label: 'PROFITABLE', color: 'green' as const, icon: TrendingUp };
    if (roi >= 0) return { label: 'MARGINAL', color: 'yellow' as const, icon: AlertTriangle };
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

  // Color helpers
  const getCloseRateColorHex = (rate: number): string => {
    if (rate >= 20) return COLORS.green;
    if (rate >= 10) return COLORS.yellow;
    return COLORS.red;
  };

  const getCostColorHex = (cost: number | null, threshold: number): string => {
    if (!cost) return COLORS.textMuted;
    if (cost <= threshold) return COLORS.green;
    if (cost <= threshold * 1.5) return COLORS.yellow;
    return COLORS.red;
  };

  const getProgressBarColor = (rate: number): string => {
    if (rate >= 20) return COLORS.green;
    if (rate >= 10) return COLORS.yellow;
    return COLORS.red;
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '--';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '--';
    return `${value.toFixed(1)}%`;
  };

  const getFileName = (extension: string) => {
    const sourceName = inputs.leadSource?.replace(/[^a-zA-Z0-9]/g, '_') || 'DataLead';
    const date = new Date().toISOString().split('T')[0];
    return `AgencyBrain_Data_Lead_${sourceName}_${date}.${extension}`;
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
      `DATA LEAD PERFORMANCE REPORT`,
      `============================`,
      `Lead Source: ${inputs.leadSource || 'Unknown'}`,
      `Generated: ${new Date().toLocaleDateString()}`,
      ``,
      `ROI: ${roi !== null ? `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%` : '--'}`,
      `Net Profit/Loss: ${formatCurrency(profit)}`,
      `Verdict: ${verdict.label}`,
      ``,
      `INVESTMENT`,
      `Ad Spend: ${formatCurrency(inputs.spend)}`,
      `Cost per Lead: ${formatCurrency(inputs.cpl)}`,
      `Projected Commission: ${formatCurrency(derived.totalComp)}`,
      ``,
      `LEAD FUNNEL`,
      `Total Leads: ${derived.totalLeads}`,
      `Quoted HH: ${derived.quotedHH}`,
      `Closed HH: ${derived.closedHH}`,
      `Sold Items: ${derived.soldItems}`,
      ``,
      `COST ANALYSIS`,
      `Cost per Lead: ${formatCurrency(inputs.cpl)}`,
      `Cost per Quoted HH: ${formatCurrency(derived.costPerQuotedHH)}`,
      `Cost per Closed HH: ${derived.closedHH > 0 ? formatCurrency(inputs.spend / derived.closedHH) : '--'}`,
      `Cost per Item Sold: ${derived.soldItems > 0 ? formatCurrency(inputs.spend / derived.soldItems) : '--'}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('Report copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const VerdictIcon = verdict.icon;
  const costPerClosedHH = derived.closedHH > 0 ? inputs.spend / derived.closedHH : null;
  const costPerItem = derived.soldItems > 0 ? inputs.spend / derived.soldItems : null;

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
        {!isReadOnly && onClose && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-4 right-4"
            onClick={onClose}
            style={{ color: COLORS.textSecondary }}
          >
            <X className="h-5 w-5" />
          </Button>
        )}

        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p style={{ color: COLORS.primary }} className="text-sm font-medium uppercase tracking-wider">
              Data Lead Performance Report
            </p>
            <h2 style={{ color: COLORS.textPrimary }} className="text-3xl font-bold mt-1">
              {inputs.leadSource || 'Unknown Source'}
            </h2>
            <p style={{ color: COLORS.textSecondary }} className="mt-1">
              Generated on {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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

        {/* ROI Hero Numbers */}
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
            {formatCurrency(inputs.spend)}
          </p>
          <p style={{ color: COLORS.textSecondary }} className="text-sm mt-1">Total ad spend</p>
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
            {formatCurrency(derived.totalComp)}
          </p>
          <p style={{ color: COLORS.textSecondary }} className="text-sm mt-1">
            {inputs.commissionPct}% of {formatCurrency(derived.soldPremium)} premium
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
            style={{ color: getCloseRateColorHex(inputs.closeRatePct) }}
            className="text-2xl font-bold"
          >
            {formatPercent(inputs.closeRatePct)}
          </p>
          <div 
            style={{ backgroundColor: COLORS.bgCardAlt }}
            className="mt-2 h-2 rounded-full overflow-hidden"
          >
            <div 
              style={{ 
                backgroundColor: getProgressBarColor(inputs.closeRatePct),
                width: `${Math.min(inputs.closeRatePct, 100)}%`
              }}
              className="h-full rounded-full transition-all"
            />
          </div>
        </div>
      </div>

      {/* Lead Funnel */}
      <div 
        style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.borderColor }}
        className="p-4 rounded-lg border"
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4" style={{ color: COLORS.textPrimary }} />
          <span style={{ color: COLORS.textPrimary }} className="text-sm font-semibold">LEAD FUNNEL</span>
        </div>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[
            { value: derived.totalLeads, label: 'Total Leads' },
            { value: derived.quotedHH, label: 'Households Quoted' },
            { value: derived.closedHH, label: 'Households Closed' },
            { value: derived.soldItems, label: 'Items Sold' },
          ].map((item, i) => (
            <div 
              key={i}
              style={{ backgroundColor: COLORS.bgCardAlt }}
              className="text-center p-4 rounded-lg"
            >
              <p style={{ color: COLORS.textPrimary }} className="text-3xl font-bold">
                {item.value || 0}
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
            { value: inputs.cpl, label: 'Cost per Lead', threshold: 20 },
            { value: derived.costPerQuotedHH, label: 'Cost per Quoted HH', threshold: 150 },
            { value: costPerClosedHH, label: 'Cost per Closed HH', threshold: 400 },
            { value: costPerItem, label: 'Cost per Item Sold', threshold: 300 },
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
            <p style={{ color: COLORS.textSecondary }} className="text-sm">Average Item Value</p>
            <p style={{ color: COLORS.blue }} className="text-xl font-bold">
              {formatCurrency(inputs.avgItemValue)}
            </p>
          </div>
          <div style={{ backgroundColor: COLORS.bgCardAlt }} className="p-4 rounded-lg">
            <p style={{ color: COLORS.textSecondary }} className="text-sm">Items per Household</p>
            <p style={{ color: COLORS.blue }} className="text-xl font-bold">
              {inputs.avgItemsPerHH?.toFixed(1) || '--'}
            </p>
          </div>
          <div style={{ backgroundColor: COLORS.bgCardAlt }} className="p-4 rounded-lg">
            <p style={{ color: COLORS.textSecondary }} className="text-sm">Total Premium Sold</p>
            <p style={{ color: COLORS.green }} className="text-xl font-bold">
              {formatCurrency(derived.soldPremium)}
            </p>
          </div>
        </div>
      </div>

      {/* Recommendation */}
      <div 
        style={{ 
          backgroundColor: verdictColors.bg, 
          borderColor: verdictColors.border 
        }}
        className="p-4 rounded-lg border"
      >
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 mt-0.5" style={{ color: verdictColors.text }} />
          <div>
            <p style={{ color: verdictColors.text }} className="font-semibold">Recommendation</p>
            <p style={{ color: COLORS.textSecondary }} className="mt-1">
              {verdict.color === 'green' && (
                `${inputs.leadSource || 'This source'} is performing well. Consider scaling spend while monitoring cost per lead.`
              )}
              {verdict.color === 'yellow' && (
                `${inputs.leadSource || 'This source'} is breaking even. Look for ways to improve quote or close rates.`
              )}
              {verdict.color === 'red' && (
                `${inputs.leadSource || 'This source'} is not profitable. Reduce spend or negotiate better CPL rates.`
              )}
              {verdict.color === 'gray' && (
                `Add more data to see recommendations for ${inputs.leadSource || 'this source'}.`
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <p style={{ color: COLORS.textMuted }} className="text-xs">
          Generated by AgencyBrain
        </p>
        <p style={{ color: COLORS.textMuted }} className="text-xs">
          {new Date().toLocaleString()}
        </p>
      </div>
    </div>

    {/* Action Buttons - Outside the ref so they don't appear in exports */}
    {!isReadOnly && (
      <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
        <Button 
          variant="outline" 
          onClick={handleExportPNG}
          disabled={isExporting}
        >
          {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImageIcon className="h-4 w-4 mr-2" />}
          Export PNG
        </Button>
        <Button 
          variant="outline" 
          onClick={handleExportPDF}
          disabled={isExporting}
        >
          {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
          Export PDF
        </Button>
        <Button 
          variant="outline" 
          onClick={handleCopy}
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy Results
        </Button>
        <SaveDataLeadReportButton inputs={inputs} derived={derived} />
      </div>
    )}
    </>
  );
};

export default DataLeadReportCard;
