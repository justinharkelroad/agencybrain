import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useCoachingThresholds } from '@/hooks/useCoachingThresholds';
import { DEFAULT_COACHING_THRESHOLDS } from '@/types/coaching';
import type { CoachingThresholds } from '@/types/coaching';

interface CoachingThresholdsSettingsProps {
  agencyId: string;
}

export function CoachingThresholdsSettings({ agencyId }: CoachingThresholdsSettingsProps) {
  const { thresholds, isLoading, save, isSaving, reset, isResetting } = useCoachingThresholds(agencyId);
  const [form, setForm] = useState<CoachingThresholds>(DEFAULT_COACHING_THRESHOLDS);

  useEffect(() => {
    setForm(thresholds);
  }, [thresholds]);

  const handleChange = (key: keyof CoachingThresholds, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setForm(prev => ({ ...prev, [key]: num }));
    }
  };

  const handleSave = async () => {
    try {
      await save(form);
      toast.success('Coaching thresholds saved');
    } catch {
      toast.error('Failed to save thresholds');
    }
  };

  const handleReset = async () => {
    try {
      await reset();
      setForm(DEFAULT_COACHING_THRESHOLDS);
      toast.success('Thresholds reset to defaults');
    } catch {
      toast.error('Failed to reset thresholds');
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
    <Card>
      <CardHeader>
        <CardTitle>Coaching Insight Thresholds</CardTitle>
        <CardDescription>
          Control when coaching insights trigger for your team. Lower ratios are more sensitive (flag earlier).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Activity & Rate Thresholds */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Activity Thresholds (Calls & Talk Time)</h3>
          <p className="text-xs text-muted-foreground">
            Ratio of member's average vs. target/team average. E.g., 0.8 = flag if below 80%.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Warning Ratio</Label>
              <Input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={form.activityWarningRatio}
                onChange={(e) => handleChange('activityWarningRatio', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Critical Ratio</Label>
              <Input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={form.activityCriticalRatio}
                onChange={(e) => handleChange('activityCriticalRatio', e.target.value)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Quote/Close Rate Thresholds */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Quote & Close Rate Thresholds</h3>
          <p className="text-xs text-muted-foreground">
            Ratio of member's rate vs. team average. E.g., 0.8 = flag if below 80% of team avg.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Warning Ratio</Label>
              <Input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={form.rateWarningRatio}
                onChange={(e) => handleChange('rateWarningRatio', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Critical Ratio</Label>
              <Input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={form.rateCriticalRatio}
                onChange={(e) => handleChange('rateCriticalRatio', e.target.value)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Objection Pattern */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Objection Pattern</h3>
          <p className="text-xs text-muted-foreground">
            Same objection occurrences per month before flagging.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Warning Count</Label>
              <Input
                type="number"
                step="1"
                min="1"
                value={form.objectionWarningCount}
                onChange={(e) => handleChange('objectionWarningCount', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Critical Count</Label>
              <Input
                type="number"
                step="1"
                min="1"
                value={form.objectionCriticalCount}
                onChange={(e) => handleChange('objectionCriticalCount', e.target.value)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Declining Pass Rate */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Declining Pass Rate</h3>
          <p className="text-xs text-muted-foreground">
            Consecutive declining weeks + pass rate threshold to trigger an insight.
          </p>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Warning: Declining Weeks</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={form.passRateWarningWeeks}
                  onChange={(e) => handleChange('passRateWarningWeeks', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Warning: Below %</Label>
                <Input
                  type="number"
                  step="5"
                  min="0"
                  max="100"
                  value={form.passRateWarningThreshold}
                  onChange={(e) => handleChange('passRateWarningThreshold', e.target.value)}
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
                  value={form.passRateCriticalWeeks}
                  onChange={(e) => handleChange('passRateCriticalWeeks', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Critical: Below %</Label>
                <Input
                  type="number"
                  step="5"
                  min="0"
                  max="100"
                  value={form.passRateCriticalThreshold}
                  onChange={(e) => handleChange('passRateCriticalThreshold', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={isSaving || isResetting}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={isSaving || isResetting}>
            {isResetting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
            Reset to Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
