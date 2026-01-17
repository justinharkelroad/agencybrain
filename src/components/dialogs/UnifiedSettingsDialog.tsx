import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { LeadSourceManager } from "@/components/FormBuilder/LeadSourceManager";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface UnifiedSettingsDialogProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

interface AgencySettings {
  timezone: string;
  notifications: {
    email: boolean;
    submissions: boolean;
    lateness: boolean;
  };
  autoReminders: boolean;
  contest: {
    enabled: boolean;
    startDate: string;
    endDate: string;
    prize: string;
  };
}

const defaultSettings: AgencySettings = {
  timezone: "America/New_York",
  notifications: {
    email: true,
    submissions: true,
    lateness: true
  },
  autoReminders: true,
  contest: {
    enabled: false,
    startDate: "",
    endDate: "",
    prize: ""
  }
};

export function UnifiedSettingsDialog({ title, icon, children }: UnifiedSettingsDialogProps) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AgencySettings>(defaultSettings);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Fetch agency ID and settings on mount
  useEffect(() => {
    const fetchAgencySettings = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      
      try {
        // Get agency ID from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('id', user.id)
          .single();
        
        if (!profile?.agency_id) {
          setLoading(false);
          return;
        }

        setAgencyId(profile.agency_id);

        // Fetch agency settings
        const { data: agency, error } = await supabase
          .from('agencies')
          .select(`
            timezone,
            notifications_email_enabled,
            notifications_submissions_enabled,
            notifications_lateness_enabled,
            auto_reminders_enabled,
            contest_board_enabled,
            contest_start_date,
            contest_end_date,
            contest_prize
          `)
          .eq('id', profile.agency_id)
          .single();

        if (error) throw error;

        if (agency) {
          setSettings({
            timezone: agency.timezone || "America/New_York",
            notifications: {
              email: agency.notifications_email_enabled ?? true,
              submissions: agency.notifications_submissions_enabled ?? true,
              lateness: agency.notifications_lateness_enabled ?? true
            },
            autoReminders: agency.auto_reminders_enabled ?? true,
            contest: {
              enabled: agency.contest_board_enabled ?? false,
              startDate: agency.contest_start_date || "",
              endDate: agency.contest_end_date || "",
              prize: agency.contest_prize || ""
            }
          });
        }
      } catch (error) {
        console.error('Failed to load agency settings:', error);
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
        setInitialLoadComplete(true);
      }
    };

    fetchAgencySettings();
  }, [user?.id]);

  // Save settings to database
  const saveSettings = useCallback(async (newSettings: AgencySettings) => {
    if (!agencyId || !initialLoadComplete) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('agencies')
        .update({
          timezone: newSettings.timezone,
          notifications_email_enabled: newSettings.notifications.email,
          notifications_submissions_enabled: newSettings.notifications.submissions,
          notifications_lateness_enabled: newSettings.notifications.lateness,
          auto_reminders_enabled: newSettings.autoReminders,
          contest_board_enabled: newSettings.contest.enabled,
          contest_start_date: newSettings.contest.startDate || null,
          contest_end_date: newSettings.contest.endDate || null,
          contest_prize: newSettings.contest.prize || null
        })
        .eq('id', agencyId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [agencyId, initialLoadComplete]);

  // Update setting and save
  const updateSetting = useCallback(<K extends keyof AgencySettings>(
    key: K, 
    value: AgencySettings[K]
  ) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      saveSettings(newSettings);
      return newSettings;
    });
  }, [saveSettings]);

  // Update nested notification settings
  const updateNotification = useCallback((key: keyof AgencySettings['notifications'], value: boolean) => {
    setSettings(prev => {
      const newSettings = {
        ...prev,
        notifications: { ...prev.notifications, [key]: value }
      };
      saveSettings(newSettings);
      return newSettings;
    });
  }, [saveSettings]);

  // Update nested contest settings
  const updateContest = useCallback((key: keyof AgencySettings['contest'], value: string | boolean) => {
    setSettings(prev => {
      const newSettings = {
        ...prev,
        contest: { ...prev.contest, [key]: value }
      };
      saveSettings(newSettings);
      return newSettings;
    });
  }, [saveSettings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timezone Settings */}
      <div className="space-y-2">
        <Label htmlFor="timezone">Timezone</Label>
        <Select
          value={settings.timezone}
          onValueChange={(value) => updateSetting('timezone', value)}
          disabled={saving}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="America/New_York">Eastern Time</SelectItem>
            <SelectItem value="America/Chicago">Central Time</SelectItem>
            <SelectItem value="America/Denver">Mountain Time</SelectItem>
            <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Notification Preferences */}
      <div className="space-y-3">
        <Label>Notification Preferences</Label>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Email notifications</span>
            <Switch
              checked={settings.notifications.email}
              onCheckedChange={(checked) => updateNotification('email', checked)}
              disabled={saving}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">New submission alerts</span>
            <Switch
              checked={settings.notifications.submissions}
              onCheckedChange={(checked) => updateNotification('submissions', checked)}
              disabled={saving}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Late submission warnings</span>
            <Switch
              checked={settings.notifications.lateness}
              onCheckedChange={(checked) => updateNotification('lateness', checked)}
              disabled={saving}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Daily submission reminders</span>
            <Switch
              checked={settings.autoReminders}
              onCheckedChange={(checked) => updateSetting('autoReminders', checked)}
              disabled={saving}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Lead Source Management */}
      <div className="space-y-3">
        <Label>Lead Sources</Label>
        {agencyId && <LeadSourceManager agencyId={agencyId} />}
      </div>

      <Separator />

      {/* Contest Settings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Contest Mode</Label>
          <Switch
            checked={settings.contest.enabled}
            onCheckedChange={(checked) => updateContest('enabled', checked)}
            disabled={saving}
          />
        </div>
        
        {settings.contest.enabled && (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={settings.contest.startDate}
                  onChange={(e) => updateContest('startDate', e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={settings.contest.endDate}
                  onChange={(e) => updateContest('endDate', e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prize">Prize Description</Label>
              <Input
                id="prize"
                value={settings.contest.prize}
                onChange={(e) => updateContest('prize', e.target.value)}
                placeholder="e.g., $500 bonus + extra PTO day"
                disabled={saving}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-4">
        {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        <p className="text-xs text-muted-foreground">
          All settings are saved automatically to your agency.
        </p>
      </div>
    </div>
  );
}
