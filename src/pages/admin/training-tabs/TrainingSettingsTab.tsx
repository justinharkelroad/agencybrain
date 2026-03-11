import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Bell, Mail, Users } from "lucide-react";

interface TrainingSettingsTabProps {
  agencyId: string;
}

interface PotentialRecipient {
  id: string;
  display_name: string;
  email: string;
  type: 'owner' | 'key_employee' | 'staff';
  user_id: string | null;       // auth.users id (owners/KEs)
  staff_user_id: string | null; // staff_users id
}

interface SavedRecipient {
  id: string;
  agency_id: string;
  user_id: string | null;
  staff_user_id: string | null;
  display_name: string;
  email: string;
}

export function TrainingSettingsTab({ agencyId }: TrainingSettingsTabProps) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const hasInitialized = useRef(false);

  // Fetch all potential recipients for this agency
  const { data: potentialRecipients = [], isLoading: loadingPotential } = useQuery({
    queryKey: ['training-potential-recipients', agencyId],
    queryFn: async () => {
      const recipients: PotentialRecipient[] = [];
      const seenUserIds = new Set<string>();

      // 1. Agency owner(s) and profiles with this agency_id
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('agency_id', agencyId);

      if (profiles) {
        for (const profile of profiles) {
          if (profile.email) {
            seenUserIds.add(profile.id);
            recipients.push({
              id: `profile-${profile.id}`,
              display_name: profile.full_name || 'Agency Owner',
              email: profile.email,
              type: 'owner',
              user_id: profile.id,
              staff_user_id: null,
            });
          }
        }
      }

      // 2. Key employees whose profiles aren't already covered
      //    key_employees only has (id, user_id, agency_id) — name/email live in profiles
      const { data: keyEmployees } = await supabase
        .from('key_employees')
        .select('id, user_id')
        .eq('agency_id', agencyId);

      if (keyEmployees) {
        for (const ke of keyEmployees) {
          if (seenUserIds.has(ke.user_id)) continue;
          // Look up their profile for name/email
          const { data: keProfile } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', ke.user_id)
            .single();

          if (keProfile?.email) {
            seenUserIds.add(ke.user_id);
            recipients.push({
              id: `ke-${ke.id}`,
              display_name: keProfile.full_name || 'Key Employee',
              email: keProfile.email,
              type: 'key_employee',
              user_id: ke.user_id,
              staff_user_id: null,
            });
          }
        }
      }

      // 3. Staff users with email addresses
      const { data: staffUsers } = await supabase
        .from('staff_users')
        .select('id, display_name, email')
        .eq('agency_id', agencyId)
        .eq('is_active', true);

      if (staffUsers) {
        for (const staff of staffUsers) {
          if (staff.email) {
            recipients.push({
              id: `staff-${staff.id}`,
              display_name: staff.display_name || 'Staff User',
              email: staff.email,
              type: 'staff',
              user_id: null,
              staff_user_id: staff.id,
            });
          }
        }
      }

      return recipients;
    },
    enabled: !!agencyId,
  });

  // Fetch currently saved recipients
  const { data: savedRecipients = [], isLoading: loadingSaved } = useQuery({
    queryKey: ['training-notification-recipients', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_notification_recipients' as any)
        .select('*')
        .eq('agency_id', agencyId);

      if (error) {
        console.error('Error fetching notification recipients:', error);
        return [];
      }
      return (data || []) as unknown as SavedRecipient[];
    },
    enabled: !!agencyId,
  });

  // Initialize selected IDs from saved recipients — only once after BOTH queries finish.
  // Using a ref prevents re-fetches (window focus, etc.) from clobbering unsaved changes.
  // Must wait for both queries to settle to avoid race condition where potentialRecipients
  // loads first and initializes with empty savedRecipients.
  useEffect(() => {
    if (hasInitialized.current) return;
    if (loadingPotential || loadingSaved) return; // wait for both queries

    const saved = new Set<string>();
    for (const sr of savedRecipients) {
      const match = potentialRecipients.find(
        pr => (sr.user_id && pr.user_id === sr.user_id) ||
              (sr.staff_user_id && pr.staff_user_id === sr.staff_user_id)
      );
      if (match) saved.add(match.id);
    }
    setSelectedIds(saved);
    hasInitialized.current = true;
  }, [savedRecipients, potentialRecipients, loadingPotential, loadingSaved]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Delete existing recipients for this agency
      const { error: deleteError } = await supabase
        .from('training_notification_recipients' as any)
        .delete()
        .eq('agency_id', agencyId);

      if (deleteError) throw deleteError;

      // Insert new selections
      const selectedRecipients = potentialRecipients.filter(r => selectedIds.has(r.id));
      if (selectedRecipients.length === 0) return;

      const rows = selectedRecipients.map(r => ({
        agency_id: agencyId,
        user_id: r.user_id || null,
        staff_user_id: r.staff_user_id || null,
        display_name: r.display_name,
        email: r.email,
      }));

      const { error } = await supabase
        .from('training_notification_recipients' as any)
        .insert(rows);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Training notification recipients saved');
      // Reset initialization so the next refetch picks up the freshly saved state
      hasInitialized.current = false;
      queryClient.invalidateQueries({ queryKey: ['training-notification-recipients', agencyId] });
    },
    onError: (error) => {
      console.error('Error saving recipients:', error);
      toast.error('Failed to save notification recipients');
    },
  });

  const toggleRecipient = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const hasChanges = (() => {
    const currentSavedIds = new Set<string>();
    for (const sr of savedRecipients) {
      const match = potentialRecipients.find(
        pr => (sr.user_id && pr.user_id === sr.user_id) ||
              (sr.staff_user_id && pr.staff_user_id === sr.staff_user_id)
      );
      if (match) currentSavedIds.add(match.id);
    }
    if (currentSavedIds.size !== selectedIds.size) return true;
    for (const id of selectedIds) {
      if (!currentSavedIds.has(id)) return true;
    }
    return false;
  })();

  const isLoading = loadingPotential || loadingSaved;

  const getTypeBadge = (type: PotentialRecipient['type']) => {
    switch (type) {
      case 'owner':
        return <Badge variant="default" className="text-xs">Owner</Badge>;
      case 'key_employee':
        return <Badge variant="secondary" className="text-xs">Key Employee</Badge>;
      case 'staff':
        return <Badge variant="outline" className="text-xs">Staff</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle>Training Completion Notifications</CardTitle>
              <CardDescription>
                Choose who receives an email when a team member completes a training lesson.
                This applies to both Standard Playbook and custom agency training.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {potentialRecipients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No team members with email addresses found.</p>
              <p className="text-sm">Add email addresses to your team members to enable notifications.</p>
            </div>
          ) : (
            <>
              <div className="text-sm text-muted-foreground mb-4">
                {selectedIds.size} of {potentialRecipients.length} team members selected
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {potentialRecipients.map((recipient) => (
                  <div
                    key={recipient.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedIds.has(recipient.id)
                        ? 'bg-primary/5 border-primary/30'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => toggleRecipient(recipient.id)}
                  >
                    <Checkbox
                      checked={selectedIds.has(recipient.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {recipient.display_name}
                        </span>
                        {getTypeBadge(recipient.type)}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{recipient.email}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIds(new Set(potentialRecipients.map(r => r.id)))}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Clear All
                  </Button>
                </div>
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !hasChanges}
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Recipients'
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {savedRecipients.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Currently Receiving Notifications</CardTitle>
            <CardDescription>
              These people will receive an email each time a team member completes a training lesson.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {savedRecipients.map((r) => (
                <Badge key={r.id} variant="secondary" className="py-1.5 px-3">
                  <Mail className="h-3 w-3 mr-1.5" />
                  {r.display_name}
                  <span className="text-muted-foreground ml-1.5">({r.email})</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
