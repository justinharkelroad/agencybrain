import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X, Mail, Users } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { FormSettings } from "./AdvancedSettings";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string | null;
}

interface NotificationSettingsProps {
  settings: FormSettings;
  onUpdateSettings: (settings: Partial<FormSettings>) => void;
  agencyId: string;
}

export default function NotificationSettings({ 
  settings, 
  onUpdateSettings, 
  agencyId 
}: NotificationSettingsProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch team members for the agency
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!agencyId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, role, email')
        .eq('agency_id', agencyId)
        .eq('status', 'active')
        .order('name');

      if (error) {
        console.error('Error fetching team members:', error);
      } else {
        setTeamMembers(data || []);
      }
      setLoading(false);
    };

    fetchTeamMembers();
  }, [agencyId]);

  const addImmediateRecipient = (memberId: string) => {
    if (!settings.additionalImmediateRecipients?.includes(memberId)) {
      onUpdateSettings({
        additionalImmediateRecipients: [
          ...(settings.additionalImmediateRecipients || []),
          memberId
        ]
      });
    }
  };

  const removeImmediateRecipient = (memberId: string) => {
    onUpdateSettings({
      additionalImmediateRecipients: (settings.additionalImmediateRecipients || [])
        .filter(id => id !== memberId)
    });
  };

  const toggleCustomRecipient = (memberId: string, checked: boolean) => {
    const current = settings.customSummaryRecipients || [];
    if (checked) {
      onUpdateSettings({
        customSummaryRecipients: [...current, memberId]
      });
    } else {
      onUpdateSettings({
        customSummaryRecipients: current.filter(id => id !== memberId)
      });
    }
  };

  const getMemberName = (memberId: string) => {
    return teamMembers.find(m => m.id === memberId)?.name || 'Unknown';
  };

  const getMemberRole = (memberId: string) => {
    return teamMembers.find(m => m.id === memberId)?.role || '';
  };

  // Get available members for additional recipients (exclude already selected)
  const availableMembers = teamMembers.filter(
    m => !settings.additionalImmediateRecipients?.includes(m.id)
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <CardTitle>Email Notifications</CardTitle>
        </div>
        <CardDescription>
          Configure email notifications for form submissions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Immediate Submission Email */}
        <div className="space-y-4 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Immediate Submission Email</Label>
              <p className="text-sm text-muted-foreground">
                Send AI feedback email after each submission
              </p>
            </div>
            <Switch
              checked={settings.sendImmediateEmail ?? true}
              onCheckedChange={(checked) => onUpdateSettings({ sendImmediateEmail: checked })}
            />
          </div>

          {(settings.sendImmediateEmail ?? true) && (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">
                <Users className="h-4 w-4 inline mr-1" />
                Recipients: <span className="font-medium">Submitter + Agency Owner</span> (always)
              </p>

              <div className="space-y-2">
                <Label className="text-sm">Additional Recipients (optional)</Label>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading team members...</p>
                ) : (
                  <>
                    <Select
                      value=""
                      onValueChange={(value) => {
                        if (value) addImmediateRecipient(value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team members..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMembers.length === 0 ? (
                          <SelectItem value="_none" disabled>
                            No more team members available
                          </SelectItem>
                        ) : (
                          availableMembers.map(member => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name} ({member.role})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>

                    {/* Selected members as pills */}
                    {(settings.additionalImmediateRecipients?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {settings.additionalImmediateRecipients?.map(memberId => (
                          <Badge 
                            key={memberId} 
                            variant="secondary" 
                            className="pr-1 flex items-center gap-1"
                          >
                            {getMemberName(memberId)} ({getMemberRole(memberId)})
                            <button
                              type="button"
                              onClick={() => removeImmediateRecipient(memberId)}
                              className="ml-1 hover:bg-muted rounded-full p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Daily Summary Email */}
        <div className="space-y-4 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Daily Summary Email</Label>
              <p className="text-sm text-muted-foreground">
                Include submissions in daily team summary
              </p>
            </div>
            <Switch
              checked={settings.sendDailySummary ?? true}
              onCheckedChange={(checked) => onUpdateSettings({ sendDailySummary: checked })}
            />
          </div>

          {(settings.sendDailySummary ?? true) && (
            <div className="space-y-3 pt-2">
              <div className="space-y-2">
                <Label className="text-sm">Summary Recipients</Label>
                <Select
                  value={settings.dailySummaryRecipients || 'all_team'}
                  onValueChange={(value: 'sales_team' | 'service_team' | 'all_team' | 'owner_only' | 'custom') => {
                    onUpdateSettings({ dailySummaryRecipients: value });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales_team">Sales Team Only</SelectItem>
                    <SelectItem value="service_team">Service Team Only</SelectItem>
                    <SelectItem value="all_team">All Team Members</SelectItem>
                    <SelectItem value="owner_only">Agency Owner Only</SelectItem>
                    <SelectItem value="custom">Custom Selection</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom selection checklist */}
              {settings.dailySummaryRecipients === 'custom' && (
                <div className="space-y-2 mt-4 border rounded-md p-4 bg-muted/30">
                  <Label className="text-sm font-medium">Select Team Members</Label>
                  {loading ? (
                    <p className="text-sm text-muted-foreground">Loading team members...</p>
                  ) : teamMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No team members found</p>
                  ) : (
                    <div className="space-y-2 mt-2">
                      {teamMembers.map(member => (
                        <div key={member.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`custom-${member.id}`}
                            checked={settings.customSummaryRecipients?.includes(member.id) ?? false}
                            onCheckedChange={(checked) => 
                              toggleCustomRecipient(member.id, checked as boolean)
                            }
                          />
                          <label 
                            htmlFor={`custom-${member.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {member.name} <span className="text-muted-foreground">({member.role})</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
