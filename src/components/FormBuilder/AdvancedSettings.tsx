import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface FormSettings {
  dueBy: string;
  customDueTime?: string;
  lateCountsForPass: boolean;
  reminderTimes: string[];
  ccOwner: boolean;
  suppressIfFinal: boolean;
  // Email notification settings
  sendImmediateEmail: boolean;
  additionalImmediateRecipients: string[];
  sendDailySummary: boolean;
  dailySummaryRecipients: 'sales_team' | 'service_team' | 'all_team' | 'owner_only' | 'custom';
  customSummaryRecipients: string[];
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
        </CardContent>
      </Card>
    </>
  );
}
