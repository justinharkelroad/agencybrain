import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings } from "lucide-react";
import { toast } from "sonner";

interface UnifiedSettingsDialogProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function UnifiedSettingsDialog({ title, icon, children }: UnifiedSettingsDialogProps) {
  const [settings, setSettings] = useState({
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
  });

  const handleSave = () => {
    // TODO: Implement actual settings save
    toast.success("Settings saved successfully!");
  };

  const handleCancel = () => {
    // Reset or handle cancel logic
    toast.info("Changes cancelled");
  };

  return (
    <div className="space-y-6">
      {/* Timezone Settings */}
      <div className="space-y-2">
        <Label htmlFor="timezone">Timezone</Label>
        <Select
          value={settings.timezone}
          onValueChange={(value) => setSettings(prev => ({ ...prev, timezone: value }))}
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
              onCheckedChange={(checked) => 
                setSettings(prev => ({ 
                  ...prev, 
                  notifications: { ...prev.notifications, email: checked }
                }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">New submission alerts</span>
            <Switch
              checked={settings.notifications.submissions}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ 
                  ...prev, 
                  notifications: { ...prev.notifications, submissions: checked }
                }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Late submission warnings</span>
            <Switch
              checked={settings.notifications.lateness}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ 
                  ...prev, 
                  notifications: { ...prev.notifications, lateness: checked }
                }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Daily submission reminders</span>
            <Switch
              checked={settings.autoReminders}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoReminders: checked }))}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Contest Settings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Contest Mode</Label>
          <Switch
            checked={settings.contest.enabled}
            onCheckedChange={(checked) => 
              setSettings(prev => ({ 
                ...prev, 
                contest: { ...prev.contest, enabled: checked }
              }))
            }
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
                  onChange={(e) => 
                    setSettings(prev => ({ 
                      ...prev, 
                      contest: { ...prev.contest, startDate: e.target.value }
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={settings.contest.endDate}
                  onChange={(e) => 
                    setSettings(prev => ({ 
                      ...prev, 
                      contest: { ...prev.contest, endDate: e.target.value }
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prize">Prize Description</Label>
              <Input
                id="prize"
                value={settings.contest.prize}
                onChange={(e) => 
                  setSettings(prev => ({ 
                    ...prev, 
                    contest: { ...prev.contest, prize: e.target.value }
                  }))
                }
                placeholder="e.g., $500 bonus + extra PTO day"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={handleCancel}>Cancel</Button>
        <Button onClick={handleSave}>Save Settings</Button>
      </div>
    </div>
  );
}