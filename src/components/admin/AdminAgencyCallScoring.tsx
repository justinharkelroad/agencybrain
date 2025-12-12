import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AdminAgencyCallScoringProps {
  agencyId: string;
}

interface CallScoringSettings {
  enabled: boolean;
  calls_limit: number;
  reset_day: number;
}

interface CurrentUsage {
  calls_used: number;
  calls_limit: number;
  period_end: string | null;
}

export function AdminAgencyCallScoring({ agencyId }: AdminAgencyCallScoringProps) {
  const [settings, setSettings] = useState<CallScoringSettings>({
    enabled: false,
    calls_limit: 20,
    reset_day: 1,
  });
  const [currentUsage, setCurrentUsage] = useState<CurrentUsage>({
    calls_used: 0,
    calls_limit: 20,
    period_end: null
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [agencyId]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      // Fetch settings
      const { data: settingsData } = await supabase
        .from('agency_call_scoring_settings')
        .select('*')
        .eq('agency_id', agencyId)
        .single();

      if (settingsData) {
        setSettings({
          enabled: settingsData.enabled || false,
          calls_limit: settingsData.calls_limit || 20,
          reset_day: settingsData.reset_day || 1,
        });
      }

      // Fetch current usage using RPC
      const { data: usageData } = await supabase
        .rpc('check_and_reset_call_usage', { p_agency_id: agencyId });

      if (usageData && usageData[0]) {
        setCurrentUsage({
          calls_used: usageData[0].calls_used || 0,
          calls_limit: usageData[0].calls_limit || 20,
          period_end: usageData[0].period_end
        });
      }
    } catch (err) {
      console.error('Error fetching call scoring settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('agency_call_scoring_settings')
        .upsert({
          agency_id: agencyId,
          enabled: settings.enabled,
          calls_limit: settings.calls_limit,
          reset_day: settings.reset_day,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'agency_id'
        });

      if (error) throw error;
      toast.success('Call scoring settings saved');
    } catch (err: any) {
      console.error('Error saving settings:', err);
      toast.error('Failed to save call scoring settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Call Scoring Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Enable Call Scoring</Label>
            <p className="text-sm text-muted-foreground">Allow this agency to upload and analyze calls</p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(checked) => 
              setSettings({ ...settings, enabled: checked })
            }
          />
        </div>

        <Separator />

        {/* Calls Per Month */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Calls Per Month</Label>
            <Input
              type="number"
              min={1}
              max={1000}
              value={settings.calls_limit}
              onChange={(e) => 
                setSettings({ ...settings, calls_limit: parseInt(e.target.value) || 20 })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Reset Day (1-28)</Label>
            <Input
              type="number"
              min={1}
              max={28}
              value={settings.reset_day}
              onChange={(e) => 
                setSettings({ ...settings, reset_day: parseInt(e.target.value) || 1 })
              }
            />
            <p className="text-xs text-muted-foreground">Calls reset on this day each month</p>
          </div>
        </div>

        {/* Current Usage Display */}
        <div className="p-4 rounded-lg bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Period Usage</p>
              <p className="text-lg font-bold">
                {currentUsage.calls_used} / {currentUsage.calls_limit} calls
              </p>
            </div>
            {currentUsage.period_end && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Resets</p>
                <p className="text-sm font-medium">
                  {new Date(currentUsage.period_end).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <Button onClick={saveSettings} disabled={saving} className="w-full">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
}
