import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ArrowLeft, RotateCcw, Info, Calculator, TrendingUp, Home, Car, Shield, Star, Download, Cloud, CloudOff } from 'lucide-react';
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
  AUTO_HOME_TIER_PERCENTAGES,
  SPL_TIER_PERCENTAGES,
  IntermediateValues,
  TierResult,
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
import BonusForecastReportCard from './BonusForecastReportCard';
import BonusCalculatorUpload from './BonusCalculatorUpload';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import type { BusinessMetricsExtraction } from '@/utils/businessMetricsParser';
import type { BonusQualifiersExtraction } from '@/utils/bonusQualifiersParser';

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

// Results grid table with emphasized Monthly Items column
function ResultsGrid({
  title,
  icon: Icon,
  results,
  showGrowth = true,
  pointsPerItem,
}: {
  title: string;
  icon: React.ElementType;
  results: TierResult[];
  showGrowth?: boolean;
  pointsPerItem?: number;
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
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {title}
          </CardTitle>
          {pointsPerItem !== undefined && pointsPerItem > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {formatNumber(pointsPerItem, 1)} pts/item
            </span>
          )}
        </div>
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
                <th className="text-right px-3 py-2 font-medium">Annual Items</th>
                {/* EMPHASIZED: Monthly Items Needed - THE KEY METRIC */}
                <th className="text-right px-3 py-2 font-bold bg-amber-500/20 dark:bg-amber-500/10 border-l-2 border-r-2 border-amber-500">
                  <div className="flex items-center justify-end gap-1.5">
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                    Monthly Items
                  </div>
                </th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Remaining/Mo</th>
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
                  <td className="text-right px-3 py-2">{formatNumber(row.annualItemsNeeded, 0)}</td>
                  {/* EMPHASIZED CELL: Monthly Items Needed */}
                  <td className="text-right px-3 py-2 bg-amber-500/20 dark:bg-amber-500/10 border-l-2 border-r-2 border-amber-500">
                    <span className="font-bold text-amber-700 dark:text-amber-400 text-base">
                      {formatNumber(row.monthlyItemsNeeded, 1)}
                    </span>
                  </td>
                  <td className="text-right px-3 py-2 text-muted-foreground">
                    {formatNumber(row.remainingMonthlyItemsCount, 1)}
                  </td>
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
  const { user } = useAuth();
  const [inputs, setInputs] = useState<CalculatorInputs>(DEFAULT_INPUTS);
  const [inputsOpen, setInputsOpen] = useState(true);
  const [targetsOpen, setTargetsOpen] = useState(true);
  const [showReportCard, setShowReportCard] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<{ by: string; at: Date } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  // Fetch agency_id from profile
  useEffect(() => {
    const fetchAgencyId = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .maybeSingle();
      
      if (data?.agency_id) {
        setAgencyId(data.agency_id);
      }
    };
    fetchAgencyId();
  }, [user?.id]);

  // Load from database (with localStorage fallback for migration)
  useEffect(() => {
    if (!agencyId || hasLoadedRef.current) return;
    
    const loadInputs = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('bonus_forecast_inputs')
          .select('inputs_json, updated_by_name, updated_at')
          .eq('agency_id', agencyId)
          .maybeSingle();
        
        if (data?.inputs_json) {
          // Load from database
          setInputs({ ...DEFAULT_INPUTS, ...data.inputs_json as Partial<CalculatorInputs> });
          if (data.updated_by_name && data.updated_at) {
            setLastSaved({ by: data.updated_by_name, at: new Date(data.updated_at) });
          }
          hasLoadedRef.current = true;
        } else {
          // Fallback to localStorage for migration
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            setInputs({ ...DEFAULT_INPUTS, ...parsed });
            // Auto-migrate to database
            toast.info('Migrating your saved data to cloud storage...');
          }
          hasLoadedRef.current = true;
        }
      } catch (err) {
        console.error('Error loading forecast inputs:', err);
        // Fallback to localStorage
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            setInputs({ ...DEFAULT_INPUTS, ...JSON.parse(saved) });
          }
        } catch {}
      } finally {
        setIsLoading(false);
      }
    };
    
    loadInputs();
  }, [agencyId]);

  // Save to database on change (debounced)
  useEffect(() => {
    if (!agencyId || !user?.id || !hasLoadedRef.current) return;
    
    const timer = setTimeout(async () => {
      setIsSaving(true);
      try {
        // Get user's display name
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();
        
        const displayName = profile?.full_name || user.email || 'Unknown';
        
        const { error } = await supabase
          .from('bonus_forecast_inputs')
          .upsert({
            agency_id: agencyId,
            inputs_json: inputs,
            updated_by: user.id,
            updated_by_name: displayName,
            updated_at: new Date().toISOString()
          }, { onConflict: 'agency_id' });
        
        if (!error) {
          setLastSaved({ by: displayName, at: new Date() });
          // Also save to localStorage as backup
          localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
        }
      } catch (err) {
        console.error('Error saving forecast inputs:', err);
      } finally {
        setIsSaving(false);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [inputs, agencyId, user?.id]);

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
  const handleReset = async () => {
    setInputs(DEFAULT_INPUTS);
    setLastSaved(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      if (agencyId) {
        await supabase
          .from('bonus_forecast_inputs')
          .delete()
          .eq('agency_id', agencyId);
      }
    } catch {}
  };

  // Handle extraction from uploaded files
  const handleExtractionComplete = useCallback((
    metricsData: BusinessMetricsExtraction | null,
    qualifiersData: BonusQualifiersExtraction | null
  ) => {
    setInputs(prev => {
      const updated = { ...prev };
      
      if (metricsData) {
        if (metricsData.estimatedYearEndPremium > 0) updated.estimatedYearEndPremium = metricsData.estimatedYearEndPremium;
        if (metricsData.autoItemsInForce > 0) updated.autoItemsInForce = metricsData.autoItemsInForce;
        if (metricsData.autoPremiumWritten > 0) updated.autoPremiumWritten = metricsData.autoPremiumWritten;
        if (metricsData.autoRetention > 0) updated.autoRetention = metricsData.autoRetention;
        if (metricsData.homeItemsInForce > 0) updated.homeItemsInForce = metricsData.homeItemsInForce;
        if (metricsData.homePremiumWritten > 0) updated.homePremiumWritten = metricsData.homePremiumWritten;
        if (metricsData.homeRetention > 0) updated.homeRetention = metricsData.homeRetention;
        if (metricsData.splItemsInForce > 0) updated.splItemsInForce = metricsData.splItemsInForce;
        if (metricsData.splPremiumWritten > 0) updated.splPremiumWritten = metricsData.splPremiumWritten;
        if (metricsData.splRetention > 0) updated.splRetention = metricsData.splRetention;
        if (metricsData.newBusinessRetention > 0) updated.newBusinessRetention = metricsData.newBusinessRetention;
      }
      
      if (qualifiersData) {
        // ONLY extract PG point targets - percentages are HARDCODED (industry standard)
        if (qualifiersData.autoHomeTiers.length > 0) {
          updated.autoHomeTiers = AUTO_HOME_TIER_PERCENTAGES.map((bonusPercentage, i) => ({
            bonusPercentage,
            pgPointTarget: qualifiersData.autoHomeTiers[i]?.pgPointTarget || 0,
          }));
        }
        if (qualifiersData.splTiers.length > 0) {
          updated.splTiers = SPL_TIER_PERCENTAGES.map((bonusPercentage, i) => ({
            bonusPercentage,
            pgPointTarget: qualifiersData.splTiers[i]?.pgPointTarget || 0,
          }));
        }
      }
      
      return updated;
    });
  }, []);

  // Compute all results
  const intermediate = useMemo(() => computeIntermediateValues(inputs), [inputs]);
  const autoHomeResults = useMemo(() => calculateAutoHomeGrid(inputs, intermediate), [inputs, intermediate]);
  const splResults = useMemo(() => calculateSplGrid(inputs, intermediate), [inputs, intermediate]);
  const combinedResults = useMemo(() => calculateCombinedGrid(autoHomeResults, splResults), [autoHomeResults, splResults]);

  // Check if we have results to export
  const hasResults = autoHomeResults.length > 0 || splResults.length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-muted-foreground">Loading forecast data...</p>
        </div>
      </div>
    );
  }

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
            {/* Sync status */}
            {lastSaved && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {isSaving ? (
                  <>
                    <Cloud className="h-3 w-3 animate-pulse" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Cloud className="h-3 w-3 text-green-500" />
                    Last saved by {lastSaved.by} · {new Date(lastSaved.at).toLocaleString()}
                  </>
                )}
              </p>
            )}
            {!lastSaved && !isSaving && agencyId && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CloudOff className="h-3 w-3" />
                Not yet saved
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasResults && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowReportCard(true)} 
              className="gap-1"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </div>

      {/* File Upload Section */}
      <BonusCalculatorUpload onExtractionComplete={handleExtractionComplete} />

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
            <CardContent className="space-y-2">
              <LabeledInput
                label="Estimated Year End Premium"
                tooltip="Total Auto + Home + SPL written premium target"
                value={inputs.estimatedYearEndPremium}
                onChange={(v) => updateInput('estimatedYearEndPremium', v)}
                prefix="$"
              />
              <p className="text-center text-xs text-destructive">
                This is an estimated value. Adjust manually if needed.
              </p>
            </CardContent>
          </Card>

          {/* Section 2-4: Portfolio Inputs */}
          <p className="text-center font-bold text-sm text-muted-foreground">
            👇🏼 Find this data on the "Business Metrics-Agency Printable View" 👇🏼
          </p>
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
                  tooltip="Production so far this year (in points)"
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

      {/* Intermediate Values Summary - Updated with Items metrics */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            Calculated Baseline & Points Per Item
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Auto+Home Items</p>
              <p className="font-medium">{formatNumber(intermediate.autoHomeBaselineItems)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Auto+Home Points</p>
              <p className="font-medium">{formatNumber(intermediate.totalAutoHomeBaselinePoints)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">A+H Pts/Item</p>
              <p className="font-medium text-blue-600 dark:text-blue-400">
                {intermediate.autoHomePointsPerItem > 0 ? formatNumber(intermediate.autoHomePointsPerItem, 1) : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">A+H Point Loss</p>
              <p className="font-medium text-red-500">-{formatNumber(intermediate.autoPointLoss + intermediate.homePointLoss)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">SPL Items</p>
              <p className="font-medium">{formatNumber(intermediate.splBaselineItems)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">SPL Points</p>
              <p className="font-medium">{formatNumber(intermediate.splBaselinePoints)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">SPL Pts/Item</p>
              <p className="font-medium text-blue-600 dark:text-blue-400">{formatNumber(intermediate.splPointsPerItem, 1)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">SPL Point Loss</p>
              <p className="font-medium text-red-500">-{formatNumber(intermediate.splPointLoss)}</p>
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
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-foreground">Results</h4>
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            <span>Monthly Items = Key Target</span>
          </div>
        </div>
        
        <ResultsGrid
          title="Auto & Home Production"
          icon={Car}
          results={autoHomeResults}
          pointsPerItem={intermediate.autoHomePointsPerItem}
        />
        
        <ResultsGrid
          title="Specialty Product Lines (SPL)"
          icon={Shield}
          results={splResults}
          pointsPerItem={intermediate.splPointsPerItem}
        />
        
        <ResultsGrid
          title="Combined Total (Auto/Home + SPL)"
          icon={TrendingUp}
          results={combinedResults}
          showGrowth={false}
          pointsPerItem={intermediate.combinedPointsPerItem}
        />
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center italic pt-2">
        These are estimates to help guide production goals. Actual bonus calculations may vary.
      </p>

      {/* Report Card Modal */}
      {showReportCard && (
        <BonusForecastReportCard
          inputs={inputs}
          intermediate={intermediate}
          autoHomeResults={autoHomeResults}
          splResults={splResults}
          combinedResults={combinedResults}
          onClose={() => setShowReportCard(false)}
        />
      )}
    </div>
  );
}
