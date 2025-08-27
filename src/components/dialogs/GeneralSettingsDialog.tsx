import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings } from "lucide-react";
import { toast } from "sonner";

interface GeneralSettingsDialogProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function GeneralSettingsDialog({ title, icon, children }: GeneralSettingsDialogProps) {
  const [settings, setSettings] = useState({
    timezone: "America/New_York",
    notifications: {
      email: true,
      submissions: true,
      lateness: true
    },
    defaultForm: "",
    autoReminders: true
  });

  const handleSave = () => {
    // TODO: Implement actual settings save
    toast.success("Settings saved successfully!");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {icon || <Settings className="h-5 w-5" />}
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
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

          <div className="space-y-3">
            <Label>Notifications</Label>
            <div className="space-y-2">
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
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="autoReminders">Auto Reminders</Label>
            <div className="flex items-center justify-between">
              <span className="text-sm">Send daily submission reminders</span>
              <Switch
                checked={settings.autoReminders}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoReminders: checked }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => {}}>Cancel</Button>
            <Button onClick={handleSave}>Save Settings</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}