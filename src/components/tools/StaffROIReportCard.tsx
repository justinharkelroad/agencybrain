import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  CheckCircle,
  AlertTriangle,
  Copy,
  Loader2,
  ImageIcon,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import { StaffROIInputs, StaffROIResults } from '@/utils/staffROICalculator';
import { SaveStaffROIReportButton } from '@/components/SaveStaffROIReportButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface StaffROIReportCardProps {
  inputs: StaffROIInputs;
  results: StaffROIResults;
  onClose: () => void;
  onRenewalPeriodChange: (period: '6months' | 'annual') => void;
}

const StaffROIReportCard = ({ inputs, results, onClose, onRenewalPeriodChange }: StaffROIReportCardProps) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Determine overall verdict
  const getVerdict = () => {
    const yearEndNet = results.annualNetProfitLoss;
    if (yearEndNet >= 5000) return { label: 'PROFITABLE', color: 'green' as const, icon: TrendingUp };
    if (yearEndNet >= 0) return { label: 'BREAK EVEN', color: 'yellow' as const, icon: AlertTriangle };
    return { label: 'LOSING MONEY', color: 'red' as const, icon: TrendingDown };
  };

  const verdict = getVerdict();

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  const getFileName = () => {
    const date = new Date().toISOString().split('T')[0];
    return `AgencyBrain_Staff_ROI_Report_${date}.png`;
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
      link.download = getFileName();
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

  const handleCopy = async () => {
    const lines = [
      `STAFF ROI REPORT`,
      `================`,
      ``,
      `ROI: ${results.roi >= 0 ? '+' : ''}${results.roi.toFixed(1)}%`,
      `Year-to-Date Net: ${formatCurrency(results.annualNetProfitLoss)}`,
      `Verdict: ${verdict.label}`,
      ``,
      `MONTH 1`,
      `Auto Premium: ${formatCurrency(results.month1AutoPremium)} → Revenue: ${formatCurrency(results.month1AutoRevenue)}`,
      `Home Premium: ${formatCurrency(results.month1HomePremium)} → Revenue: ${formatCurrency(results.month1HomeRevenue)}`,
      `Total Revenue: ${formatCurrency(results.month1TotalRevenue)}`,
      ``,
      `EXPENSES`,
      `Base Salary: ${formatCurrency(results.baseSalary)}`,
      `Commission (${inputs.commissionRate}%): ${formatCurrency(results.commissionAmount)}`,
      `Payroll Taxes (${inputs.payrollTaxRate}%): ${formatCurrency(results.payrollTaxAmount)}`,
      inputs.marketingSpend > 0 ? `Marketing Spend: ${formatCurrency(results.marketingSpend)}` : null,
      inputs.benefits > 0 ? `Benefits: ${formatCurrency(results.benefits)}` : null,
      inputs.promoPayOuts > 0 ? `Promo Pay Outs: ${formatCurrency(results.promoPayOuts)}` : null,
      `Total Expenses: ${formatCurrency(results.totalExpenses)}`,
      ``,
      `Month 1 Net: ${formatCurrency(results.month1NetProfitLoss)}`,
      ``,
      inputs.autoRenewalPeriod === '6months' ? `6 MONTH RENEWAL` : null,
      inputs.autoRenewalPeriod === '6months' ? `Auto Renewal Revenue: ${formatCurrency(results.sixMonthAutoRenewalRevenue)}` : null,
      inputs.autoRenewalPeriod === '6months' ? `YTD Net: ${formatCurrency(results.sixMonthNetProfitLoss)}` : null,
      inputs.autoRenewalPeriod === '6months' ? `` : null,
      `ANNUAL RENEWAL`,
      `Auto Renewal Revenue: ${formatCurrency(results.annualAutoRenewalRevenue)}`,
      `Home Renewal Revenue: ${formatCurrency(results.annualHomeRenewalRevenue)}`,
      `Total Renewal Revenue: ${formatCurrency(results.annualTotalRenewalRevenue)}`,
      ``,
      `YEAR-END NET: ${formatCurrency(results.annualNetProfitLoss)}`,
    ].filter(Boolean);
    
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('Report copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const VerdictIcon = verdict.icon;
  const show6Month = inputs.autoRenewalPeriod === '6months';

  return (
    <>
      <div 
        ref={reportRef} 
        style={{ backgroundColor: COLORS.bgPrimary, color: COLORS.textPrimary }}
        className="p-6 rounded-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
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
                Staff ROI Report
              </p>
              <h2 style={{ color: COLORS.textPrimary }} className="text-3xl font-bold mt-1">
                Team Member Projection
              </h2>
              <p style={{ color: COLORS.textSecondary }} className="mt-1">
                Monthly Production Analysis
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
          <div className="mt-6 flex items-center gap-8 flex-wrap">
            <div>
              <p style={{ color: COLORS.textSecondary }} className="text-sm">Return on Investment</p>
              <p 
                style={{ color: results.roi >= 0 ? COLORS.green : COLORS.red }}
                className="text-5xl font-bold"
              >
                {results.roi >= 0 ? '+' : ''}{results.roi.toFixed(1)}%
              </p>
            </div>
            <div style={{ backgroundColor: COLORS.borderColor }} className="h-16 w-px hidden sm:block" />
            <div>
              <p style={{ color: COLORS.textSecondary }} className="text-sm">Year-to-Date Net Profit/Loss</p>
              <p 
                style={{ color: results.annualNetProfitLoss >= 0 ? COLORS.green : COLORS.red }}
                className="text-3xl font-bold"
              >
                {formatCurrency(results.annualNetProfitLoss)}
              </p>
            </div>
          </div>
        </div>

        {/* Period Toggle */}
        <div className="flex items-center gap-4">
          <span style={{ color: COLORS.textSecondary }} className="text-sm">Auto Renewal Period:</span>
          <Select 
            value={inputs.autoRenewalPeriod} 
            onValueChange={(v) => onRenewalPeriodChange(v as '6months' | 'annual')}
          >
            <SelectTrigger 
              className="w-40" 
              style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.borderColor, color: COLORS.textPrimary }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="annual">Annual</SelectItem>
              <SelectItem value="6months">6 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results Table */}
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: COLORS.bgCardAlt }}>
                <th style={{ color: COLORS.textSecondary, padding: '12px', textAlign: 'left', borderColor: COLORS.borderColor }} className="border-b">
                  Category
                </th>
                <th style={{ color: COLORS.textSecondary, padding: '12px', textAlign: 'right', borderColor: COLORS.borderColor }} className="border-b">
                  Month 1
                </th>
                {show6Month && (
                  <th style={{ color: COLORS.textSecondary, padding: '12px', textAlign: 'right', borderColor: COLORS.borderColor }} className="border-b">
                    6 Month Renewal
                  </th>
                )}
                <th style={{ color: COLORS.textSecondary, padding: '12px', textAlign: 'right', borderColor: COLORS.borderColor }} className="border-b">
                  Annual Renewal
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Premium Section */}
              <tr style={{ backgroundColor: COLORS.bgCard }}>
                <td style={{ color: COLORS.textPrimary, padding: '12px', fontWeight: 600 }} colSpan={show6Month ? 4 : 3}>
                  Premium Written
                </td>
              </tr>
              <tr>
                <td style={{ color: COLORS.textSecondary, padding: '12px 12px 12px 24px' }}>Auto Premium</td>
                <td style={{ color: COLORS.textPrimary, padding: '12px', textAlign: 'right' }}>{formatCurrency(results.month1AutoPremium)}</td>
                {show6Month && <td style={{ color: COLORS.textSecondary, padding: '12px', textAlign: 'right' }}>—</td>}
                <td style={{ color: COLORS.textSecondary, padding: '12px', textAlign: 'right' }}>—</td>
              </tr>
              <tr>
                <td style={{ color: COLORS.textSecondary, padding: '12px 12px 12px 24px' }}>Home Premium</td>
                <td style={{ color: COLORS.textPrimary, padding: '12px', textAlign: 'right' }}>{formatCurrency(results.month1HomePremium)}</td>
                {show6Month && <td style={{ color: COLORS.textSecondary, padding: '12px', textAlign: 'right' }}>—</td>}
                <td style={{ color: COLORS.textSecondary, padding: '12px', textAlign: 'right' }}>—</td>
              </tr>
              <tr style={{ backgroundColor: COLORS.bgCardAlt }}>
                <td style={{ color: COLORS.textPrimary, padding: '12px 12px 12px 24px', fontWeight: 500 }}>Total Premium</td>
                <td style={{ color: COLORS.textPrimary, padding: '12px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(results.month1TotalPremium)}</td>
                {show6Month && <td style={{ padding: '12px' }}></td>}
                <td style={{ padding: '12px' }}></td>
              </tr>

              {/* Revenue Section */}
              <tr style={{ backgroundColor: COLORS.bgCard }}>
                <td style={{ color: COLORS.textPrimary, padding: '12px', fontWeight: 600 }} colSpan={show6Month ? 4 : 3}>
                  Agency Revenue
                </td>
              </tr>
              <tr>
                <td style={{ color: COLORS.textSecondary, padding: '12px 12px 12px 24px' }}>Auto ({inputs.autoCommissionRate}% new / {inputs.autoRenewalRate}% renewal)</td>
                <td style={{ color: COLORS.green, padding: '12px', textAlign: 'right' }}>{formatCurrency(results.month1AutoRevenue)}</td>
                {show6Month && <td style={{ color: COLORS.green, padding: '12px', textAlign: 'right' }}>{formatCurrency(results.sixMonthAutoRenewalRevenue)}</td>}
                <td style={{ color: COLORS.green, padding: '12px', textAlign: 'right' }}>{formatCurrency(results.annualAutoRenewalRevenue)}</td>
              </tr>
              <tr>
                <td style={{ color: COLORS.textSecondary, padding: '12px 12px 12px 24px' }}>Home ({inputs.homeCommissionRate}% new / {inputs.homeRenewalRate}% renewal)</td>
                <td style={{ color: COLORS.green, padding: '12px', textAlign: 'right' }}>{formatCurrency(results.month1HomeRevenue)}</td>
                {show6Month && <td style={{ color: COLORS.textSecondary, padding: '12px', textAlign: 'right' }}>—</td>}
                <td style={{ color: COLORS.green, padding: '12px', textAlign: 'right' }}>{formatCurrency(results.annualHomeRenewalRevenue)}</td>
              </tr>
              <tr style={{ backgroundColor: COLORS.bgCardAlt }}>
                <td style={{ color: COLORS.textPrimary, padding: '12px 12px 12px 24px', fontWeight: 500 }}>Total Revenue</td>
                <td style={{ color: COLORS.green, padding: '12px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(results.month1TotalRevenue)}</td>
                {show6Month && <td style={{ color: COLORS.green, padding: '12px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(results.sixMonthAutoRenewalRevenue)}</td>}
                <td style={{ color: COLORS.green, padding: '12px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(results.annualTotalRenewalRevenue)}</td>
              </tr>

              {/* Expenses Section */}
              <tr style={{ backgroundColor: COLORS.bgCard }}>
                <td style={{ color: COLORS.textPrimary, padding: '12px', fontWeight: 600 }} colSpan={show6Month ? 4 : 3}>
                  Expenses
                </td>
              </tr>
              <tr>
                <td style={{ color: COLORS.textSecondary, padding: '12px 12px 12px 24px' }}>Base Salary</td>
                <td style={{ color: COLORS.red, padding: '12px', textAlign: 'right' }}>{formatCurrency(results.baseSalary)}</td>
                {show6Month && <td style={{ color: COLORS.textSecondary, padding: '12px', textAlign: 'right' }}>—</td>}
                <td style={{ color: COLORS.textSecondary, padding: '12px', textAlign: 'right' }}>—</td>
              </tr>
              <tr>
                <td style={{ color: COLORS.textSecondary, padding: '12px 12px 12px 24px' }}>Commission ({inputs.commissionRate}% of premium)</td>
                <td style={{ color: COLORS.red, padding: '12px', textAlign: 'right' }}>{formatCurrency(results.commissionAmount)}</td>
                {show6Month && <td style={{ color: COLORS.textSecondary, padding: '12px', textAlign: 'right' }}>—</td>}
                <td style={{ color: COLORS.textSecondary, padding: '12px', textAlign: 'right' }}>—</td>
              </tr>
              <tr>
                <td style={{ color: COLORS.textSecondary, padding: '12px 12px 12px 24px' }}>Payroll Taxes ({inputs.payrollTaxRate}%)</td>
                <td style={{ color: COLORS.red, padding: '12px', textAlign: 'right' }}>{formatCurrency(results.payrollTaxAmount)}</td>
                {show6Month && <td style={{ color: COLORS.textSecondary, padding: '12px', textAlign: 'right' }}>—</td>}
                <td style={{ color: COLORS.textSecondary, padding: '12px', textAlign: 'right' }}>—</td>
              </tr>
              {inputs.marketingSpend > 0 && (
                <tr>
                  <td style={{ color: COLORS.textSecondary, padding: '12px 12px 12px 24px' }}>Marketing Spend</td>
                  <td style={{ color: COLORS.red, padding: '12px', textAlign: 'right' }}>{formatCurrency(results.marketingSpend)}</td>
                  {show6Month && <td style={{ color: COLORS.textSecondary, padding: '12px', textAlign: 'right' }}>—</td>}
                  <td style={{ color: COLORS.textSecondary, padding: '12px', textAlign: 'right' }}>—</td>
                </tr>
              )}
              {inputs.benefits > 0 && (
                <tr>
                  <td style={{ color: COLORS.textSecondary, padding: '12px 12px 12px 24px' }}>Benefits</td>
                  <td style={{ color: COLORS.red, padding: '12px', textAlign: 'right' }}>{formatCurrency(results.benefits)}</td>
                  {show6Month && <td style={{ color: COLORS.textSecondary, padding: '12px', textAlign: 'right' }}>—</td>}
                  <td style={{ color: COLORS.textSecondary, padding: '12px', textAlign: 'right' }}>—</td>
                </tr>
              )}
              {inputs.promoPayOuts > 0 && (
                <tr>
                  <td style={{ color: COLORS.textSecondary, padding: '12px 12px 12px 24px' }}>Promo Pay Outs</td>
                  <td style={{ color: COLORS.red, padding: '12px', textAlign: 'right' }}>{formatCurrency(results.promoPayOuts)}</td>
                  {show6Month && <td style={{ color: COLORS.textSecondary, padding: '12px', textAlign: 'right' }}>—</td>}
                  <td style={{ color: COLORS.textSecondary, padding: '12px', textAlign: 'right' }}>—</td>
                </tr>
              )}
              <tr style={{ backgroundColor: COLORS.bgCardAlt }}>
                <td style={{ color: COLORS.textPrimary, padding: '12px 12px 12px 24px', fontWeight: 500 }}>Total Expenses</td>
                <td style={{ color: COLORS.red, padding: '12px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(results.totalExpenses)}</td>
                {show6Month && <td style={{ padding: '12px' }}></td>}
                <td style={{ padding: '12px' }}></td>
              </tr>

              {/* Net Profit/Loss Row */}
              <tr style={{ backgroundColor: COLORS.bgCard }}>
                <td style={{ color: COLORS.textPrimary, padding: '16px', fontWeight: 700, fontSize: '1.1rem' }}>
                  Net Profit/Loss
                </td>
                <td style={{ 
                  color: results.month1NetProfitLoss >= 0 ? COLORS.green : COLORS.red, 
                  padding: '16px', 
                  textAlign: 'right', 
                  fontWeight: 700,
                  fontSize: '1.1rem'
                }}>
                  {formatCurrency(results.month1NetProfitLoss)}
                </td>
                {show6Month && (
                  <td style={{ 
                    color: results.sixMonthNetProfitLoss >= 0 ? COLORS.green : COLORS.red, 
                    padding: '16px', 
                    textAlign: 'right', 
                    fontWeight: 700,
                    fontSize: '1.1rem'
                  }}>
                    {formatCurrency(results.sixMonthNetProfitLoss)}
                  </td>
                )}
                <td style={{ 
                  color: results.annualNetProfitLoss >= 0 ? COLORS.green : COLORS.red, 
                  padding: '16px', 
                  textAlign: 'right', 
                  fontWeight: 700,
                  fontSize: '1.1rem'
                }}>
                  {formatCurrency(results.annualNetProfitLoss)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Retention Note */}
        <div 
          style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.borderColor }}
          className="p-4 rounded-lg border"
        >
          <p style={{ color: COLORS.textSecondary }} className="text-sm">
            <span style={{ color: COLORS.textPrimary }} className="font-semibold">Note:</span> Renewal projections assume {inputs.retentionRate}% annual client retention rate. 
            {show6Month && " 6-month auto renewal uses square root of annual retention (~" + Math.round(Math.pow(inputs.retentionRate / 100, 0.5) * 100) + "%)."}
          </p>
        </div>
      </div>

      {/* Action Buttons - Outside ref for export */}
      <div className="flex gap-3 mt-4 justify-end">
        <SaveStaffROIReportButton input={inputs} results={results} />
        <Button
          variant="outline"
          onClick={handleCopy}
          className="gap-2"
        >
          <Copy className="h-4 w-4" />
          Copy Results
        </Button>
        <Button
          variant="outline"
          onClick={handleExportPNG}
          disabled={isExporting}
          className="gap-2"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
          Export PNG
        </Button>
      </div>
    </>
  );
};

export default StaffROIReportCard;
