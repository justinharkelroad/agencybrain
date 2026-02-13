import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { CircleHelp, Loader2, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useCoachingThresholds } from '@/hooks/useCoachingThresholds';
import {
  COACHING_SAMPLE_SIZE_PRESETS,
  DEFAULT_COACHING_INSIGHT_CONFIG,
  type CoachingSampleSizeProfile,
  type CoachingInsightConfig,
  type InsightType,
} from '@/types/coaching';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CoachingThresholdsSettingsProps {
  agencyId: string;
}

const insightTypeOptions: Array<{ key: keyof CoachingInsightConfig['featureFlags']; label: string; description: string }> = [
  {
    key: 'lowQuoteRate',
    label: 'Low Quote Rate',
    description: 'Alert when quote rate falls below configured ratio thresholds.',
  },
  {
    key: 'lowCloseRate',
    label: 'Low Close Rate',
    description: 'Alert when close rate falls below configured ratio thresholds.',
  },
  {
    key: 'objectionPattern',
    label: 'Recurring Objection',
    description: 'Alert when objection frequency crosses warning/critical counts.',
  },
  {
    key: 'lowCallVolume',
    label: 'Low Call Volume',
    description: 'Alert when outbound call activity falls below target/team baseline.',
  },
  {
    key: 'lowTalkTime',
    label: 'Low Talk Time',
    description: 'Alert when average talk minutes fall below target/team baseline.',
  },
  {
    key: 'decliningPassRate',
    label: 'Declining Pass Rate',
    description: 'Alert when pass rate trend is consecutively down over multiple weeks.',
  },
];

const suggestionKeys: InsightType[] = [
  'low_quote_rate',
  'low_close_rate',
  'objection_pattern',
  'low_call_volume',
  'low_talk_time',
  'declining_pass_rate',
];

type SampleSizeProfileOption = CoachingSampleSizeProfile | 'custom';

const sampleProfileOptions: Array<{
  value: CoachingSampleSizeProfile;
  label: string;
  description: string;
}> = [
  {
    value: 'conservative',
    label: 'Conservative',
    description: 'Higher sample sizes for more stable, less-noisy alerts.',
  },
  {
    value: 'average',
    label: 'Average',
    description: 'Balanced sensitivity with moderate sample protection.',
  },
  {
    value: 'aggressive',
    label: 'Aggressive',
    description: 'Lower sample sizes for faster alerts on smaller signals.',
  },
];

const sectionTooltips: Record<string, string> = {
  insightTypes: 'Enable or disable each rule used to generate insights for team members.',
  analysisWindows:
    'Set how much historical data each rule sees when calculating rates, trends, and objections.',
  thresholds:
    'Adjust alert math for ratios and counts. Lower thresholds increase sensitivity (more alerts).',
  benchmarkRules: 'Define when team averages can be used instead of targets as the comparison baseline.',
  suggestionTemplates: 'Customize what each coaching recommendation says when an insight appears.',
  profileField: 'Choose a predefined sample-size profile, then tune any individual gate manually.',
  profileSelectConservative: 'Conservative: fewer alerts, more stable (requires stronger evidence).',
  profileSelectAverage: 'Average: balanced sensitivity and stability.',
  profileSelectAggressive: 'Aggressive: faster alerts, tolerates smaller sample sizes.',
};

const isSampleThreshold = (key: keyof CoachingInsightConfig['thresholds']): key is
  | 'minQuoteRateSampleLeads'
  | 'minCloseRateSampleQuoted'
  | 'minActivitySampleDays'
  | 'minPassRateSampleDays' =>
  key === 'minQuoteRateSampleLeads' ||
  key === 'minCloseRateSampleQuoted' ||
  key === 'minActivitySampleDays' ||
  key === 'minPassRateSampleDays';

function getMatchingSampleProfile(
  thresholds: CoachingInsightConfig['thresholds'],
): CoachingSampleSizeProfile | null {
  for (const [profile, preset] of Object.entries(COACHING_SAMPLE_SIZE_PRESETS) as [
    CoachingSampleSizeProfile,
    (typeof COACHING_SAMPLE_SIZE_PRESETS)[CoachingSampleSizeProfile],
  ][]) {
    if (
      thresholds.minQuoteRateSampleLeads === preset.minQuoteRateSampleLeads &&
      thresholds.minCloseRateSampleQuoted === preset.minCloseRateSampleQuoted &&
      thresholds.minActivitySampleDays === preset.minActivitySampleDays &&
      thresholds.minPassRateSampleDays === preset.minPassRateSampleDays
    ) {
      return profile;
    }
  }

  return null;
}

export function CoachingThresholdsSettings({ agencyId }: CoachingThresholdsSettingsProps) {
  const {
    thresholds,
    featureFlags,
    windows,
    benchmarkConfig,
    suggestionTemplates,
    config,
    isLoading,
    save,
    isSaving,
    reset,
    isResetting,
  } = useCoachingThresholds(agencyId);

  const [form, setForm] = useState<CoachingInsightConfig>(DEFAULT_COACHING_INSIGHT_CONFIG);
  const [sampleProfile, setSampleProfile] = useState<SampleSizeProfileOption>('average');

  useEffect(() => {
    const nextConfig = config || {
      ...DEFAULT_COACHING_INSIGHT_CONFIG,
      thresholds,
      featureFlags,
      windows,
      benchmarkConfig,
      suggestionTemplates,
    };
    setForm(nextConfig);
    setSampleProfile(getMatchingSampleProfile(nextConfig.thresholds) ?? 'custom');
  }, [config, thresholds, featureFlags, windows, benchmarkConfig, suggestionTemplates]);

  const handleThresholdChange = (key: keyof CoachingInsightConfig['thresholds'], value: string) => {
    const num = parseFloat(value);
    if (!Number.isNaN(num)) {
      setForm(prev => ({ ...prev, thresholds: { ...prev.thresholds, [key]: num } }));
    }
  };

  const handleThresholdIntChange = (key: keyof Omit<CoachingInsightConfig['thresholds'], 'activityWarningRatio' | 'activityCriticalRatio' | 'rateWarningRatio' | 'rateCriticalRatio'>, value: string) => {
    const num = parseInt(value, 10);
    if (!Number.isNaN(num) && num >= 0) {
      setForm(prev => {
        const nextThresholds = { ...prev.thresholds, [key]: num };
        if (isSampleThreshold(key)) {
          setSampleProfile('custom');
        }
        return { ...prev, thresholds: nextThresholds };
      });
    }
  };

  const handleSampleProfileChange = (value: CoachingSampleSizeProfile) => {
    const preset = COACHING_SAMPLE_SIZE_PRESETS[value];
    setForm(prev => ({
      ...prev,
      thresholds: {
        ...prev.thresholds,
        ...preset,
      },
    }));
    setSampleProfile(value);
  };

  const handleWindowChange = (key: keyof CoachingInsightConfig['windows'], value: string) => {
    const num = parseInt(value, 10);
    if (!Number.isNaN(num) && num > 0) {
      setForm(prev => ({ ...prev, windows: { ...prev.windows, [key]: num } }));
    }
  };

  const handleBenchmarkChange = (key: keyof CoachingInsightConfig['benchmarkConfig'], value: string | boolean) => {
    if (typeof value === 'boolean') {
      setForm(prev => ({ ...prev, benchmarkConfig: { ...prev.benchmarkConfig, [key]: value } }));
      return;
    }

    const num = parseInt(value, 10);
    if (!Number.isNaN(num) && num >= 1) {
      setForm(prev => ({ ...prev, benchmarkConfig: { ...prev.benchmarkConfig, [key]: num } }));
    }
  };

  const handleTemplateChange = (type: InsightType, value: string) => {
    setForm(prev => ({
      ...prev,
      suggestionTemplates: {
        ...prev.suggestionTemplates,
        [type]: value,
      },
    }));
  };

  const handleFlagChange = (key: keyof CoachingInsightConfig['featureFlags'], checked: boolean) => {
    setForm(prev => ({ ...prev, featureFlags: { ...prev.featureFlags, [key]: checked } }));
  };

  const handleSave = async () => {
    try {
      await save(form);
      toast.success('Coaching insights settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
  };

  const handleReset = async () => {
    try {
      await reset();
      setForm(DEFAULT_COACHING_INSIGHT_CONFIG);
      toast.success('Coaching insights settings reset to defaults');
    } catch {
      toast.error('Failed to reset settings');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={250}>
      <Card>
        <CardHeader>
        <CardTitle>Coaching Insight Settings</CardTitle>
        <CardDescription>
          Control what insights generate and how thresholds/windows/suggestions behave.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Insight toggles */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span>Insight Types</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span role="button" tabIndex={0} className="inline-flex text-muted-foreground/80 hover:text-foreground transition-colors">
                      <CircleHelp className="h-4 w-4" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-64">
                    <p className="text-xs">{sectionTooltips.insightTypes}</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription>Enable/disable each automatic insight rule.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {insightTypeOptions.map((option) => (
                <label key={option.key} className="flex items-start gap-2 border rounded-lg p-3">
                  <Checkbox
                    checked={form.featureFlags[option.key]}
                    onCheckedChange={(checked) => handleFlagChange(option.key, checked === true)}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-sm font-medium">{option.label}</div>
                    <div className="text-xs text-muted-foreground">{option.description}</div>
                  </div>
                </label>
              ))}
            </CardContent>
          </Card>

          {/* Analysis windows */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span>Analysis Windows</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span role="button" tabIndex={0} className="inline-flex text-muted-foreground/80 hover:text-foreground transition-colors">
                      <CircleHelp className="h-4 w-4" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-64">
                    <p className="text-xs">{sectionTooltips.analysisWindows}</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription>Control date windows used for calculation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Metrics Lookback (days)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.windows.metricsLookbackDays}
                    onChange={(e) => handleWindowChange('metricsLookbackDays', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Objections Lookback (days)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.windows.objectionsLookbackDays}
                    onChange={(e) => handleWindowChange('objectionsLookbackDays', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pass Rate Lookback (days)</Label>
                  <Input
                    type="number"
                    min="7"
                    value={form.windows.passRateLookbackDays}
                    onChange={(e) => handleWindowChange('passRateLookbackDays', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pass Rate Buckets (weeks)</Label>
                  <Input
                    type="number"
                    min="2"
                    value={form.windows.passRateBuckets}
                    onChange={(e) => handleWindowChange('passRateBuckets', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Thresholds */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span>Activity Thresholds</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span role="button" tabIndex={0} className="inline-flex text-muted-foreground/80 hover:text-foreground transition-colors">
                    <CircleHelp className="h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-64">
                  <p className="text-xs">{sectionTooltips.thresholds}</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <CardDescription>
              Lower ratios are more sensitive (flag earlier). Values are percentages expressed as decimals.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Sample-size profile</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span role="button" tabIndex={0} className="inline-flex text-muted-foreground/80 hover:text-foreground transition-colors">
                        <CircleHelp className="h-4 w-4" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-64">
                      <p className="text-xs">{sectionTooltips.profileField}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={sampleProfile === 'custom' ? 'custom' : sampleProfile}
                  onValueChange={(value) => {
                    if (value === 'custom') {
                      setSampleProfile('custom');
                    } else {
                      handleSampleProfileChange(value as CoachingSampleSizeProfile);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {sampleProfileOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="space-y-0.5">
                          <div>{option.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {option.value === 'conservative'
                              ? sectionTooltips.profileSelectConservative
                              : option.value === 'average'
                                ? sectionTooltips.profileSelectAverage
                                : sectionTooltips.profileSelectAggressive}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {sampleProfile === 'custom'
                    ? 'Using a custom sample-size configuration.'
                    : sampleProfileOptions.find((option) => option.value === sampleProfile)?.description}
                </p>

                <div className="mt-3 rounded-md border bg-muted/40 p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Profile cheat sheet</p>
                  <p className="text-xs text-muted-foreground">
                    Conservative: safer for mature/variable teams with more noise in data. <br />
                    Average: default baseline for mixed teams. <br />
                    Aggressive: best for faster signal on small/early-stage datasets.
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="font-medium">Current sample gates</div>
                <p className="text-xs text-muted-foreground">
                  Quote: {form.thresholds.minQuoteRateSampleLeads}, Close: {form.thresholds.minCloseRateSampleQuoted}, Activity days: {form.thresholds.minActivitySampleDays}, Pass days: {form.thresholds.minPassRateSampleDays}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Activity Warning Ratio</Label>
                <Input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={form.thresholds.activityWarningRatio}
                  onChange={(e) => handleThresholdChange('activityWarningRatio', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Activity Critical Ratio</Label>
                <Input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={form.thresholds.activityCriticalRatio}
                  onChange={(e) => handleThresholdChange('activityCriticalRatio', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rate Warning Ratio</Label>
                <Input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={form.thresholds.rateWarningRatio}
                  onChange={(e) => handleThresholdChange('rateWarningRatio', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Rate Critical Ratio</Label>
                <Input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={form.thresholds.rateCriticalRatio}
                  onChange={(e) => handleThresholdChange('rateCriticalRatio', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Objection Warning Count</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={form.thresholds.objectionWarningCount}
                  onChange={(e) => handleThresholdIntChange('objectionWarningCount', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Objection Critical Count</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={form.thresholds.objectionCriticalCount}
                  onChange={(e) => handleThresholdIntChange('objectionCriticalCount', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Leads for Quote-Rate Sample</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={form.thresholds.minQuoteRateSampleLeads}
                  onChange={(e) => handleThresholdIntChange('minQuoteRateSampleLeads', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Min Quotes for Close-Rate Sample</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={form.thresholds.minCloseRateSampleQuoted}
                  onChange={(e) => handleThresholdIntChange('minCloseRateSampleQuoted', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Days for Activity/Talk Sample</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={form.thresholds.minActivitySampleDays}
                  onChange={(e) => handleThresholdIntChange('minActivitySampleDays', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Call volume and talk-time rules require this many data rows before firing.</p>
              </div>
              <div className="space-y-2">
                <Label>Min Pass-Day Samples</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={form.thresholds.minPassRateSampleDays}
                  onChange={(e) => handleThresholdIntChange('minPassRateSampleDays', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Declining pass-rate trend requires this many non-null pass rows.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Warning: Declining Weeks</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={form.thresholds.passRateWarningWeeks}
                  onChange={(e) => handleThresholdIntChange('passRateWarningWeeks', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Warning: Below %</Label>
                <Input
                  type="number"
                  step="5"
                  min="0"
                  max="100"
                  value={form.thresholds.passRateWarningThreshold}
                  onChange={(e) => handleThresholdIntChange('passRateWarningThreshold', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Critical: Declining Weeks</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={form.thresholds.passRateCriticalWeeks}
                  onChange={(e) => handleThresholdIntChange('passRateCriticalWeeks', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Critical: Below %</Label>
                <Input
                  type="number"
                  step="5"
                  min="0"
                  max="100"
                  value={form.thresholds.passRateCriticalThreshold}
                  onChange={(e) => handleThresholdIntChange('passRateCriticalThreshold', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span>Benchmark Rules</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span role="button" tabIndex={0} className="inline-flex text-muted-foreground/80 hover:text-foreground transition-colors">
                    <CircleHelp className="h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-64">
                  <p className="text-xs">{sectionTooltips.benchmarkRules}</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <CardDescription>Control team-average fallbacks for activity/rates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="flex items-start gap-2 border rounded-lg p-3">
                <Checkbox
                  checked={form.benchmarkConfig.useTeamAverageForRates}
                  onCheckedChange={(checked) => handleBenchmarkChange('useTeamAverageForRates', checked === true)}
                  className="mt-1"
                />
                <div>
                  <div className="text-sm font-medium">Use team average for quote/close rates</div>
                  <div className="text-xs text-muted-foreground">Disable to suppress rate insights without explicit targets.</div>
                </div>
              </label>
              <label className="flex items-start gap-2 border rounded-lg p-3">
                <Checkbox
                  checked={form.benchmarkConfig.useTeamAverageForActivity}
                  onCheckedChange={(checked) => handleBenchmarkChange('useTeamAverageForActivity', checked === true)}
                  className="mt-1"
                />
                <div>
                  <div className="text-sm font-medium">Use team average for activity</div>
                  <div className="text-xs text-muted-foreground">When no target is set, teams can still be benchmarked.</div>
                </div>
              </label>
              <div className="space-y-2">
                <Label>Min Team Size For Averages</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.benchmarkConfig.minTeamMembersForAverages}
                  onChange={(e) => handleBenchmarkChange('minTeamMembersForAverages', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Minimum active team size required before team-average logic applies.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span>Suggestion Templates</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span role="button" tabIndex={0} className="inline-flex text-muted-foreground/80 hover:text-foreground transition-colors">
                    <CircleHelp className="h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-64">
                  <p className="text-xs">{sectionTooltips.suggestionTemplates}</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <CardDescription>
              Edit text shown for each insight type. Uses placeholders like <code>{'{'}</code>currentValue{'}'}, {'{'}benchmarkValue{'}'}, {'{'}trendWeeks{'}'}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {suggestionKeys.map((key) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`suggestion-${key}`} className="capitalize">
                  {key.replace(/_/g, ' ')}
                </Label>
                <Textarea
                  id={`suggestion-${key}`}
                  value={form.suggestionTemplates[key]}
                  onChange={(e) => handleTemplateChange(key, e.target.value)}
                  className="min-h-20"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={isSaving || isResetting}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Settings
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={isSaving || isResetting}>
            {isResetting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
            Reset to Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}
