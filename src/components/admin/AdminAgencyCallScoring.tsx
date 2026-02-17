import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Phone, Loader2, Gift, Clock } from 'lucide-react';
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

interface BonusInfo {
  remaining: number;
  expiresAt: string | null;
}

interface GrantRecord {
  id: string;
  call_count: number;
  expires_at: string;
  granted_at: string;
  notes: string | null;
  balance_before: number;
  balance_after: number;
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
  const [bonus, setBonus] = useState<BonusInfo>({ remaining: 0, expiresAt: null });
  const [grantHistory, setGrantHistory] = useState<GrantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Grant form state
  const [grantCount, setGrantCount] = useState<number>(10);
  const [grantNotes, setGrantNotes] = useState('');
  const [granting, setGranting] = useState(false);

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

      // Fetch bonus balance
      const { data: balanceData } = await supabase
        .from('agency_call_balance')
        .select('bonus_calls_remaining, bonus_calls_expires_at')
        .eq('agency_id', agencyId)
        .single();

      if (balanceData) {
        const isExpired = balanceData.bonus_calls_expires_at &&
          new Date(balanceData.bonus_calls_expires_at) <= new Date();
        setBonus({
          remaining: isExpired ? 0 : (balanceData.bonus_calls_remaining || 0),
          expiresAt: isExpired ? null : balanceData.bonus_calls_expires_at,
        });
      }

      // Fetch grant history
      const { data: grants } = await supabase
        .from('admin_call_credit_grants')
        .select('id, call_count, expires_at, granted_at, notes, balance_before, balance_after')
        .eq('agency_id', agencyId)
        .order('granted_at', { ascending: false })
        .limit(10);

      setGrantHistory(grants || []);
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

      // Also update the current usage tracking record's limit
      await supabase
        .from('call_usage_tracking')
        .update({ calls_limit: settings.calls_limit })
        .eq('agency_id', agencyId)
        .gte('period_end', new Date().toISOString());

      toast.success('Call scoring settings saved');
      await fetchSettings(); // Refresh usage data with new period dates
    } catch (err: any) {
      console.error('Error saving settings:', err);
      toast.error('Failed to save call scoring settings');
    } finally {
      setSaving(false);
    }
  };

  const handleGrantBonus = async () => {
    if (grantCount <= 0) {
      toast.error('Call count must be greater than 0');
      return;
    }

    setGranting(true);
    try {
      const { data, error } = await supabase
        .rpc('admin_grant_bonus_calls', {
          p_agency_id: agencyId,
          p_call_count: grantCount,
          p_notes: grantNotes || null,
        });

      if (error) throw error;

      const result = data?.[0];
      if (result?.success) {
        toast.success(`Granted ${grantCount} bonus calls`);
        setGrantNotes('');
        await fetchSettings(); // Refresh all data
      } else {
        toast.error(result?.message || 'Failed to grant bonus calls');
      }
    } catch (err: any) {
      console.error('Error granting bonus calls:', err);
      toast.error(err.message || 'Failed to grant bonus calls');
    } finally {
      setGranting(false);
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
    <div className="space-y-4">
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
              <Label htmlFor="reset_day">Reset Day (1-28)</Label>
              <Input
                id="reset_day"
                type="number"
                min={1}
                max={28}
                value={settings.reset_day}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value >= 1 && value <= 28) {
                    setSettings(prev => ({ ...prev, reset_day: value }));
                  } else if (e.target.value === '') {
                    setSettings(prev => ({ ...prev, reset_day: 1 }));
                  }
                }}
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

      {/* Bonus Call Credits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Bonus Call Credits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Active Bonus Display */}
          {bonus.remaining > 0 && (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">Active Bonus</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {bonus.remaining} calls
                  </p>
                </div>
                {bonus.expiresAt && (
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm text-green-700 dark:text-green-400">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Expires</span>
                    </div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">
                      {new Date(bonus.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Grant Form */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Grant Bonus Calls</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Number of calls</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={grantCount}
                  onChange={(e) => setGrantCount(parseInt(e.target.value) || 0)}
                  placeholder="10"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                <Input
                  value={grantNotes}
                  onChange={(e) => setGrantNotes(e.target.value)}
                  placeholder="Reason for bonus"
                />
              </div>
            </div>
            <Button
              onClick={handleGrantBonus}
              disabled={granting || grantCount <= 0}
              variant="outline"
              className="w-full"
            >
              {granting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Grant {grantCount > 0 ? `${grantCount} ` : ''}Bonus Calls
            </Button>
          </div>

          {/* Grant History */}
          {grantHistory.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-medium">Recent Grants</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {grantHistory.map((grant) => (
                    <div
                      key={grant.id}
                      className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm"
                    >
                      <div className="min-w-0">
                        <span className="font-medium">+{grant.call_count} calls</span>
                        {grant.notes && (
                          <span className="ml-2 text-muted-foreground truncate">
                            - {grant.notes}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {new Date(grant.granted_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
