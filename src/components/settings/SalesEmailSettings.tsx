import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SalesEmailSettingsProps {
  agencyId: string;
}

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern (New York)' },
  { value: 'America/Chicago', label: 'Central (Chicago)' },
  { value: 'America/Denver', label: 'Mountain (Denver)' },
  { value: 'America/Los_Angeles', label: 'Pacific (Los Angeles)' },
  { value: 'America/Phoenix', label: 'Arizona (Phoenix)' },
];

export function SalesEmailSettings({ agencyId }: SalesEmailSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  const [dailySummaryEnabled, setDailySummaryEnabled] = useState(false);
  const [callScoringEnabled, setCallScoringEnabled] = useState(true);
  const [timezone, setTimezone] = useState('America/New_York');

  useEffect(() => {
    async function loadSettings() {
      try {
        const { data, error } = await supabase
          .from('agencies')
          .select('sales_realtime_email_enabled, sales_daily_summary_enabled, call_scoring_email_enabled, timezone')
          .eq('id', agencyId)
          .single();

        if (error) throw error;

        setRealtimeEnabled(data?.sales_realtime_email_enabled ?? true);
        setDailySummaryEnabled(data?.sales_daily_summary_enabled ?? false);
        setCallScoringEnabled(data?.call_scoring_email_enabled ?? true);
        setTimezone(data?.timezone || 'America/New_York');
      } catch (err) {
        console.error('Failed to load sales email settings:', err);
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    }

    if (agencyId) {
      loadSettings();
    }
  }, [agencyId]);

  const updateSetting = async (field: string, value: boolean | string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('agencies')
        .update({ [field]: value })
        .eq('id', agencyId);

      if (error) throw error;

      toast.success('Setting updated');
    } catch (err) {
      console.error('Failed to update setting:', err);
      toast.error('Failed to update setting');
      // Revert on error
      if (field === 'sales_realtime_email_enabled') {
        setRealtimeEnabled(!value);
      } else if (field === 'sales_daily_summary_enabled') {
        setDailySummaryEnabled(!value);
      } else if (field === 'call_scoring_email_enabled') {
        setCallScoringEnabled(!value);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCallScoringToggle = (checked: boolean) => {
    setCallScoringEnabled(checked);
    updateSetting('call_scoring_email_enabled', checked);
  };

  const handleRealtimeToggle = (checked: boolean) => {
    setRealtimeEnabled(checked);
    updateSetting('sales_realtime_email_enabled', checked);
  };

  const handleDailySummaryToggle = (checked: boolean) => {
    setDailySummaryEnabled(checked);
    updateSetting('sales_daily_summary_enabled', checked);
  };

  const handleTimezoneChange = (value: string) => {
    setTimezone(value);
    updateSetting('timezone', value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Sales Email Notifications
        </CardTitle>
        <CardDescription>
          Configure automated email notifications for your sales team
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Real-Time Sale Alerts */}
        <div className="flex items-start justify-between gap-4 p-4 bg-muted/30 rounded-lg">
          <div className="space-y-1">
            <Label className="text-base font-medium">Real-Time Sale Alerts</Label>
            <p className="text-sm text-muted-foreground">
              Send an email to all team members when a new sale is submitted. Includes a live scoreboard of today's sales.
            </p>
          </div>
          <Switch
            checked={realtimeEnabled}
            onCheckedChange={handleRealtimeToggle}
            disabled={saving}
          />
        </div>

        {/* Daily Sales Summary */}
        <div className="flex items-start justify-between gap-4 p-4 bg-muted/30 rounded-lg">
          <div className="space-y-1">
            <Label className="text-base font-medium">Daily Sales Summary</Label>
            <p className="text-sm text-muted-foreground">
              Send a full summary of the day's sales to all team members at 7:00 PM.
            </p>
          </div>
          <Switch
            checked={dailySummaryEnabled}
            onCheckedChange={handleDailySummaryToggle}
            disabled={saving}
          />
        </div>

        {/* Call Scoring Notifications */}
        <div className="flex items-start justify-between gap-4 p-4 bg-muted/30 rounded-lg">
          <div className="space-y-1">
            <Label className="text-base font-medium">Call Score Alerts</Label>
            <p className="text-sm text-muted-foreground">
              Send scorecard results to the team member, agency owner, and managers when a call is analyzed.
            </p>
          </div>
          <Switch
            checked={callScoringEnabled}
            onCheckedChange={handleCallScoringToggle}
            disabled={saving}
          />
        </div>

        {/* Timezone */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label className="text-base font-medium">Agency Timezone</Label>
          </div>
          <Select value={timezone} onValueChange={handleTimezoneChange} disabled={saving}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_OPTIONS.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Used for scheduling daily summary emails and displaying times in notifications.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
