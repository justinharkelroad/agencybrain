import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, RotateCcw, History, Calculator } from 'lucide-react';
import { HelpVideoButton } from '@/components/HelpVideoButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StaffROIInputs, StaffROIResults, computeStaffROI, DEFAULT_STAFF_ROI_INPUTS } from '@/utils/staffROICalculator';
import StaffROIReportCard from './StaffROIReportCard';

const STORAGE_KEY = 'staffROI:inputs';

interface StaffROICalculatorProps {
  onBack: () => void;
}

function InputAffix({ children, prefix, suffix }: { children: React.ReactNode; prefix?: string; suffix?: string }) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground pointer-events-none">{prefix}</span>
      )}
      {suffix && (
        <span className="absolute inset-y-0 right-3 flex items-center text-muted-foreground pointer-events-none">{suffix}</span>
      )}
      {children}
    </div>
  );
}

function GridTwoCols({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

const EMPTY_INPUTS: StaffROIInputs = {
  autoPremium: 0,
  homePremium: 0,
  commissionRate: 0,
  baseSalary: 0,
  payrollTaxRate: 0,
  autoCommissionRate: 0,
  homeCommissionRate: 0,
  autoRenewalRate: 0,
  homeRenewalRate: 0,
  retentionRate: 0,
  marketingSpend: 0,
  benefits: 0,
  promoPayOuts: 0,
  autoRenewalPeriod: '6months',
  isEliteAgency: false,
};

export function StaffROICalculator({ onBack }: StaffROICalculatorProps) {
  const [inputs, setInputs] = useState<StaffROIInputs>(EMPTY_INPUTS);
  const [results, setResults] = useState<StaffROIResults | null>(null);
  const [showReport, setShowReport] = useState(false);

  // Auto-save to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [inputs]);

  const loadLast = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setInputs(JSON.parse(saved));
      }
    } catch {}
  };

  const handleReset = () => {
    setInputs(EMPTY_INPUTS);
    setResults(null);
    setShowReport(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  const handleCalculate = () => {
    const computed = computeStaffROI(inputs);
    setResults(computed);
    setShowReport(true);
  };

  const updateInput = <K extends keyof StaffROIInputs>(key: K, value: StaffROIInputs[K]) => {
    setInputs(prev => ({ ...prev, [key]: value }));
    // Hide report if inputs change
    if (showReport) {
      setShowReport(false);
    }
  };

  const handleRenewalPeriodChange = (period: '6months' | 'annual') => {
    const newInputs = { ...inputs, autoRenewalPeriod: period };
    setInputs(newInputs);
    // Recalculate with new period
    const computed = computeStaffROI(newInputs);
    setResults(computed);
  };

  const totalPremium = (inputs.autoPremium || 0) + (inputs.homePremium || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back to tools">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-base font-medium text-muted-foreground">ROI on Staff</h3>
          <HelpVideoButton videoKey="Roi_staff" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadLast} className="gap-1">
            <History className="h-4 w-4" />
            Load Last
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      {/* Input Form */}
      <div className="space-y-6">
        {/* Premium Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide">Premium Written by Team Member</h4>
          <GridTwoCols>
            <div>
              <Label htmlFor="autoPremium">Auto Premium</Label>
              <InputAffix prefix="$">
                <Input
                  id="autoPremium"
                  type="number"
                  placeholder="30,000"
                  className="pl-7"
                  value={inputs.autoPremium || ''}
                  onChange={(e) => updateInput('autoPremium', parseFloat(e.target.value) || 0)}
                />
              </InputAffix>
            </div>
            <div>
              <Label htmlFor="homePremium">Home Premium</Label>
              <InputAffix prefix="$">
                <Input
                  id="homePremium"
                  type="number"
                  placeholder="20,000"
                  className="pl-7"
                  value={inputs.homePremium || ''}
                  onChange={(e) => updateInput('homePremium', parseFloat(e.target.value) || 0)}
                />
              </InputAffix>
            </div>
          </GridTwoCols>
          <p className="text-sm text-muted-foreground">
            Total premium written: <span className="font-semibold text-foreground">${totalPremium.toLocaleString()}</span>
          </p>
        </div>

        {/* Team Member Cost Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide">Team Member Cost</h4>
          <GridTwoCols>
            <div>
              <Label htmlFor="commissionRate">Commission Rate</Label>
              <InputAffix suffix="%">
                <Input
                  id="commissionRate"
                  type="number"
                  placeholder="6"
                  className="pr-8"
                  value={inputs.commissionRate || ''}
                  onChange={(e) => updateInput('commissionRate', parseFloat(e.target.value) || 0)}
                />
              </InputAffix>
            </div>
            <div>
              <Label htmlFor="baseSalary">Base Monthly Salary</Label>
              <InputAffix prefix="$">
                <Input
                  id="baseSalary"
                  type="number"
                  placeholder="3,000"
                  className="pl-7"
                  value={inputs.baseSalary || ''}
                  onChange={(e) => updateInput('baseSalary', parseFloat(e.target.value) || 0)}
                />
              </InputAffix>
            </div>
          </GridTwoCols>
          <div className="w-full md:w-1/2">
            <Label htmlFor="payrollTaxRate">Payroll Tax Rate</Label>
            <InputAffix suffix="%">
              <Input
                id="payrollTaxRate"
                type="number"
                placeholder="8"
                className="pr-8"
                value={inputs.payrollTaxRate || ''}
                onChange={(e) => updateInput('payrollTaxRate', parseFloat(e.target.value) || 0)}
              />
            </InputAffix>
          </div>
        </div>

        {/* Agency Commissions - New Business */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide">Agency Commissions for New Business</h4>
          <GridTwoCols>
            <div>
              <Label htmlFor="autoCommissionRate">Auto Commission Rate</Label>
              <InputAffix suffix="%">
                <Input
                  id="autoCommissionRate"
                  type="number"
                  placeholder="10"
                  className="pr-8"
                  value={inputs.autoCommissionRate || ''}
                  onChange={(e) => updateInput('autoCommissionRate', parseFloat(e.target.value) || 0)}
                />
              </InputAffix>
            </div>
            <div>
              <Label htmlFor="homeCommissionRate">Home Commission Rate</Label>
              <InputAffix suffix="%">
                <Input
                  id="homeCommissionRate"
                  type="number"
                  placeholder="10"
                  className="pr-8"
                  value={inputs.homeCommissionRate || ''}
                  onChange={(e) => updateInput('homeCommissionRate', parseFloat(e.target.value) || 0)}
                />
              </InputAffix>
            </div>
          </GridTwoCols>
        </div>

        {/* Agency Commissions - Renewals */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide">Agency Commissions for Renewals</h4>
          <GridTwoCols>
            <div>
              <Label htmlFor="autoRenewalRate">Auto Renewal Commission Rate</Label>
              <InputAffix suffix="%">
                <Input
                  id="autoRenewalRate"
                  type="number"
                  placeholder="10"
                  className="pr-8"
                  value={inputs.autoRenewalRate || ''}
                  onChange={(e) => updateInput('autoRenewalRate', parseFloat(e.target.value) || 0)}
                />
              </InputAffix>
            </div>
            <div>
              <Label htmlFor="homeRenewalRate">Home Renewal Commission Rate</Label>
              <InputAffix suffix="%">
                <Input
                  id="homeRenewalRate"
                  type="number"
                  placeholder="10"
                  className="pr-8"
                  value={inputs.homeRenewalRate || ''}
                  onChange={(e) => updateInput('homeRenewalRate', parseFloat(e.target.value) || 0)}
                />
              </InputAffix>
            </div>
          </GridTwoCols>
          {/* Elite Agency Checkbox */}
          <div className="flex items-start space-x-3">
            <Checkbox
              id="isEliteAgency"
              checked={inputs.isEliteAgency}
              onCheckedChange={(checked) => updateInput('isEliteAgency', checked === true)}
            />
            <div className="grid gap-1 leading-none">
              <label
                htmlFor="isEliteAgency"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Elite Agency: Include 2nd VC on first auto renewal
              </label>
              <p className="text-xs text-muted-foreground">
                Uses new business rate for 6-month auto renewal
              </p>
            </div>
          </div>
          <GridTwoCols>
            <div>
              <Label htmlFor="retentionRate">Client Retention Rate (Annual)</Label>
              <InputAffix suffix="%">
                <Input
                  id="retentionRate"
                  type="number"
                  placeholder="90"
                  className="pr-8"
                  value={inputs.retentionRate || ''}
                  onChange={(e) => updateInput('retentionRate', parseFloat(e.target.value) || 0)}
                />
              </InputAffix>
            </div>
            <div>
              <Label htmlFor="autoRenewalPeriod">Auto Renewal Period</Label>
              <Select 
                value={inputs.autoRenewalPeriod} 
                onValueChange={(v) => updateInput('autoRenewalPeriod', v as '6months' | 'annual')}
              >
                <SelectTrigger id="autoRenewalPeriod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="6months">6 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </GridTwoCols>
        </div>

        {/* Optional Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide">Optional</h4>
          <GridTwoCols>
            <div>
              <Label htmlFor="marketingSpend">Average Monthly Marketing Spend per Agent</Label>
              <InputAffix prefix="$">
                <Input
                  id="marketingSpend"
                  type="number"
                  placeholder="0"
                  className="pl-7"
                  value={inputs.marketingSpend || ''}
                  onChange={(e) => updateInput('marketingSpend', parseFloat(e.target.value) || 0)}
                />
              </InputAffix>
            </div>
            <div>
              <Label htmlFor="benefits">Benefits</Label>
              <InputAffix prefix="$">
                <Input
                  id="benefits"
                  type="number"
                  placeholder="0"
                  className="pl-7"
                  value={inputs.benefits || ''}
                  onChange={(e) => updateInput('benefits', parseFloat(e.target.value) || 0)}
                />
              </InputAffix>
            </div>
          </GridTwoCols>
          <div className="w-full md:w-1/2">
            <Label htmlFor="promoPayOuts">Promo Pay Outs</Label>
            <InputAffix prefix="$">
              <Input
                id="promoPayOuts"
                type="number"
                placeholder="0"
                className="pl-7"
                value={inputs.promoPayOuts || ''}
                onChange={(e) => updateInput('promoPayOuts', parseFloat(e.target.value) || 0)}
              />
            </InputAffix>
          </div>
        </div>

        {/* Calculate Button */}
        <Button onClick={handleCalculate} className="w-full gap-2" size="lg">
          <Calculator className="h-5 w-5" />
          Calculate ROI
        </Button>
      </div>

      {/* Results Report Card */}
      {showReport && results && (
        <StaffROIReportCard
          inputs={inputs}
          results={results}
          onClose={() => setShowReport(false)}
          onRenewalPeriodChange={handleRenewalPeriodChange}
        />
      )}
    </div>
  );
}

export default StaffROICalculator;
