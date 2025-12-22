import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, RotateCcw, Info, Calculator, TrendingUp, Home, Car, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import {
  CalculatorInputs,
  BonusTierInput,
  DEFAULT_INPUTS,
  DEFAULT_AUTO_HOME_TIERS,
  DEFAULT_SPL_TIERS,
} from '@/types/bonus-calculator';
import {
  computeIntermediateValues,
  calculateAutoHomeGrid,
  calculateSplGrid,
  calculateCombinedGrid,
  formatCurrency,
  formatPercentage,
  formatNumber,
} from '@/utils/bonusCalculations';

const STORAGE_KEY = 'bonusForecastCalc:inputs';

interface BonusForecastCalculatorProps {
  onBack: () => void;
}

// Input with label and tooltip
function LabeledInput({
  label,
  tooltip,
  value,
  onChange,
  type = 'number',
  prefix,
  suffix,
  min,
  max,
  step,
}: {
  label: string;
  tooltip?: string;
  value: number | string;
  onChange: (value: number) => void;
  type?: string;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Label className="text-sm text-muted-foreground">{label}</Label>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            {prefix}
          </span>
        )}
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={`${prefix ? 'pl-7' : ''} ${suffix ? 'pr-8' : ''} bg-[#D9EAD3]/20 border-[#D9EAD3]/40`}
          min={min}
          max={max}
          step={step}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

// PG Target row component
function PGTargetRow({
  tier,
  index,
  onChange,
}: {
  tier: BonusTierInput;
  index: number;
  onChange: (index: number, value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-24 text-sm font-medium text-foreground">
        {formatPercentage(tier.bonusPercentage)} Bonus
      </span>
      <Input
        type="number"
        value={tier.pgPointTarget || ''}
        onChange={(e) => onChange(index, parseFloat(e.target.value) || 0)}
        placeholder="Enter target"
        className="w-32 bg-[#D9EAD3]/30 border-[#D9EAD3]/50 text-sm"
        min={0}
      />
      <span className="text-xs text-muted-foreground">PG Points</span>
    </div>
  );
}

// Results grid table
function ResultsGrid({
  title,
  icon: Icon,
  results,
  showGrowth = true,
}: {
  title: string;
  icon: React.ElementType;
  results: ReturnType<typeof calculateAutoHomeGrid>;
  showGrowth?: boolean;
}) {
  if (results.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            Enter PG Point Targets above to see calculations
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left px-3 py-2 font-medium">PG Target</th>
                {showGrowth && <th className="text-right px-3 py-2 font-medium">Growth %</th>}
                <th className="text-right px-3 py-2 font-medium">Bonus %</th>
                <th className="text-right px-3 py-2 font-medium">Est. Bonus</th>
                <th className="text-right px-3 py-2 font-medium">Annual Pts</th>
                <th className="text-right px-3 py-2 font-medium">Monthly Avg</th>
                <th className="text-right px-3 py-2 font-medium">Monthly Needed</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row, i) => (
                <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="px-3 py-2 font-medium">{formatNumber(row.pgPointTarget)}</td>
                  {showGrowth && (
                    <td className="text-right px-3 py-2">{formatPercentage(row.growthPercentage, 1)}</td>
                  )}
                  <td className="text-right px-3 py-2">{formatPercentage(row.bonusPercentage)}</td>
                  <td className="text-right px-3 py-2 text-green-600 dark:text-green-400 font-medium">
                    {formatCurrency(row.estimatedBonus)}
                  </td>
                  <td className="text-right px-3 py-2">{formatNumber(row.annualProductionNeeded, 0)}</td>
                  <td className="text-right px-3 py-2">{formatNumber(row.monthlyPointsNeeded, 0)}</td>
                  <td className="text-right px-3 py-2 font-medium">{formatNumber(row.remainingMonthlyItems, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BonusForecastCalculator({ onBack }: BonusForecastCalculatorProps) {
  const [inputs, setInputs] = useState<CalculatorInputs>(DEFAULT_INPUTS);
  const [inputsOpen, setInputsOpen] = useState(true);
  const [targetsOpen, setTargetsOpen] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setInputs({ ...DEFAULT_INPUTS, ...parsed });
      }
    } catch {}
  }, []);

  // Save to localStorage on change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [inputs]);

  // Update a single input field
  const updateInput = <K extends keyof CalculatorInputs>(key: K, value: CalculatorInputs[K]) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  // Update Auto/Home tier
  const updateAutoHomeTier = (index: number, value: number) => {
    setInputs((prev) => ({
      ...prev,
      autoHomeTiers: prev.autoHomeTiers.map((t, i) =>
        i === index ? { ...t, pgPointTarget: value } : t
      ),
    }));
  };

  // Update SPL tier
  const updateSplTier = (index: number, value: number) => {
    setInputs((prev) => ({
      ...prev,
      splTiers: prev.splTiers.map((t, i) =>
        i === index ? { ...t, pgPointTarget: value } : t
      ),
    }));
  };

  // Reset to defaults
  const handleReset = () => {
    setInputs(DEFAULT_INPUTS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  // Compute all results
  const intermediate = useMemo(() => computeIntermediateValues(inputs), [inputs]);
  const autoHomeResults = useMemo(() => calculateAutoHomeGrid(inputs, intermediate), [inputs, intermediate]);
  const splResults = useMemo(() => calculateSplGrid(inputs, intermediate), [inputs, intermediate]);
  const combinedResults = useMemo(() => calculateCombinedGrid(autoHomeResults, splResults), [autoHomeResults, splResults]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back to tools">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h3 className="text-base font-medium text-muted-foreground">Annual Bonus Forecast Calculator</h3>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} className="gap-1">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      {/* Input Sections */}
      <Collapsible open={inputsOpen} onOpenChange={setInputsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between px-3 py-2 h-auto">
            <span className="font-medium">Portfolio & Factor Inputs</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${inputsOpen ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-2">
          {/* Section 1: Premium Target */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Premium Target
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LabeledInput
                label="Estimated Year End Premium"
                tooltip="Total Auto + Home + SPL written premium target"
                value={inputs.estimatedYearEndPremium}
                onChange={(v) => updateInput('estimatedYearEndPremium', v)}
                prefix="$"
              />
            </CardContent>
          </Card>

          {/* Section 2-4: Portfolio Inputs */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Auto */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Auto Portfolio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <LabeledInput
                  label="Items In Force"
                  tooltip="Current auto policies"
                  value={inputs.autoItemsInForce}
                  onChange={(v) => updateInput('autoItemsInForce', v)}
                />
                <LabeledInput
                  label="Premium Written"
                  tooltip="Current auto premium"
                  value={inputs.autoPremiumWritten}
                  onChange={(v) => updateInput('autoPremiumWritten', v)}
                  prefix="$"
                />
                <LabeledInput
                  label="Retention Rate"
                  tooltip="Auto policy retention rate"
                  value={inputs.autoRetention}
                  onChange={(v) => updateInput('autoRetention', v)}
                  suffix="%"
                  min={0}
                  max={100}
                />
              </CardContent>
            </Card>

            {/* Home */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Home Portfolio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <LabeledInput
                  label="Items In Force"
                  tooltip="Current home policies"
                  value={inputs.homeItemsInForce}
                  onChange={(v) => updateInput('homeItemsInForce', v)}
                />
                <LabeledInput
                  label="Premium Written"
                  tooltip="Current home premium"
                  value={inputs.homePremiumWritten}
                  onChange={(v) => updateInput('homePremiumWritten', v)}
                  prefix="$"
                />
                <LabeledInput
                  label="Retention Rate"
                  tooltip="Home policy retention rate"
                  value={inputs.homeRetention}
                  onChange={(v) => updateInput('homeRetention', v)}
                  suffix="%"
                  min={0}
                  max={100}
                />
              </CardContent>
            </Card>

            {/* SPL */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  SPL Portfolio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <LabeledInput
                  label="Items In Force"
                  tooltip="Current SPL policies"
                  value={inputs.splItemsInForce}
                  onChange={(v) => updateInput('splItemsInForce', v)}
                />
                <LabeledInput
                  label="Premium Written"
                  tooltip="Current SPL premium"
                  value={inputs.splPremiumWritten}
                  onChange={(v) => updateInput('splPremiumWritten', v)}
                  prefix="$"
                />
                <LabeledInput
                  label="Retention Rate"
                  tooltip="SPL policy retention rate"
                  value={inputs.splRetention}
                  onChange={(v) => updateInput('splRetention', v)}
                  suffix="%"
                  min={0}
                  max={100}
                />
              </CardContent>
            </Card>
          </div>

          {/* Section 5-6: Factors & Progress */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Adjustment Factors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <LabeledInput
                  label="New Business Retention"
                  tooltip="Retention for 0-2 year policies"
                  value={inputs.newBusinessRetention}
                  onChange={(v) => updateInput('newBusinessRetention', v)}
                  suffix="%"
                  min={0}
                  max={100}
                />
                <LabeledInput
                  label="New Business Cushion"
                  tooltip="Safety buffer for unexpected losses"
                  value={inputs.newBusinessCushion}
                  onChange={(v) => updateInput('newBusinessCushion', v)}
                  suffix="%"
                  min={0}
                  max={100}
                />
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Progress Tracking</CardTitle>
                <CardDescription className="text-xs">Optional - for remaining items calculation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <LabeledInput
                  label="Items Produced YTD"
                  tooltip="Production so far this year"
                  value={inputs.itemsProducedYTD}
                  onChange={(v) => updateInput('itemsProducedYTD', v)}
                />
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Current Month</Label>
                  <Select
                    value={String(inputs.currentMonth)}
                    onValueChange={(v) => updateInput('currentMonth', parseInt(v))}
                  >
                    <SelectTrigger className="bg-[#D9EAD3]/20 border-[#D9EAD3]/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {new Date(2024, i, 1).toLocaleDateString('en-US', { month: 'long' })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Intermediate Values Summary */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            Calculated Baseline & Losses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Auto Points</p>
              <p className="font-medium">{formatNumber(intermediate.autoPoints)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Home Points</p>
              <p className="font-medium">{formatNumber(intermediate.homePoints)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">SPL Points</p>
              <p className="font-medium">{formatNumber(intermediate.splPoints)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total A+H Baseline</p>
              <p className="font-medium">{formatNumber(intermediate.totalAutoHomeBaselinePoints)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Auto Point Loss</p>
              <p className="font-medium text-red-500">-{formatNumber(intermediate.autoPointLoss)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Home Point Loss</p>
              <p className="font-medium text-red-500">-{formatNumber(intermediate.homePointLoss)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">SPL Point Loss</p>
              <p className="font-medium text-red-500">-{formatNumber(intermediate.splPointLoss)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">SPL Baseline</p>
              <p className="font-medium">{formatNumber(intermediate.splBaselinePoints)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 7: PG Point Targets */}
      <Collapsible open={targetsOpen} onOpenChange={setTargetsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between px-3 py-2 h-auto">
            <span className="font-medium">PG Point Targets (Enter Your Agency Targets)</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${targetsOpen ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <Card className="border-border/50">
            <CardContent className="pt-4">
              <Tabs defaultValue="autohome" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="autohome" className="gap-1">
                    <Car className="h-3.5 w-3.5" />
                    Auto & Home Targets
                  </TabsTrigger>
                  <TabsTrigger value="spl" className="gap-1">
                    <Shield className="h-3.5 w-3.5" />
                    SPL Targets
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="autohome" className="space-y-1">
                  <p className="text-xs text-muted-foreground mb-3">
                    Enter your agency's PG point targets for each Auto & Home bonus tier
                  </p>
                  {inputs.autoHomeTiers.map((tier, i) => (
                    <PGTargetRow
                      key={i}
                      tier={tier}
                      index={i}
                      onChange={updateAutoHomeTier}
                    />
                  ))}
                </TabsContent>
                <TabsContent value="spl" className="space-y-1">
                  <p className="text-xs text-muted-foreground mb-3">
                    Enter your agency's PG point targets for each SPL bonus tier
                  </p>
                  {inputs.splTiers.map((tier, i) => (
                    <PGTargetRow
                      key={i}
                      tier={tier}
                      index={i}
                      onChange={updateSplTier}
                    />
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Output Grids */}
      <div className="space-y-4">
        <h4 className="font-medium text-foreground">Results</h4>
        
        <ResultsGrid
          title="Auto & Home Point Growth"
          icon={Car}
          results={autoHomeResults}
        />
        
        <ResultsGrid
          title="Specialty Product Lines (SPL)"
          icon={Shield}
          results={splResults}
        />
        
        <ResultsGrid
          title="Combined Total (Auto/Home + SPL)"
          icon={TrendingUp}
          results={combinedResults}
          showGrowth={false}
        />
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center italic pt-2">
        These are estimates to help guide production goals. Actual bonus calculations may vary.
      </p>
    </div>
  );
}
