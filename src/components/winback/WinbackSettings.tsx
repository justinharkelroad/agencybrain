import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WinbackSettingsProps {
  agencyId: string;
  contactDaysBefore: number;
  onSettingsChange: (days: number) => void;
}

export function WinbackSettings({ agencyId, contactDaysBefore, onSettingsChange }: WinbackSettingsProps) {
  const [days, setDays] = useState(contactDaysBefore);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDays(contactDaysBefore);
  }, [contactDaysBefore]);

  const handleSave = async () => {
    if (days < 1 || days > 90) {
      toast.error('Days must be between 1 and 90');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('winback_settings')
        .upsert({
          agency_id: agencyId,
          contact_days_before: days,
        }, {
          onConflict: 'agency_id',
        });

      if (error) throw error;

      toast.success('Settings saved');
      onSettingsChange(days);
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4" />
          Win-Back Timing
        </CardTitle>
        <CardDescription>
          Configure when win-back opportunities should surface
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label htmlFor="contactDays">Days before competitor renewal</Label>
            <Input
              id="contactDays"
              type="number"
              min={1}
              max={90}
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value) || 45)}
              className="w-full"
            />
          </div>
          <Button onClick={handleSave} disabled={saving || days === contactDaysBefore}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Win-back opportunities will appear {days} days before their estimated competitor renewal date.
        </p>
      </CardContent>
    </Card>
  );
}
