import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface FormSettings {
  dueBy: string;
  customDueTime?: string;
  lateCountsForPass: boolean;
  reminderTimes: string[];
  ccOwner: boolean;
  suppressIfFinal: boolean;
  hasWorkDate: boolean;
  hasQuotedDetails: boolean;
  hasSoldDetails: boolean;
}

interface AdvancedSettingsProps {
  settings: FormSettings;
  onUpdateSettings: (settings: Partial<FormSettings>) => void;
}

const TIME_OPTIONS = [
  { value: '06:00', label: '6:00 AM' },
  { value: '07:00', label: '7:00 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '16:45', label: '4:45 PM' },
  { value: '17:00', label: '5:00 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '19:00', label: '7:00 PM' },
  { value: '20:00', label: '8:00 PM' },
  { value: '21:00', label: '9:00 PM' },
  { value: '22:00', label: '10:00 PM' },
  { value: '23:00', label: '11:00 PM' },
  { value: '23:59', label: '11:59 PM' },
];

export default function AdvancedSettings({ settings, onUpdateSettings }: AdvancedSettingsProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Form Settings</CardTitle>
          <CardDescription>
            Configure submission and notification settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="dueBy">Due By</Label>
            <Select 
              value={settings.dueBy}
              onValueChange={(value) => onUpdateSettings({ dueBy: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="same-day-23:59">Same day 11:59 PM</SelectItem>
                <SelectItem value="next-day-09:00">Next day 9:00 AM</SelectItem>
                <SelectItem value="custom">Custom time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {settings.dueBy === 'custom' && (
            <div>
              <Label htmlFor="customDueTime">Custom Due Time</Label>
              <Select 
                value={settings.customDueTime || '23:59'}
                onValueChange={(value) => onUpdateSettings({ customDueTime: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="lateCountsForPass">Count late submissions toward pass/score</Label>
            <Switch
              id="lateCountsForPass"
              checked={settings.lateCountsForPass}
              onCheckedChange={(checked) => onUpdateSettings({ lateCountsForPass: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="ccOwner">CC owner on reminders</Label>
            <Switch
              id="ccOwner"
              checked={settings.ccOwner}
              onCheckedChange={(checked) => onUpdateSettings({ ccOwner: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="suppressIfFinal">Suppress reminders if submission exists</Label>
            <Switch
              id="suppressIfFinal"
              checked={settings.suppressIfFinal}
              onCheckedChange={(checked) => onUpdateSettings({ suppressIfFinal: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Advanced Fields</CardTitle>
          <CardDescription>
            Enable additional data collection fields
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="hasWorkDate">Work Date Field</Label>
              <p className="text-sm text-muted-foreground">Allow separate work date from submission date</p>
            </div>
            <Switch
              id="hasWorkDate"
              checked={settings.hasWorkDate}
              onCheckedChange={(checked) => onUpdateSettings({ hasWorkDate: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="hasQuotedDetails">Quoted Details Section</Label>
              <p className="text-sm text-muted-foreground">Collect detailed information about quoted households</p>
            </div>
            <Switch
              id="hasQuotedDetails"
              checked={settings.hasQuotedDetails}
              onCheckedChange={(checked) => onUpdateSettings({ hasQuotedDetails: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="hasSoldDetails">Sold Details Section</Label>
              <p className="text-sm text-muted-foreground">Collect detailed information about sold policies</p>
            </div>
            <Switch
              id="hasSoldDetails"
              checked={settings.hasSoldDetails}
              onCheckedChange={(checked) => onUpdateSettings({ hasSoldDetails: checked })}
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}